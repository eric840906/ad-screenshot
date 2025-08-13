# Enhanced Chrome Extension Setup Guide

## 🚀 Overview

The enhanced Chrome extension combines your original mobile screenshot tool with advanced automation features for the AD543 system. This creates a powerful platform for automated mobile ad testing with professional UI overlays.

## 📦 What's Enhanced

### Original Features (Preserved)
✅ **Mobile UI Overlays**: iOS and Android status bars and navigation  
✅ **High-Quality Screenshots**: Retina display support and proper scaling  
✅ **Device Emulation**: Professional mobile UI simulation  
✅ **Manual Controls**: Time, URL, device type configuration  

### New Automation Features
🔥 **AD543 Integration**: Automatic coordination with AD543 bookmarklet  
🔥 **Batch Processing**: Process multiple screenshots without manual intervention  
🔥 **Background Communication**: WebSocket bridge for automation control  
🔥 **Content Script Monitoring**: Real-time AD543 status detection  
🔥 **Programmatic Control**: API for automated screenshot capture  
🔥 **Error Handling**: Robust retry logic and fallback mechanisms  

## 🛠️ Installation Steps

### Step 1: Load Enhanced Extension

1. **Open Chrome Extension Management**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load Enhanced Extension**
   - Click "Load unpacked"
   - Navigate to: `/Users/ericchiu/playground/ad-screenshot/extensions/enhanced-screenshot-extension/`
   - Click "Select Folder"

4. **Verify Installation**
   - Extension should appear with title: "AD543 Screenshot & Filter Tool - Enhanced"
   - Version: 2.0
   - Status: Enabled

### Step 2: Configure Extension Permissions

The enhanced extension requires these permissions:
- ✅ **activeTab**: Capture current tab screenshots  
- ✅ **storage**: Save automation configurations  
- ✅ **tabs**: Access tab information and create background tabs  
- ✅ **desktopCapture**: High-quality screenshot capture  
- ✅ **scripting**: Execute automation scripts  
- ✅ **host_permissions**: Access to websites for automation  

### Step 3: Test Extension Functionality

1. **Manual Mode Test**
   - Click extension icon in toolbar
   - Select iOS or Android
   - Set time (e.g., "14:30")
   - Click camera button
   - Should open new tab with mobile screenshot

2. **Automation Mode Test**
   - Run: `npm start --csv data/sample-ads.csv`
   - Extension should automatically:
     - Configure mobile UI based on DeviceUI column
     - Capture screenshots with overlays
     - Process batch without manual intervention

## 🔧 Extension Architecture

### File Structure
```
enhanced-screenshot-extension/
├── manifest.json           # Enhanced manifest with automation support
├── background.js           # Background script for automation API
├── content.js             # Content script for AD543 monitoring
├── main.js                # Enhanced popup script with automation hooks
├── popup.html             # UI popup (unchanged)
├── main.css               # Styling (unchanged)
├── html2canvas.min.js     # Screenshot generation library
├── icon.png               # Extension icon
├── UI/                    # UI assets (camera, device icons)
├── androidIcons/          # Android UI elements
└── iOSIcons/             # iOS UI elements
```

### Communication Flow
```
Automation System ←→ Background Script ←→ Content Script ←→ AD543 Bookmarklet
                                     ↓
                   Popup Script ←→ Screenshot Capture
```

## 🎯 Integration with AD543 System

### Automatic Screenshot Workflow

1. **AD543 Injection**: System injects ads using your bookmarklet
2. **Content Monitoring**: Content script detects AD543 activity
3. **Configuration**: Background script configures mobile UI
4. **Screenshot Capture**: Extension captures with mobile overlay
5. **Return Data**: Screenshot returned as buffer to automation system

### Enhanced CSV Format

The system now supports device-specific mobile UI generation:

```csv
WebsiteURL,PID,UID,AdType,Selector,DeviceUI,AD543Type,AD543Source,AD543PlayMode
https://news.com,P001,U001,AD543,.content,Android,outstream,staging,MIR
https://news.com,P001,U001,AD543,.content,iOS,outstream,staging,MIR
```

