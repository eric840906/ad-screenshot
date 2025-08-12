# Google API Credentials Setup Guide

## Overview

This guide covers setting up Google Drive API and Google Sheets API credentials for the Ad Screenshot Automation System. The system uses these APIs to upload screenshots and manage data in Google Drive/Sheets.

## Prerequisites

- Google Account with access to Google Cloud Console
- Admin access to create service accounts
- Google Drive folder where screenshots will be uploaded

## Step 1: Google Cloud Console Setup

### 1.1 Create or Select a Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Either create a new project or select an existing one
3. Note the Project ID for later use

### 1.2 Enable Required APIs
```bash
# Enable Google Drive API
gcloud services enable drive.googleapis.com

# Enable Google Sheets API (optional)
gcloud services enable sheets.googleapis.com
```

Or enable via Console:
1. Navigate to "APIs & Services" > "Library"
2. Search for "Google Drive API" and enable it
3. Search for "Google Sheets API" and enable it (if needed)

## Step 2: Service Account Creation

### 2.1 Create Service Account
1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Fill in details:
   - **Name**: `ad-screenshot-automation`
   - **Description**: `Service account for automated screenshot uploads`
4. Click "Create and Continue"

### 2.2 Grant Permissions
1. Skip "Grant this service account access to project" (not needed)
2. Click "Continue"

### 2.3 Create and Download Key
1. Click "Create Key"
2. Select "JSON" format
3. Download the key file
4. Rename it to `google-drive-key.json`
5. Move it to `/Users/ericchiu/playground/ad-screenshot/credentials/`

```bash
# Create credentials directory if it doesn't exist
mkdir -p /Users/ericchiu/playground/ad-screenshot/credentials

# Move the downloaded key file
mv ~/Downloads/your-project-xxxxx.json /Users/ericchiu/playground/ad-screenshot/credentials/google-drive-key.json

# Set secure permissions
chmod 600 /Users/ericchiu/playground/ad-screenshot/credentials/google-drive-key.json
```

## Step 3: Google Drive Setup

### 3.1 Create Upload Folder
1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder for screenshots (e.g., "Ad Screenshots")
3. Note the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

### 3.2 Share Folder with Service Account
1. Right-click the folder and select "Share"
2. Add the service account email (found in the JSON key file under `client_email`)
3. Give it "Editor" permissions
4. Click "Send"

### 3.3 Configure Folder Structure (Optional)
The system can automatically create date-based subfolders:
```
Ad Screenshots/
├── 2025/
│   ├── 01/
│   │   ├── 01/  # Daily folders
│   │   └── 02/
│   └── 02/
└── ...
```

## Step 4: Google Sheets Setup (Optional)

### 4.1 Create Tracking Spreadsheet
1. Create a new Google Sheets document
2. Set up columns for tracking:
   - Column A: Timestamp
   - Column B: URL
   - Column C: Device Type
   - Column D: Screenshot Filename
   - Column E: Google Drive Link
   - Column F: Status

### 4.2 Share with Service Account
1. Click "Share" in the top-right
2. Add the service account email
3. Give it "Editor" permissions

### 4.3 Get Spreadsheet ID
Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`

## Step 5: Environment Configuration

### 5.1 Update .env File
```env
# Google Drive Configuration
ENABLE_DRIVE_UPLOAD=true
GOOGLE_DRIVE_KEY_FILE=./credentials/google-drive-key.json
GOOGLE_DRIVE_PARENT_FOLDER=YOUR_FOLDER_ID_HERE

