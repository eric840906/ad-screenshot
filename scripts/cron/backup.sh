#!/bin/bash

# Backup Script
# Creates backups of configuration, logs, and critical data

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
BACKUP_DATE=$(date '+%Y%m%d_%H%M%S')

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    source "$PROJECT_DIR/.env" 2>/dev/null || true
fi

# Backup configuration
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION:-90}
COMPRESS_BACKUPS=${COMPRESS_BACKUPS:-true}
ENCRYPT_BACKUPS=${ENCRYPT_BACKUPS:-false}
BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-}

# Logging function
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_DIR/backup.log"
}

# Create backup directory structure
create_backup_structure() {
    log "Creating backup directory structure..."
    
    local backup_root="$BACKUP_DIR/$BACKUP_DATE"
    mkdir -p "$backup_root"/{config,logs,data,scripts,credentials}
    
    echo "$backup_root"
}

# Backup configuration files
backup_configuration() {
    local backup_root="$1"
    local config_backup="$backup_root/config"
    
    log "Backing up configuration files..."
    
    # Critical configuration files
    local config_files=(
        ".env"
        ".env.example"
        "package.json"
        "package-lock.json"
        "tsconfig.json"
        "jest.config.js"
    )
    
    local files_backed_up=0
    for file in "${config_files[@]}"; do
        if [ -f "$PROJECT_DIR/$file" ]; then
            cp "$PROJECT_DIR/$file" "$config_backup/"
            files_backed_up=$((files_backed_up + 1))
        fi
    done
    
    # Backup source configuration
    if [ -d "$PROJECT_DIR/src/config" ]; then
        cp -r "$PROJECT_DIR/src/config" "$config_backup/src-config"
        files_backed_up=$((files_backed_up + 1))
    fi
    
    log "Configuration backup: $files_backed_up files backed up"
}

# Backup recent logs
backup_logs() {
    local backup_root="$1"
    local logs_backup="$backup_root/logs"
    
    log "Backing up recent logs..."
    
    local files_backed_up=0
    local total_size=0
    
    # Backup logs from last 7 days
    find "$LOG_DIR" -name "*.log" -mtime -7 -type f | while read -r log_file; do
        if [ -f "$log_file" ]; then
            cp "$log_file" "$logs_backup/"
            files_backed_up=$((files_backed_up + 1))
            local size=$(stat -f%z "$log_file" 2>/dev/null || echo "0")
            total_size=$((total_size + size))
        fi
    done
    
    # Backup compressed logs from last 30 days
    find "$LOG_DIR" -name "*.log.gz" -mtime -30 -type f | while read -r gz_file; do
        if [ -f "$gz_file" ]; then
            cp "$gz_file" "$logs_backup/"
            files_backed_up=$((files_backed_up + 1))
        fi
    done
    
    local size_mb=$((total_size / 1024 / 1024))
    log "Logs backup: $files_backed_up files backed up (${size_mb}MB)"
}

# Backup critical data
backup_data() {
    local backup_root="$1"
    local data_backup="$backup_root/data"
    
    log "Backing up critical data..."
    
    local files_backed_up=0
    
    # Backup sample data
    if [ -d "$PROJECT_DIR/data" ]; then
        # Backup configuration and sample files
        find "$PROJECT_DIR/data" -name "*.csv" -o -name "*.json" -o -name "*.txt" | while read -r data_file; do
            if [ -f "$data_file" ]; then
                local rel_path="${data_file#$PROJECT_DIR/data/}"
                local backup_path="$data_backup/$(dirname "$rel_path")"
                mkdir -p "$backup_path"
                cp "$data_file" "$backup_path/"
                files_backed_up=$((files_backed_up + 1))
            fi
        done
    fi
    
    # Backup recent processing statistics
    if [ -f "$PROJECT_DIR/health-status.json" ]; then
        cp "$PROJECT_DIR/health-status.json" "$data_backup/"
        files_backed_up=$((files_backed_up + 1))
    fi
    
    # Backup recent reports (last 7 days)
    find "$PROJECT_DIR" -name "*-report-*.json" -mtime -7 -type f | while read -r report_file; do
        if [ -f "$report_file" ]; then
            cp "$report_file" "$data_backup/"
            files_backed_up=$((files_backed_up + 1))
        fi
    done
    
    log "Data backup: $files_backed_up files backed up"
}

