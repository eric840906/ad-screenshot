#!/bin/bash

# Main Screenshot Automation Cron Job
# Runs the complete screenshot automation workflow with error handling

set -euo pipefail  # Exit on any error, undefined variable, or pipe failure

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
PID_FILE="$PROJECT_DIR/automation.pid"
LOCK_FILE="$PROJECT_DIR/automation.lock"
MAX_RUNTIME=7200  # 2 hours in seconds

# Logging functions
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_DIR/automation.log"
}

error() {
    echo "[$TIMESTAMP] ERROR: $1" | tee -a "$LOG_DIR/automation.log" "$LOG_DIR/error.log"
}

success() {
    echo "[$TIMESTAMP] SUCCESS: $1" | tee -a "$LOG_DIR/automation.log"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log "Cleaning up automation job (exit code: $exit_code)"
    
    # Remove lock and PID files
    rm -f "$LOCK_FILE" "$PID_FILE"
    
    # Kill any remaining Node.js processes
    if [ -n "${NODE_PID:-}" ]; then
        if kill -0 "$NODE_PID" 2>/dev/null; then
            log "Terminating Node.js process $NODE_PID"
            kill -TERM "$NODE_PID" 2>/dev/null || true
            sleep 5
            kill -KILL "$NODE_PID" 2>/dev/null || true
        fi
    fi
    
    # Send notification if job failed
    if [ $exit_code -ne 0 ]; then
        send_notification "❌ Screenshot automation job failed (exit code: $exit_code)" "error"
    fi
    
    exit $exit_code
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Check if another instance is running
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
            error "Another automation job is already running (PID: $lock_pid)"
            exit 1
        else
            log "Removing stale lock file"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    # Create lock file with current PID
    echo $$ > "$LOCK_FILE"
    log "Created lock file with PID $$"
}

# Send notifications
send_notification() {
    local message="$1"
    local type="${2:-info}"
    
    # Load environment variables
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    
    # Send email notification
    if [ -n "${NOTIFICATION_EMAIL:-}" ] && [ -n "${SMTP_HOST:-}" ]; then
        echo "Subject: Ad Screenshot Automation - $type" | \
        echo "From: noreply@ad-screenshot.local" | \
        echo "To: $NOTIFICATION_EMAIL" | \
        echo "" | \
        echo "$message" | \
        sendmail "$NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
    
    # Send Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local emoji="ℹ️"
        case "$type" in
            "error") emoji="❌" ;;
            "success") emoji="✅" ;;
            "warning") emoji="⚠️" ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji $message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Check system health before starting
check_health() {
    log "Performing health checks..."
    
    # Check Redis connectivity
    if ! redis-cli ping > /dev/null 2>&1; then
        error "Redis is not responding"
        send_notification "Redis service is down" "error"
        exit 1
    fi
    log "Redis connectivity: OK"
    
    # Check disk space
    local disk_usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        error "Disk space critically low: ${disk_usage}%"
        send_notification "Disk space critically low: ${disk_usage}%" "error"
        exit 1
    elif [ "$disk_usage" -gt 80 ]; then
        log "Warning: Disk space high: ${disk_usage}%"
        send_notification "Disk space warning: ${disk_usage}%" "warning"
    fi
    log "Disk space: ${disk_usage}% used"
    
    # Check memory usage
    local memory_usage=$(ps -o %mem -p $$ | awk 'NR==2 {print int($1)}')
    if [ "$memory_usage" -gt 80 ]; then
        log "Warning: High memory usage: ${memory_usage}%"
    fi
    log "Memory usage: ${memory_usage}%"
    
    # Check Chrome/Chromium availability
    local chrome_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if [ ! -x "$chrome_path" ]; then
        error "Chrome executable not found at: $chrome_path"
        exit 1
    fi
    log "Chrome executable: OK"
    
    success "All health checks passed"
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    # Load environment variables
    if [ -f ".env" ]; then
        source ".env"
        log "Environment variables loaded"
    else
        error ".env file not found"
        exit 1
    fi
    
    # Set Node.js options
    export NODE_OPTIONS="${NODE_OPTIONS:-'--max-old-space-size=2048'}"
    export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
    
    # Create necessary directories
    mkdir -p "$LOG_DIR" screenshots data/processed data/failed
    
    log "Environment setup complete"
}

# Run the automation
run_automation() {
    log "Starting screenshot automation..."
    
    # Start timeout monitor in background
    (
        sleep $MAX_RUNTIME
        if [ -f "$PID_FILE" ]; then
            local node_pid=$(cat "$PID_FILE")
            if kill -0 "$node_pid" 2>/dev/null; then
                error "Automation job exceeded maximum runtime ($MAX_RUNTIME seconds)"
                kill -TERM "$node_pid" 2>/dev/null || true
                sleep 10
                kill -KILL "$node_pid" 2>/dev/null || true
            fi
        fi
    ) &
    local timeout_pid=$!
    
    # Run the Node.js application
    local start_time=$(date +%s)
    
    # Start application and capture PID
    npm run start &
    NODE_PID=$!
    echo "$NODE_PID" > "$PID_FILE"
    
    log "Started automation process with PID: $NODE_PID"
    
    # Wait for completion
    local exit_code=0
    if wait "$NODE_PID"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        success "Automation completed successfully in ${duration} seconds"
    else
        exit_code=$?
        error "Automation process failed with exit code: $exit_code"
    fi
    
    # Kill timeout monitor
    kill "$timeout_pid" 2>/dev/null || true
    
    # Remove PID file
    rm -f "$PID_FILE"
    
    return $exit_code
}

# Generate report
generate_report() {
    log "Generating automation report..."
    
    local report_file="$LOG_DIR/automation-report-$(date +%Y%m%d).json"
    local stats_file="$PROJECT_DIR/data/stats.json"
    
    # Basic statistics
    local screenshots_today=$(find "$PROJECT_DIR/screenshots" -name "*.png" -newermt "today" | wc -l)
    local errors_today=$(grep -c "ERROR" "$LOG_DIR/automation.log" 2>/dev/null || echo "0")
    local total_size=$(du -sh "$PROJECT_DIR/screenshots" | cut -f1)
    
    # Create report
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "completed",
  "statistics": {
    "screenshots_captured_today": $screenshots_today,
    "errors_today": $errors_today,
    "total_storage_used": "$total_size",
    "execution_time_seconds": $(($(date +%s) - start_time))
  },
  "system_info": {
    "disk_usage_percent": $(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//'),
    "redis_status": "$(redis-cli ping 2>/dev/null || echo 'DOWN')",
    "node_version": "$(node --version)",
    "memory_usage_mb": $(ps -o rss= -p $$ | awk '{print int($1/1024)}')
  }
}
EOF
    
    log "Report saved to: $report_file"
    
    # Send summary notification
    send_notification "📊 Daily automation completed: $screenshots_today screenshots, $errors_today errors" "success"
}

# Main execution
main() {
    log "=== Starting Ad Screenshot Automation ==="
    log "Script: $0"
    log "Project: $PROJECT_DIR"
    log "PID: $$"
    
    check_lock
    setup_environment
    check_health
    
    local start_time=$(date +%s)
    
    if run_automation; then
        generate_report
        success "=== Automation completed successfully ==="
    else
        error "=== Automation failed ==="
        exit 1
    fi
}

# Run main function
main "$@"