- **Android**: Generates screenshot with Android status bar, navigation, URL bar
- **iOS**: Generates screenshot with iOS status bar, clean navigation bar
- **Desktop**: Uses standard browser screenshot (no mobile overlay)

## 🔄 Automation API Reference

### Background Script Methods

```javascript
// Capture mobile screenshot with UI overlay
await chrome.runtime.sendMessage({
  action: 'captureWithMobileUI',
  options: {
    deviceType: 'ios',        // 'ios' or 'android'
    time: '14:30',            // Time to display
    url: 'example.com',       // URL to display
    returnAsBuffer: true      // Return as base64 buffer
  }
});

// Configure mobile UI
await chrome.runtime.sendMessage({
  action: 'configureMobileUI',
  options: {
    deviceType: 'android',
    time: '09:15',
    url: 'news.example.com'
  }
});

// Check extension readiness
await chrome.runtime.sendMessage({
  action: 'checkExtensionReady'
});
```

### Content Script Events

The content script automatically detects and reports:
- ✅ AD543 bookmarklet loading
- ✅ AD543 panel opening (Shift+W)
- ✅ Ad injection completion (Shift+R)
- ✅ Video player generation (Glia/Truvid)
- ✅ DV360 campaign injection

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Responding
**Symptoms**: Automation fails with "Extension not connected"
**Solutions**:
1. Reload extension in chrome://extensions/
2. Refresh the target webpage
3. Check browser console for errors
4. Verify extension permissions

#### Mobile UI Not Appearing
**Symptoms**: Screenshots lack mobile overlays
**Solutions**:
1. Ensure DeviceUI is set to "Android" or "iOS" in CSV
2. Check that extension popup can be opened manually
3. Verify html2canvas.min.js is loaded correctly
4. Test manual screenshot capture first

#### AD543 Integration Issues
**Symptoms**: Automation detects extension but AD543 fails
**Solutions**:
1. Test AD543 bookmarklet manually (Shift+W)
2. Verify AD543 resources are accessible
3. Check network connectivity to AD543 domains
4. Enable detailed logging for debugging

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('AD543_DEBUG', 'true');

// Check extension logs
chrome.runtime.sendMessage({action: 'getLogs'});
```

### Performance Optimization

For high-volume processing:
1. **Batch Size**: Limit to 5-10 concurrent screenshots
2. **Memory Management**: Restart browser every 100 screenshots
3. **Resource Cleanup**: Clear cache between batches
4. **Error Handling**: Implement exponential backoff for retries

## 🎯 Production Deployment

### Quality Checklist

Before production use:
- [ ] Extension loads without errors
- [ ] Manual screenshot capture works for both iOS/Android
- [ ] Automation API responds correctly
- [ ] AD543 integration functions properly
- [ ] Batch processing completes successfully
- [ ] Error handling operates as expected
- [ ] Performance meets requirements (<30s per screenshot)

### Monitoring

Set up monitoring for:
- Extension connection status
- Screenshot capture success rate
- AD543 integration health
- Processing performance metrics
- Error rates and types

### Security Considerations

- Extension only works on specified domains
- No sensitive data stored in extension storage
- All communication uses secure messaging
- Screenshots are processed locally before upload
- Automatic cleanup of temporary data

## 🏆 Benefits Achieved

### For Your Team
✅ **Familiar Interface**: Same extension, enhanced with automation  
✅ **Professional Results**: Mobile screenshots with authentic UI  
✅ **No Learning Curve**: Existing workflows enhanced, not replaced  
✅ **Batch Efficiency**: Process dozens of screenshots automatically  

### for Operations
✅ **Scalable Processing**: Handle enterprise-level screenshot volumes  
✅ **Quality Consistency**: Standardized mobile UI across all screenshots  
✅ **Error Resilience**: Automatic retry and fallback mechanisms  
✅ **Integration Ready**: Works seamlessly with existing AD543 system  

Your enhanced Chrome extension now provides enterprise-grade mobile screenshot automation while preserving all the features that made your original extension valuable! 🎉