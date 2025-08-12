#!/bin/bash

# Log Rotation Script
# Rotates and compresses log files to manage disk space

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Retention periods (in days)
APP_LOG_RETENTION=30
CRON_LOG_RETENTION=7
ERROR_LOG_RETENTION=90
DEBUG_LOG_RETENTION=3
HEALTH_LOG_RETENTION=14

# Logging function
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_DIR/rotation.log"
}

# Rotate a specific log file
rotate_log() {
    local log_file="$1"
    local retention_days="$2"
    local base_name=$(basename "$log_file" .log)
    
    if [ ! -f "$log_file" ]; then
        return 0
    fi
    
    log "Rotating $log_file (retention: $retention_days days)"
    
    # Get current file size
    local file_size=$(stat -f%z "$log_file" 2>/dev/null || echo "0")
    
    # Only rotate if file is not empty
    if [ "$file_size" -eq 0 ]; then
        log "Skipping empty log file: $log_file"
        return 0
    fi
    
    # Create timestamped backup
    local backup_name="${base_name}.$(date +%Y%m%d_%H%M%S).log"
    local backup_path="$LOG_DIR/$backup_name"
    
    # Copy current log to backup
    cp "$log_file" "$backup_path"
    
    # Truncate original log file
    > "$log_file"
    
    # Compress backup
    gzip "$backup_path"
    backup_path="${backup_path}.gz"
    
    log "Created compressed backup: $(basename "$backup_path") ($(du -h "$backup_path" | cut -f1))"
    
    # Remove old backups beyond retention period
    find "$LOG_DIR" -name "${base_name}.*.log.gz" -mtime +$retention_days -delete
    
    local deleted_count=$(find "$LOG_DIR" -name "${base_name}.*.log.gz" -mtime +$retention_days 2>/dev/null | wc -l)
    if [ "$deleted_count" -gt 0 ]; then
        log "Deleted $deleted_count old backup(s) for $base_name"
    fi
}

# Rotate all log files
rotate_all_logs() {
    log "Starting log rotation process..."
    
    # Ensure log directory exists
    mkdir -p "$LOG_DIR"
    
    # Define log files and their retention periods
    declare -A log_files=(
        ["$LOG_DIR/app.log"]="$APP_LOG_RETENTION"
        ["$LOG_DIR/automation.log"]="$APP_LOG_RETENTION"
        ["$LOG_DIR/cron.log"]="$CRON_LOG_RETENTION"
        ["$LOG_DIR/error.log"]="$ERROR_LOG_RETENTION"
        ["$LOG_DIR/debug.log"]="$DEBUG_LOG_RETENTION"
        ["$LOG_DIR/health.log"]="$HEALTH_LOG_RETENTION"
    )
    
    # Rotate each log file
    local total_rotated=0
    local total_size_before=0
    local total_size_after=0
    
    # Calculate total size before rotation
    for log_file in "${!log_files[@]}"; do
        if [ -f "$log_file" ]; then
            local size=$(stat -f%z "$log_file" 2>/dev/null || echo "0")
            total_size_before=$((total_size_before + size))
        fi
    done
    
    # Rotate logs
    for log_file in "${!log_files[@]}"; do
        local retention="${log_files[$log_file]}"
        if rotate_log "$log_file" "$retention"; then
            total_rotated=$((total_rotated + 1))
        fi
    done
    
    # Calculate total size after rotation
    for log_file in "${!log_files[@]}"; do
        if [ -f "$log_file" ]; then
            local size=$(stat -f%z "$log_file" 2>/dev/null || echo "0")
            total_size_after=$((total_size_after + size))
        fi
    done
    
    local size_saved=$((total_size_before - total_size_after))
    local size_saved_mb=$((size_saved / 1024 / 1024))
    
    log "Rotation complete: $total_rotated files rotated, ${size_saved_mb}MB space freed"
}

# Clean up old rotation logs
cleanup_rotation_logs() {
    log "Cleaning up old rotation logs..."
    
    # Keep only last 30 days of rotation logs
    find "$LOG_DIR" -name "rotation.log.*" -mtime +30 -delete
    
    # If rotation.log itself is too large (>50MB), rotate it too
    local rotation_log="$LOG_DIR/rotation.log"
    if [ -f "$rotation_log" ]; then
        local size=$(stat -f%z "$rotation_log" 2>/dev/null || echo "0")
        local size_mb=$((size / 1024 / 1024))
        
        if [ "$size_mb" -gt 50 ]; then
            log "Rotation log is large (${size_mb}MB), rotating it"
            rotate_log "$rotation_log" 30
        fi
    fi
}

