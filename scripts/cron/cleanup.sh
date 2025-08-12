#!/bin/bash

# Cleanup Script
# Removes old files and maintains system cleanliness

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    source "$PROJECT_DIR/.env" 2>/dev/null || true
fi

# Cleanup configuration (in days)
SCREENSHOT_RETENTION=${SCREENSHOT_RETENTION:-30}
PROCESSED_DATA_RETENTION=${PROCESSED_DATA_RETENTION:-14}
FAILED_DATA_RETENTION=${FAILED_DATA_RETENTION:-7}
TEMP_FILE_RETENTION=${TEMP_FILE_RETENTION:-1}
BACKUP_RETENTION=${BACKUP_RETENTION:-90}
REPORT_RETENTION=${REPORT_RETENTION:-30}

# Minimum free space required (in MB)
MIN_FREE_SPACE=${MIN_FREE_SPACE:-1024}

# Logging function
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_DIR/cleanup.log"
}

# Get directory size in MB
get_dir_size() {
    local dir="$1"
    if [ -d "$dir" ]; then
        du -m "$dir" 2>/dev/null | tail -1 | cut -f1
    else
        echo "0"
    fi
}

# Get available disk space in MB
get_free_space() {
    df -m "$PROJECT_DIR" | awk 'NR==2 {print $4}'
}

# Clean old screenshots
cleanup_screenshots() {
    log "Cleaning up screenshots older than $SCREENSHOT_RETENTION days..."
    
    local screenshot_dir="$PROJECT_DIR/screenshots"
    if [ ! -d "$screenshot_dir" ]; then
        log "Screenshots directory not found, skipping"
        return 0
    fi
    
    local before_size=$(get_dir_size "$screenshot_dir")
    local files_deleted=0
    
    # Find and delete old screenshot files
    find "$screenshot_dir" -name "*.png" -type f -mtime +$SCREENSHOT_RETENTION -print0 | \
    while IFS= read -r -d '' file; do
        rm -f "$file"
        files_deleted=$((files_deleted + 1))
    done
    
    # Clean up empty directories
    find "$screenshot_dir" -type d -empty -delete 2>/dev/null || true
    
    local after_size=$(get_dir_size "$screenshot_dir")
    local space_freed=$((before_size - after_size))
    
    log "Screenshots cleanup: ${files_deleted} files deleted, ${space_freed}MB freed"
}

# Clean processed data
cleanup_processed_data() {
    log "Cleaning up processed data older than $PROCESSED_DATA_RETENTION days..."
    
    local processed_dir="$PROJECT_DIR/data/processed"
    if [ ! -d "$processed_dir" ]; then
        log "Processed data directory not found, skipping"
        return 0
    fi
    
    local before_size=$(get_dir_size "$processed_dir")
    local files_deleted=0
    
    find "$processed_dir" -type f -mtime +$PROCESSED_DATA_RETENTION -print0 | \
    while IFS= read -r -d '' file; do
        rm -f "$file"
        files_deleted=$((files_deleted + 1))
    done
    
    local after_size=$(get_dir_size "$processed_dir")
    local space_freed=$((before_size - after_size))
    
    log "Processed data cleanup: ${files_deleted} files deleted, ${space_freed}MB freed"
}

# Clean failed data
cleanup_failed_data() {
    log "Cleaning up failed data older than $FAILED_DATA_RETENTION days..."
    
    local failed_dir="$PROJECT_DIR/data/failed"
    if [ ! -d "$failed_dir" ]; then
        log "Failed data directory not found, skipping"
        return 0
    fi
    
    local before_size=$(get_dir_size "$failed_dir")
    local files_deleted=0
    
    find "$failed_dir" -type f -mtime +$FAILED_DATA_RETENTION -print0 | \
    while IFS= read -r -d '' file; do
        rm -f "$file"
        files_deleted=$((files_deleted + 1))
    done
    
    local after_size=$(get_dir_size "$failed_dir")
    local space_freed=$((before_size - after_size))
    
    log "Failed data cleanup: ${files_deleted} files deleted, ${space_freed}MB freed"
}