# Google Sheets Configuration (Optional)
GOOGLE_SHEETS_ID=YOUR_SPREADSHEET_ID_HERE
GOOGLE_SHEETS_RANGE=Sheet1!A:Z
```

### 5.2 Validate Configuration
```bash
# Test Google API credentials
node scripts/test-google-apis.js
```

## Step 6: Testing

### 6.1 Test Google Drive Upload
```javascript
// Test script - save as test-drive-upload.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function testDriveUpload() {
  try {
    // Load service account credentials
    const credentials = JSON.parse(
      fs.readFileSync('./credentials/google-drive-key.json', 'utf8')
    );

    // Create authenticated client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Create a test file
    const testContent = 'Test upload from Ad Screenshot Automation';
    const testFile = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFile, testContent);

    // Upload test file
    const response = await drive.files.create({
      requestBody: {
        name: 'test-upload.txt',
        parents: [process.env.GOOGLE_DRIVE_PARENT_FOLDER],
      },
      media: {
        mimeType: 'text/plain',
        body: fs.createReadStream(testFile),
      },
    });

    console.log('✅ Test upload successful:', response.data.id);
    
    // Clean up
    fs.unlinkSync(testFile);
    
    return true;
  } catch (error) {
    console.error('❌ Test upload failed:', error.message);
    return false;
  }
}

testDriveUpload();
```

### 6.2 Test Google Sheets Access
```javascript
// Test script - save as test-sheets-access.js
const { google } = require('googleapis');
const fs = require('fs');

async function testSheetsAccess() {
  try {
    // Load service account credentials
    const credentials = JSON.parse(
      fs.readFileSync('./credentials/google-drive-key.json', 'utf8')
    );

    // Create authenticated client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Test read access
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'A1:E1',
    });

    console.log('✅ Sheets access successful');
    console.log('Data:', response.data.values);
    
    return true;
  } catch (error) {
    console.error('❌ Sheets access failed:', error.message);
    return false;
  }
}

testSheetsAccess();
```

## Step 7: Security Best Practices

### 7.1 Credential Security
```bash
# Ensure credentials are not tracked by git
echo "credentials/" >> .gitignore
echo "*.json" >> .gitignore

# Set restrictive permissions
chmod 600 credentials/google-drive-key.json
chmod 700 credentials/
```

### 7.2 Environment Variables
Instead of hardcoding paths, use environment variables:
```env
GOOGLE_APPLICATION_CREDENTIALS=/Users/ericchiu/playground/ad-screenshot/credentials/google-drive-key.json
```

### 7.3 Rotation Schedule
- Rotate service account keys every 90 days
- Monitor API usage in Google Cloud Console
- Set up alerts for unusual activity

## Troubleshooting

### Common Issues

#### Authentication Errors
```
Error: The caller does not have permission
```
**Solution**: Ensure the service account has been granted access to the Drive folder/Sheets document.

#### File Not Found
```
Error: ENOENT: no such file or directory
```
**Solution**: Verify the path to the credentials file in your .env file.

#### Quota Exceeded
```
Error: Quota exceeded for quota metric 'Queries'
```
**Solution**: Check your quota limits in Google Cloud Console and implement rate limiting.

#### Invalid Credentials
```
Error: invalid_grant
```
**Solution**: Re-download the service account key file, ensure it's valid JSON.

### Debug Commands
```bash
# Check if credentials file exists and is readable
ls -la credentials/google-drive-key.json

# Validate JSON format
cat credentials/google-drive-key.json | python -m json.tool

# Test API connectivity
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  https://www.googleapis.com/drive/v3/about
```

### Logging Configuration
Enable detailed logging for Google API calls:
```env
DEBUG_MODE=true
LOG_LEVEL=debug
GOOGLE_API_DEBUG=true
```

## Advanced Configuration

### Custom Folder Structure
```javascript
// Custom folder organization in UploadService.ts
const folderStructure = {
  year: new Date().getFullYear(),
  month: String(new Date().getMonth() + 1).padStart(2, '0'),
  day: String(new Date().getDate()).padStart(2, '0'),
  device: deviceType.toLowerCase()
};
```

### Batch Operations
For high-volume uploads, implement batch operations:
```javascript
// Batch upload configuration
const batchConfig = {
  maxBatchSize: 100,
  batchTimeoutMs: 30000,
  concurrentBatches: 3
};
```

### Monitoring and Alerts
Set up monitoring for:
- Upload success/failure rates
- API quota usage
- Storage consumption
- Authentication status

This completes the Google API setup. Next, configure cron jobs for automated execution.