# Generate rotation report
generate_rotation_report() {
    log "Generating rotation report..."
    
    local report_file="$LOG_DIR/rotation-report-$(date +%Y%m%d).json"
    
    # Count current log files and their sizes
    local log_count=0
    local total_size=0
    local compressed_count=0
    local compressed_size=0
    
    # Active log files
    for log_file in "$LOG_DIR"/*.log; do
        if [ -f "$log_file" ]; then
            log_count=$((log_count + 1))
            local size=$(stat -f%z "$log_file" 2>/dev/null || echo "0")
            total_size=$((total_size + size))
        fi
    done
    
    # Compressed log files
    for gz_file in "$LOG_DIR"/*.log.gz; do
        if [ -f "$gz_file" ]; then
            compressed_count=$((compressed_count + 1))
            local size=$(stat -f%z "$gz_file" 2>/dev/null || echo "0")
            compressed_size=$((compressed_size + size))
        fi
    done
    
    # Create report
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "rotation_status": "completed",
  "statistics": {
    "active_log_files": $log_count,
    "active_log_size_mb": $((total_size / 1024 / 1024)),
    "compressed_files": $compressed_count,
    "compressed_size_mb": $((compressed_size / 1024 / 1024)),
    "total_log_directory_size_mb": $(du -m "$LOG_DIR" | cut -f1)
  },
  "retention_policies": {
    "app_logs_days": $APP_LOG_RETENTION,
    "cron_logs_days": $CRON_LOG_RETENTION,
    "error_logs_days": $ERROR_LOG_RETENTION,
    "debug_logs_days": $DEBUG_LOG_RETENTION,
    "health_logs_days": $HEALTH_LOG_RETENTION
  }
}
EOF
    
    log "Rotation report saved to: $(basename "$report_file")"
}

# Send notification if disk space is still high after rotation
check_disk_space_after_rotation() {
    local disk_usage=$(df "$PROJECT_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        local message="⚠️ Disk space still high after log rotation: ${disk_usage}%"
        log "$message"
        
        # Send notification if configured
        if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"$message\"}" \
                "$SLACK_WEBHOOK_URL" 2>/dev/null || true
        fi
    else
        log "Disk space after rotation: ${disk_usage}%"
    fi
}

# Optimize log directory
optimize_log_directory() {
    log "Optimizing log directory structure..."
    
    # Create monthly subdirectories for very old compressed logs
    local current_year=$(date +%Y)
    local current_month=$(date +%m)
    
    # Move compressed logs older than 3 months to archive directories
    local archive_date=$(date -v-3m +%Y%m%d 2>/dev/null || date -d "3 months ago" +%Y%m%d)
    
    find "$LOG_DIR" -name "*.log.gz" -type f | while read -r gz_file; do
        local file_date=$(echo "$gz_file" | grep -oE '[0-9]{8}' | head -1)
        
        if [ -n "$file_date" ] && [ "$file_date" -lt "$archive_date" ]; then
            local year=${file_date:0:4}
            local month=${file_date:4:2}
            local archive_dir="$LOG_DIR/archive/$year/$month"
            
            mkdir -p "$archive_dir"
            mv "$gz_file" "$archive_dir/"
            log "Archived old log: $(basename "$gz_file") -> archive/$year/$month/"
        fi
    done
}

# Main execution
main() {
    log "=== Starting Log Rotation ==="
    log "Log directory: $LOG_DIR"
    log "Process ID: $$"
    
    # Load environment if available
    if [ -f "$PROJECT_DIR/.env" ]; then
        source "$PROJECT_DIR/.env" 2>/dev/null || true
    fi
    
    # Perform rotation
    rotate_all_logs
    cleanup_rotation_logs
    optimize_log_directory
    generate_rotation_report
    check_disk_space_after_rotation
    
    log "=== Log Rotation Completed ==="
}

# Run main function
main "$@"