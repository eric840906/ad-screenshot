#!/bin/bash

# System Health Check Script
# Monitors system health and sends alerts when issues are detected

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
HEALTH_FILE="$PROJECT_DIR/health-status.json"

# Load environment variables
source "$PROJECT_DIR/.env" 2>/dev/null || true

# Thresholds (with defaults)
DISK_SPACE_WARNING=${DISK_SPACE_WARNING:-85}
DISK_SPACE_CRITICAL=${DISK_SPACE_CRITICAL:-95}
MEMORY_WARNING=${MEMORY_WARNING:-80}
MEMORY_CRITICAL=${MEMORY_CRITICAL:-90}
LOG_SIZE_WARNING=${LOG_SIZE_WARNING:-100}  # MB
LOG_SIZE_CRITICAL=${LOG_SIZE_CRITICAL:-500}  # MB
HEALTH_CHECK_FAILURES=${HEALTH_CHECK_FAILURES:-3}

# Health status
HEALTH_STATUS="healthy"
HEALTH_MESSAGES=()
WARNINGS=()
ERRORS=()

# Logging functions
log() {
    echo "[$TIMESTAMP] $1" >> "$LOG_DIR/health.log"
}

warning() {
    echo "[$TIMESTAMP] WARNING: $1" >> "$LOG_DIR/health.log"
    WARNINGS+=("$1")
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        HEALTH_STATUS="warning"
    fi
}

error() {
    echo "[$TIMESTAMP] ERROR: $1" >> "$LOG_DIR/health.log"
    ERRORS+=("$1")
    HEALTH_STATUS="critical"
}

# Check disk space
check_disk_space() {
    local usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$usage" -ge "$DISK_SPACE_CRITICAL" ]; then
        error "Disk space critically low: ${usage}%"
    elif [ "$usage" -ge "$DISK_SPACE_WARNING" ]; then
        warning "Disk space high: ${usage}%"
    else
        log "Disk space OK: ${usage}%"
    fi
    
    echo "$usage"
}