# Clean temporary files
cleanup_temp_files() {
    log "Cleaning up temporary files older than $TEMP_FILE_RETENTION day(s)..."
    
    local files_deleted=0
    local space_freed=0
    
    # Clean temp files in project directory
    find "$PROJECT_DIR" -name "*.tmp" -type f -mtime +$TEMP_FILE_RETENTION -print0 | \
    while IFS= read -r -d '' file; do
        local size=$(stat -f%z "$file" 2>/dev/null || echo "0")
        rm -f "$file"
        files_deleted=$((files_deleted + 1))
        space_freed=$((space_freed + size))
    done
    
    # Clean other temporary patterns
    local temp_patterns=("*.temp" "*.bak" "*~" ".DS_Store" "Thumbs.db")
    for pattern in "${temp_patterns[@]}"; do
        find "$PROJECT_DIR" -name "$pattern" -type f -mtime +$TEMP_FILE_RETENTION -delete 2>/dev/null || true
    done
    
    # Clean Chrome temp files
    find "$PROJECT_DIR" -path "*/chrome-temp-*" -type d -mtime +1 -exec rm -rf {} + 2>/dev/null || true
    
    local space_freed_mb=$((space_freed / 1024 / 1024))
    log "Temporary files cleanup: ${files_deleted} files deleted, ${space_freed_mb}MB freed"
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $BACKUP_RETENTION days..."
    
    local backup_dir="$PROJECT_DIR/backups"
    if [ ! -d "$backup_dir" ]; then
        log "Backup directory not found, skipping"
        return 0
    fi
    
    local before_size=$(get_dir_size "$backup_dir")
    local files_deleted=0
    
    find "$backup_dir" -type f -mtime +$BACKUP_RETENTION -print0 | \
    while IFS= read -r -d '' file; do
        rm -f "$file"
        files_deleted=$((files_deleted + 1))
    done
    
    # Clean empty backup directories
    find "$backup_dir" -type d -empty -delete 2>/dev/null || true
    
    local after_size=$(get_dir_size "$backup_dir")
    local space_freed=$((before_size - after_size))
    
    log "Backup cleanup: ${files_deleted} files deleted, ${space_freed}MB freed"
}

# Clean old reports
cleanup_old_reports() {
    log "Cleaning up reports older than $REPORT_RETENTION days..."
    
    local files_deleted=0
    local space_freed=0
    
    # Clean various report files
    local report_patterns=("*-report-*.json" "*-stats-*.json" "health-status-*.json")
    
    for pattern in "${report_patterns[@]}"; do
        find "$PROJECT_DIR" -name "$pattern" -type f -mtime +$REPORT_RETENTION -print0 | \
        while IFS= read -r -d '' file; do
            local size=$(stat -f%z "$file" 2>/dev/null || echo "0")
            rm -f "$file"
            files_deleted=$((files_deleted + 1))
            space_freed=$((space_freed + size))
        done
    done
    
    local space_freed_mb=$((space_freed / 1024 / 1024))
    log "Reports cleanup: ${files_deleted} files deleted, ${space_freed_mb}MB freed"
}

# Clean Redis data (if needed)
cleanup_redis_data() {
    log "Checking Redis data cleanup needs..."
    
    if ! redis-cli ping > /dev/null 2>&1; then
        log "Redis not accessible, skipping Redis cleanup"
        return 0
    fi
    
    # Get Redis memory usage
    local redis_memory=$(redis-cli info memory | grep "used_memory:" | cut -d: -f2 | tr -d '\r\n')
    local redis_memory_mb=$((redis_memory / 1024 / 1024))
    
    log "Redis memory usage: ${redis_memory_mb}MB"
    
    # Clean expired keys if memory usage is high
    if [ "$redis_memory_mb" -gt 256 ]; then
        log "Redis memory high, cleaning expired keys..."
        
        # Get count of keys before cleanup
        local keys_before=$(redis-cli dbsize | cut -d' ' -f1)
        
        # Force expire cleanup
        redis-cli --latency-history -i 1 | head -1 > /dev/null &
        local latency_pid=$!
        sleep 2
        kill $latency_pid 2>/dev/null || true
        
        # Get count after
        local keys_after=$(redis-cli dbsize | cut -d' ' -f1)
        local keys_cleaned=$((keys_before - keys_after))
        
        log "Redis cleanup: ${keys_cleaned} expired keys removed"
    fi
}

