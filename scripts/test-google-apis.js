#!/usr/bin/env node

/**
 * Google APIs Test Script
 * Tests Google Drive and Google Sheets API connectivity and permissions
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class GoogleAPITester {
  constructor() {
    this.credentialsPath = process.env.GOOGLE_DRIVE_KEY_FILE || './credentials/google-drive-key.json';
    this.parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER;
    this.sheetsId = process.env.GOOGLE_SHEETS_ID;
    this.errors = [];
    this.successes = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (type === 'error') {
      this.errors.push(message);
    } else if (type === 'success') {
      this.successes.push(message);
    }
  }

  async loadCredentials() {
    try {
      if (!fs.existsSync(this.credentialsPath)) {
        throw new Error(`Credentials file not found: ${this.credentialsPath}`);
      }

      const credentialsContent = fs.readFileSync(this.credentialsPath, 'utf8');
      const credentials = JSON.parse(credentialsContent);
      
      this.log('Credentials file loaded successfully', 'success');
      this.log(`Service account email: ${credentials.client_email}`, 'info');
      
      return credentials;
    } catch (error) {
      this.log(`Failed to load credentials: ${error.message}`, 'error');
      throw error;
    }
  }

  async createAuthClient(scopes) {
    try {
      const credentials = await this.loadCredentials();
      
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes,
      });

      const authClient = await auth.getClient();
      this.log('Google Auth client created successfully', 'success');
      
      return authClient;
    } catch (error) {
      this.log(`Failed to create auth client: ${error.message}`, 'error');
      throw error;
    }
  }

  async testDriveAPI() {
    this.log('Testing Google Drive API...', 'info');
    
    try {
      const auth = await this.createAuthClient(['https://www.googleapis.com/auth/drive.file']);
      const drive = google.drive({ version: 'v3', auth });

      // Test 1: List files in root (basic API access test)
      this.log('Test 1: Basic API access...', 'info');
      const listResponse = await drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)',
      });
      this.log('Basic API access successful', 'success');

      // Test 2: Check parent folder access
      if (this.parentFolderId) {
        this.log('Test 2: Parent folder access...', 'info');
        try {
          const folderResponse = await drive.files.get({
            fileId: this.parentFolderId,
            fields: 'id, name, permissions',
          });
          this.log(`Parent folder accessible: ${folderResponse.data.name}`, 'success');
        } catch (folderError) {
          this.log(`Parent folder not accessible: ${folderError.message}`, 'error');
        }
      } else {
        this.log('No parent folder ID configured, skipping folder access test', 'info');
      }

      // Test 3: Create test file
      this.log('Test 3: File creation...', 'info');
      const testContent = JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Google Drive API test successful'
      }, null, 2);

      const tempFile = path.join(__dirname, 'temp-test-file.json');
      fs.writeFileSync(tempFile, testContent);

      const uploadResponse = await drive.files.create({
        requestBody: {
          name: `api-test-${Date.now()}.json`,
          parents: this.parentFolderId ? [this.parentFolderId] : undefined,
        },
        media: {
          mimeType: 'application/json',
          body: fs.createReadStream(tempFile),
        },
      });

      this.log(`Test file created successfully: ${uploadResponse.data.id}`, 'success');

      // Test 4: Get shareable link
      const linkResponse = await drive.files.get({
        fileId: uploadResponse.data.id,
        fields: 'webViewLink, webContentLink',
      });
      this.log(`File link: ${linkResponse.data.webViewLink}`, 'info');

      // Test 5: Delete test file
      await drive.files.delete({
        fileId: uploadResponse.data.id,
      });
      this.log('Test file deleted successfully', 'success');

      // Clean up temp file
      fs.unlinkSync(tempFile);

      return true;
    } catch (error) {
      this.log(`Google Drive API test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testSheetsAPI() {
    this.log('Testing Google Sheets API...', 'info');

    if (!this.sheetsId) {
      this.log('No Google Sheets ID configured, skipping Sheets API test', 'info');
      return true;
    }

    try {
      const auth = await this.createAuthClient(['https://www.googleapis.com/auth/spreadsheets']);
      const sheets = google.sheets({ version: 'v4', auth });

      // Test 1: Get spreadsheet metadata
      this.log('Test 1: Spreadsheet access...', 'info');
      const spreadsheetResponse = await sheets.spreadsheets.get({
        spreadsheetId: this.sheetsId,
        fields: 'properties.title, sheets.properties.title',
      });
      
      this.log(`Spreadsheet accessible: ${spreadsheetResponse.data.properties.title}`, 'success');
      this.log(`Available sheets: ${spreadsheetResponse.data.sheets.map(s => s.properties.title).join(', ')}`, 'info');

      // Test 2: Read data
      this.log('Test 2: Reading data...', 'info');
      const readResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'A1:E1',
      });
      
      if (readResponse.data.values && readResponse.data.values.length > 0) {
        this.log(`Data read successfully: ${readResponse.data.values[0].length} columns`, 'success');
      } else {
        this.log('No data found in range A1:E1', 'info');
      }

      // Test 3: Write test data
      this.log('Test 3: Writing test data...', 'info');
      const testRow = [
        new Date().toISOString(),
        'https://example.com',
        'API Test',
        'test-screenshot.png',
        'Test Status'
      ];

      const writeResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetsId,
        range: 'A:E',
        valueInputOption: 'RAW',
        requestBody: {
          values: [testRow],
        },
      });

      this.log(`Test data written successfully to row ${writeResponse.data.updates.updatedRange}`, 'success');

      return true;
    } catch (error) {
      this.log(`Google Sheets API test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testQuotas() {
    this.log('Testing API quotas and limits...', 'info');
    
    try {
      const auth = await this.createAuthClient(['https://www.googleapis.com/auth/drive.metadata.readonly']);
      const drive = google.drive({ version: 'v3', auth });

      // Test quota by making multiple requests
      const startTime = Date.now();
      const requests = [];
      
      for (let i = 0; i < 5; i++) {
        requests.push(drive.files.list({ pageSize: 1 }));
      }

      await Promise.all(requests);
      const endTime = Date.now();
      
      this.log(`5 concurrent requests completed in ${endTime - startTime}ms`, 'success');
      this.log('API quota limits appear normal', 'success');
      
      return true;
    } catch (error) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        this.log(`Quota/rate limit issue detected: ${error.message}`, 'error');
      } else {
        this.log(`Quota test failed: ${error.message}`, 'error');
      }
      return false;
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('GOOGLE APIS TEST REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n✅ Successful tests: ${this.successes.length}`);
    console.log(`❌ Failed tests: ${this.errors.length}`);

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('\n📋 CONFIGURATION STATUS:');
    console.log(`   - Credentials file: ${fs.existsSync(this.credentialsPath) ? '✅' : '❌'} ${this.credentialsPath}`);
    console.log(`   - Parent folder ID: ${this.parentFolderId ? '✅' : '❌'} ${this.parentFolderId || 'Not configured'}`);
    console.log(`   - Sheets ID: ${this.sheetsId ? '✅' : '❌'} ${this.sheetsId || 'Not configured'}`);

    console.log('\n' + '='.repeat(80));
    
    if (this.errors.length === 0) {
      console.log('🎉 All Google API tests passed! APIs are ready for use.');
      return true;
    } else {
      console.log('❌ Some Google API tests failed. Please review and fix the issues above.');
      return false;
    }
  }

  async runAllTests() {
    console.log('Starting Google APIs validation...\n');

    try {
      const driveSuccess = await this.testDriveAPI();
      const sheetsSuccess = await this.testSheetsAPI();
      const quotaSuccess = await this.testQuotas();

      return this.generateReport();
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
      this.generateReport();
      return false;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new GoogleAPITester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = GoogleAPITester;