# Backup scripts
backup_scripts() {
    local backup_root="$1"
    local scripts_backup="$backup_root/scripts"
    
    log "Backing up scripts..."
    
    if [ -d "$PROJECT_DIR/scripts" ]; then
        cp -r "$PROJECT_DIR/scripts" "$scripts_backup/"
        local script_count=$(find "$scripts_backup" -name "*.js" -o -name "*.sh" | wc -l)
        log "Scripts backup: $script_count scripts backed up"
    else
        log "Scripts directory not found, skipping"
    fi
}

# Backup credentials (encrypted)
backup_credentials() {
    local backup_root="$1"
    local credentials_backup="$backup_root/credentials"
    
    log "Backing up credentials..."
    
    if [ ! -d "$PROJECT_DIR/credentials" ]; then
        log "Credentials directory not found, skipping"
        return 0
    fi
    
    local files_backed_up=0
    
    # Only backup if encryption is enabled
    if [ "$ENCRYPT_BACKUPS" = "true" ] && [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
        find "$PROJECT_DIR/credentials" -name "*.json" -type f | while read -r cred_file; do
            if [ -f "$cred_file" ]; then
                local filename=$(basename "$cred_file")
                local encrypted_file="$credentials_backup/${filename}.enc"
                
                # Encrypt the credential file
                openssl enc -aes-256-cbc -salt -in "$cred_file" -out "$encrypted_file" -k "$BACKUP_ENCRYPTION_KEY" 2>/dev/null
                
                if [ -f "$encrypted_file" ]; then
                    files_backed_up=$((files_backed_up + 1))
                    log "Encrypted credential file: $filename"
                fi
            fi
        done
    else
        log "Credential backup skipped (encryption not configured)"
    fi
    
    log "Credentials backup: $files_backed_up files backed up (encrypted)"
}

# Compress backup
compress_backup() {
    local backup_root="$1"
    
    if [ "$COMPRESS_BACKUPS" != "true" ]; then
        log "Compression disabled, skipping"
        return 0
    fi
    
    log "Compressing backup..."
    
    local backup_name=$(basename "$backup_root")
    local compressed_file="$BACKUP_DIR/${backup_name}.tar.gz"
    
    # Create compressed archive
    tar -czf "$compressed_file" -C "$BACKUP_DIR" "$backup_name"
    
    if [ -f "$compressed_file" ]; then
        local original_size=$(du -m "$backup_root" | cut -f1)
        local compressed_size=$(du -m "$compressed_file" | cut -f1)
        local compression_ratio=$((100 - (compressed_size * 100 / original_size)))
        
        # Remove uncompressed directory
        rm -rf "$backup_root"
        
        log "Backup compressed: ${original_size}MB -> ${compressed_size}MB (${compression_ratio}% compression)"
        echo "$compressed_file"
    else
        log "Compression failed"
        echo "$backup_root"
    fi
}

# Upload to Google Drive (if enabled)
upload_to_google_drive() {
    local backup_file="$1"
    
    if [ "${ENABLE_DRIVE_UPLOAD:-false}" != "true" ]; then
        log "Google Drive upload disabled, skipping"
        return 0
    fi
    
    if [ ! -f "$PROJECT_DIR/scripts/upload-to-drive.js" ]; then
        log "Google Drive upload script not found, creating basic version"
        create_drive_upload_script
    fi
    
    log "Uploading backup to Google Drive..."
    
    # Upload using Node.js script
    if node "$PROJECT_DIR/scripts/upload-to-drive.js" "$backup_file" "backups" 2>/dev/null; then
        log "Backup uploaded to Google Drive successfully"
    else
        log "Google Drive upload failed"
    fi
}

# Create basic Google Drive upload script
create_drive_upload_script() {
    local upload_script="$PROJECT_DIR/scripts/upload-to-drive.js"
    
    cat > "$upload_script" << 'EOF'
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function uploadFile(filePath, parentFolderName = 'backups') {
    try {
        const credentials = JSON.parse(
            fs.readFileSync(process.env.GOOGLE_DRIVE_KEY_FILE, 'utf8')
        );

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });
        const fileName = path.basename(filePath);

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: process.env.GOOGLE_DRIVE_PARENT_FOLDER ? [process.env.GOOGLE_DRIVE_PARENT_FOLDER] : undefined,
            },
            media: {
                mimeType: 'application/gzip',
                body: fs.createReadStream(filePath),
            },
        });

        console.log('Uploaded:', response.data.id);
        return true;
    } catch (error) {
        console.error('Upload failed:', error.message);
        return false;
    }
}