# Emergency cleanup if disk space is critically low
emergency_cleanup() {
    local free_space=$(get_free_space)
    
    if [ "$free_space" -lt "$MIN_FREE_SPACE" ]; then
        log "WARNING: Disk space critically low (${free_space}MB), performing emergency cleanup..."
        
        # More aggressive cleanup
        local emergency_retention=$((SCREENSHOT_RETENTION / 2))
        if [ "$emergency_retention" -lt 7 ]; then
            emergency_retention=7
        fi
        
        log "Emergency: Cleaning screenshots older than $emergency_retention days"
        find "$PROJECT_DIR/screenshots" -name "*.png" -type f -mtime +$emergency_retention -delete 2>/dev/null || true
        
        # Clean processed data more aggressively
        local emergency_processed_retention=$((PROCESSED_DATA_RETENTION / 2))
        if [ "$emergency_processed_retention" -lt 3 ]; then
            emergency_processed_retention=3
        fi
        
        log "Emergency: Cleaning processed data older than $emergency_processed_retention days"
        find "$PROJECT_DIR/data/processed" -type f -mtime +$emergency_processed_retention -delete 2>/dev/null || true
        
        # Force Redis memory cleanup
        if redis-cli ping > /dev/null 2>&1; then
            log "Emergency: Flushing Redis expired keys"
            redis-cli eval "return redis.call('del', unpack(redis.call('keys', '*')))" 0 2>/dev/null || true
        fi
        
        local new_free_space=$(get_free_space)
        local space_recovered=$((new_free_space - free_space))
        log "Emergency cleanup completed: ${space_recovered}MB recovered"
        
        # Send critical alert
        send_critical_alert "Emergency cleanup performed due to low disk space"
    fi
}

# Send critical alert
send_critical_alert() {
    local message="$1"
    
    log "CRITICAL: $message"
    
    # Send Slack notification if configured
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 CRITICAL: $message\n\nTimestamp: $TIMESTAMP\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Send email notification if configured
    if [ -n "${NOTIFICATION_EMAIL:-}" ] && [ -n "${SMTP_HOST:-}" ]; then
        echo -e "Subject: CRITICAL ALERT - Ad Screenshot System\nFrom: cleanup@ad-screenshot.local\nTo: $NOTIFICATION_EMAIL\n\n$message\n\nTimestamp: $TIMESTAMP" | \
        sendmail "$NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
}

# Generate cleanup report
generate_cleanup_report() {
    log "Generating cleanup report..."
    
    local report_file="$LOG_DIR/cleanup-report-$(date +%Y%m%d).json"
    
    # Get current disk usage
    local free_space=$(get_free_space)
    local total_space=$(df -m "$PROJECT_DIR" | awk 'NR==2 {print $2}')
    local used_space=$((total_space - free_space))
    local usage_percent=$((used_space * 100 / total_space))
    
    # Get directory sizes
    local screenshot_size=$(get_dir_size "$PROJECT_DIR/screenshots")
    local logs_size=$(get_dir_size "$LOG_DIR")
    local data_size=$(get_dir_size "$PROJECT_DIR/data")
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "cleanup_status": "completed",
  "disk_usage": {
    "total_space_mb": $total_space,
    "used_space_mb": $used_space,
    "free_space_mb": $free_space,
    "usage_percent": $usage_percent
  },
  "directory_sizes": {
    "screenshots_mb": $screenshot_size,
    "logs_mb": $logs_size,
    "data_mb": $data_size
  },
  "retention_policies": {
    "screenshots_days": $SCREENSHOT_RETENTION,
    "processed_data_days": $PROCESSED_DATA_RETENTION,
    "failed_data_days": $FAILED_DATA_RETENTION,
    "temp_files_days": $TEMP_FILE_RETENTION,
    "backups_days": $BACKUP_RETENTION,
    "reports_days": $REPORT_RETENTION
  }
}
EOF
    
    log "Cleanup report saved to: $(basename "$report_file")"
}

# Main execution
main() {
    log "=== Starting System Cleanup ==="
    log "Project directory: $PROJECT_DIR"
    log "Process ID: $$"
    
    # Get initial disk usage
    local initial_free_space=$(get_free_space)
    log "Initial free space: ${initial_free_space}MB"
    
    # Perform cleanup tasks
    cleanup_screenshots
    cleanup_processed_data
    cleanup_failed_data
    cleanup_temp_files
    cleanup_old_backups
    cleanup_old_reports
    cleanup_redis_data
    
    # Check if emergency cleanup is needed
    emergency_cleanup
    
    # Get final disk usage
    local final_free_space=$(get_free_space)
    local space_recovered=$((final_free_space - initial_free_space))
    
    log "Cleanup completed: ${space_recovered}MB space recovered"
    log "Final free space: ${final_free_space}MB"
    
    # Generate report
    generate_cleanup_report
    
    # Send success notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🧹 Weekly cleanup completed: ${space_recovered}MB freed, ${final_free_space}MB available\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    log "=== System Cleanup Completed ==="
}

# Run main function
main "$@"