# Check memory usage
check_memory_usage() {
    # Get memory usage for the entire system
    local memory_info=$(vm_stat | grep -E "Pages (free|active|inactive|speculative|wired down):")
    local page_size=4096
    
    local free_pages=$(echo "$memory_info" | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
    local active_pages=$(echo "$memory_info" | grep "Pages active" | awk '{print $3}' | sed 's/\.//')
    local inactive_pages=$(echo "$memory_info" | grep "Pages inactive" | awk '{print $3}' | sed 's/\.//')
    local wired_pages=$(echo "$memory_info" | grep "Pages wired down" | awk '{print $4}' | sed 's/\.//')
    
    local total_pages=$((free_pages + active_pages + inactive_pages + wired_pages))
    local used_pages=$((active_pages + inactive_pages + wired_pages))
    local usage_percent=$((used_pages * 100 / total_pages))
    
    if [ "$usage_percent" -ge "$MEMORY_CRITICAL" ]; then
        error "Memory usage critical: ${usage_percent}%"
    elif [ "$usage_percent" -ge "$MEMORY_WARNING" ]; then
        warning "Memory usage high: ${usage_percent}%"
    else
        log "Memory usage OK: ${usage_percent}%"
    fi
    
    echo "$usage_percent"
}

# Check Redis connectivity
check_redis() {
    if redis-cli ping > /dev/null 2>&1; then
        log "Redis connectivity: OK"
        
        # Check Redis memory usage
        local redis_memory=$(redis-cli info memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r\n')
        log "Redis memory usage: $redis_memory"
        
        echo "connected"
    else
        error "Redis is not responding"
        echo "disconnected"
    fi
}

# Check Node.js processes
check_node_processes() {
    local node_processes=$(pgrep -f "node.*ad-screenshot" | wc -l)
    
    if [ "$node_processes" -gt 5 ]; then
        warning "High number of Node.js processes: $node_processes"
    elif [ "$node_processes" -eq 0 ]; then
        log "No active Node.js processes (normal between runs)"
    else
        log "Node.js processes: $node_processes"
    fi
    
    echo "$node_processes"
}

# Check Chrome processes
check_chrome_processes() {
    local chrome_processes=$(pgrep -f "Chrome.*--remote-debugging-port" | wc -l)
    
    if [ "$chrome_processes" -gt 10 ]; then
        warning "High number of Chrome processes: $chrome_processes"
    else
        log "Chrome processes: $chrome_processes"
    fi
    
    echo "$chrome_processes"
}

# Check log file sizes
check_log_sizes() {
    local total_size=0
    local large_logs=()
    
    if [ -d "$LOG_DIR" ]; then
        while IFS= read -r -d '' file; do
            local size=$(du -m "$file" | cut -f1)
            total_size=$((total_size + size))
            
            if [ "$size" -ge "$LOG_SIZE_CRITICAL" ]; then
                error "Log file critically large: $(basename "$file") - ${size}MB"
                large_logs+=("$file")
            elif [ "$size" -ge "$LOG_SIZE_WARNING" ]; then
                warning "Log file large: $(basename "$file") - ${size}MB"
                large_logs+=("$file")
            fi
        done < <(find "$LOG_DIR" -name "*.log" -print0)
    fi
    
    log "Total log size: ${total_size}MB"
    echo "$total_size"
}

# Check file permissions
check_permissions() {
    local permission_errors=0
    
    # Check critical directories
    for dir in "$PROJECT_DIR/screenshots" "$PROJECT_DIR/logs" "$PROJECT_DIR/credentials"; do
        if [ -d "$dir" ]; then
            if [ ! -w "$dir" ]; then
                error "Directory not writable: $dir"
                permission_errors=$((permission_errors + 1))
            fi
        else
            warning "Directory missing: $dir"
        fi
    done
    
    # Check .env file
    if [ -f "$PROJECT_DIR/.env" ]; then
        if [ ! -r "$PROJECT_DIR/.env" ]; then
            error ".env file not readable"
            permission_errors=$((permission_errors + 1))
        fi
    else
        error ".env file missing"
        permission_errors=$((permission_errors + 1))
    fi
    
    if [ "$permission_errors" -eq 0 ]; then
        log "File permissions: OK"
    fi
    
    echo "$permission_errors"
}

# Check Google API connectivity
check_google_apis() {
    if [ "${ENABLE_DRIVE_UPLOAD:-false}" = "true" ]; then
        if [ -f "$PROJECT_DIR/scripts/test-google-apis.js" ]; then
            if timeout 30 node "$PROJECT_DIR/scripts/test-google-apis.js" > /dev/null 2>&1; then
                log "Google APIs: OK"
                echo "connected"
            else
                error "Google APIs not accessible"
                echo "error"
            fi
        else
            warning "Google API test script not found"
            echo "unknown"
        fi
    else
        log "Google Drive upload disabled, skipping API check"
        echo "disabled"
    fi
}

# Send alert notification
send_alert() {
    local severity="$1"
    local message="$2"
    
    # Prepare notification message
    local notification="🔍 Health Check Alert - $severity\n\n$message\n\nTimestamp: $TIMESTAMP"
    
    # Send email notification
    if [ -n "${NOTIFICATION_EMAIL:-}" ] && [ -n "${SMTP_HOST:-}" ]; then
        echo -e "Subject: Ad Screenshot System - Health Alert\nFrom: health-check@ad-screenshot.local\nTo: $NOTIFICATION_EMAIL\n\n$notification" | \
        sendmail "$NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
    
    # Send Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local emoji="⚠️"
        [ "$severity" = "CRITICAL" ] && emoji="🚨"
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji $notification\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Generate health report
generate_health_report() {
    log "Generating health report..."
    
    # Run all health checks
    local disk_usage=$(check_disk_space)
    local memory_usage=$(check_memory_usage)
    local redis_status=$(check_redis)
    local node_processes=$(check_node_processes)
    local chrome_processes=$(check_chrome_processes)
    local log_size=$(check_log_sizes)
    local permission_errors=$(check_permissions)
    local google_api_status=$(check_google_apis)
    
    # Create health report JSON
    cat > "$HEALTH_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "$HEALTH_STATUS",
  "checks": {
    "disk_usage_percent": $disk_usage,
    "memory_usage_percent": $memory_usage,
    "redis_status": "$redis_status",
    "node_processes": $node_processes,
    "chrome_processes": $chrome_processes,
    "log_size_mb": $log_size,
    "permission_errors": $permission_errors,
    "google_api_status": "$google_api_status"
  },
  "warnings": [$(printf '"%s",' "${WARNINGS[@]}" | sed 's/,$//')]],
  "errors": [$(printf '"%s",' "${ERRORS[@]}" | sed 's/,$//')]
}
EOF
    
    # Send alerts if needed
    if [ "$HEALTH_STATUS" = "critical" ]; then
        local error_msg="Critical issues detected:\n$(printf '• %s\n' "${ERRORS[@]}")"
        send_alert "CRITICAL" "$error_msg"
        log "CRITICAL alerts sent"
    elif [ "$HEALTH_STATUS" = "warning" ] && [ ${#WARNINGS[@]} -gt 0 ]; then
        # Only send warning alerts every hour (not every 5 minutes)
        local last_warning_file="$PROJECT_DIR/.last_warning_alert"
        local current_hour=$(date +%Y%m%d%H)
        local last_warning_hour=""
        
        if [ -f "$last_warning_file" ]; then
            last_warning_hour=$(cat "$last_warning_file")
        fi
        
        if [ "$current_hour" != "$last_warning_hour" ]; then
            local warning_msg="Warning issues detected:\n$(printf '• %s\n' "${WARNINGS[@]}")"
            send_alert "WARNING" "$warning_msg"
            echo "$current_hour" > "$last_warning_file"
            log "WARNING alerts sent"
        fi
    fi
    
    log "Health check completed - Status: $HEALTH_STATUS"
}

# Check for consecutive failures
check_failure_threshold() {
    local failure_count_file="$PROJECT_DIR/.health_failure_count"
    local current_failures=0
    
    if [ -f "$failure_count_file" ]; then
        current_failures=$(cat "$failure_count_file")
    fi
    
    if [ "$HEALTH_STATUS" = "critical" ]; then
        current_failures=$((current_failures + 1))
        echo "$current_failures" > "$failure_count_file"
        
        if [ "$current_failures" -ge "$HEALTH_CHECK_FAILURES" ]; then
            send_alert "CRITICAL" "System has failed health checks $current_failures times consecutively. Immediate attention required."
            log "CRITICAL: Failure threshold reached ($current_failures failures)"
        fi
    else
        # Reset failure count on successful check
        echo "0" > "$failure_count_file"
    fi
}

# Main execution
main() {
    # Ensure log directory exists
    mkdir -p "$LOG_DIR"
    
    log "=== Starting Health Check ==="
    
    generate_health_report
    check_failure_threshold
    
    # Exit with appropriate code
    case "$HEALTH_STATUS" in
        "healthy")
            exit 0
            ;;
        "warning")
            exit 1
            ;;
        "critical")
            exit 2
            ;;
        *)
            exit 3
            ;;
    esac
}

# Run main function
main "$@"