const filePath = process.argv[2];
const folderName = process.argv[3] || 'backups';

if (!filePath) {
    console.error('Usage: node upload-to-drive.js <file-path> [folder-name]');
    process.exit(1);
}

uploadFile(filePath, folderName).then(success => {
    process.exit(success ? 0 : 1);
});
EOF
    
    chmod +x "$upload_script"
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    local deleted_count=0
    local space_freed=0
    
    # Delete backups older than retention period
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$BACKUP_RETENTION_DAYS -type f | while read -r old_backup; do
        if [ -f "$old_backup" ]; then
            local size=$(stat -f%z "$old_backup" 2>/dev/null || echo "0")
            rm -f "$old_backup"
            deleted_count=$((deleted_count + 1))
            space_freed=$((space_freed + size))
        fi
    done
    
    # Also clean uncompressed directories older than 1 day
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" -mtime +1 -exec rm -rf {} + 2>/dev/null || true
    
    local space_freed_mb=$((space_freed / 1024 / 1024))
    log "Old backups cleanup: $deleted_count backups deleted, ${space_freed_mb}MB freed"
}

# Generate backup report
generate_backup_report() {
    local backup_file="$1"
    
    log "Generating backup report..."
    
    local report_file="$LOG_DIR/backup-report-$(date +%Y%m%d).json"
    local backup_size=0
    
    if [ -f "$backup_file" ]; then
        backup_size=$(stat -f%z "$backup_file" 2>/dev/null || echo "0")
    fi
    
    local backup_size_mb=$((backup_size / 1024 / 1024))
    local total_backups=$(find "$BACKUP_DIR" -name "*.tar.gz" -type f | wc -l)
    local total_backup_size=$(du -m "$BACKUP_DIR" | cut -f1)
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "backup_status": "completed",
  "backup_file": "$(basename "$backup_file")",
  "backup_size_mb": $backup_size_mb,
  "statistics": {
    "total_backups": $total_backups,
    "total_backup_size_mb": $total_backup_size,
    "retention_days": $BACKUP_RETENTION_DAYS,
    "compression_enabled": $COMPRESS_BACKUPS,
    "encryption_enabled": $ENCRYPT_BACKUPS,
    "google_drive_upload": "${ENABLE_DRIVE_UPLOAD:-false}"
  }
}
EOF
    
    log "Backup report saved to: $(basename "$report_file")"
}

# Send notification
send_notification() {
    local message="$1"
    local type="${2:-info}"
    
    # Send Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local emoji="💾"
        [ "$type" = "error" ] && emoji="❌"
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji $message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main execution
main() {
    log "=== Starting Backup Process ==="
    log "Backup directory: $BACKUP_DIR"
    log "Process ID: $$"
    
    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"
    
    # Create backup structure
    local backup_root=$(create_backup_structure)
    log "Backup root: $backup_root"
    
    # Perform backups
    backup_configuration "$backup_root"
    backup_logs "$backup_root"
    backup_data "$backup_root"
    backup_scripts "$backup_root"
    backup_credentials "$backup_root"
    
    # Compress backup
    local final_backup=$(compress_backup "$backup_root")
    
    # Upload to Google Drive if enabled
    upload_to_google_drive "$final_backup"
    
    # Clean old backups
    cleanup_old_backups
    
    # Generate report
    generate_backup_report "$final_backup"
    
    # Get final backup size
    local backup_size_mb=0
    if [ -f "$final_backup" ]; then
        local backup_size=$(stat -f%z "$final_backup" 2>/dev/null || echo "0")
        backup_size_mb=$((backup_size / 1024 / 1024))
    fi
    
    log "Backup completed: $(basename "$final_backup") (${backup_size_mb}MB)"
    
    # Send success notification
    send_notification "📦 Daily backup completed: ${backup_size_mb}MB backup created"
    
    log "=== Backup Process Completed ==="
}

# Run main function
main "$@"