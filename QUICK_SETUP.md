# 🚀 Quick Setup Guide

## Prerequisites

✅ **Node.js** (v18+) - Already available  
✅ **Chrome Browser** - Required for extension  
⚠️ **Redis** - Optional for full automation (install later)  

## 1. Chrome Extension Setup (5 minutes)

### Install Enhanced Chrome Extension

1. **Open Chrome Extension Manager**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle "Developer mode" (top-right corner)

3. **Load Enhanced Extension**
   - Click "Load unpacked"
   - Navigate to: `/Users/ericchiu/playground/ad-screenshot/extensions/enhanced-screenshot-extension/`
   - Click "Select Folder"

4. **Verify Installation**
   - Extension should appear: "AD543 Screenshot & Filter Tool - Enhanced"
   - Version: 2.0
   - Status: Enabled ✅

### Test Extension Manually

1. **Open any website** (e.g., https://news.com)
2. **Click extension icon** in Chrome toolbar
3. **Test mobile screenshots:**
   - Select "iOS" or "Android"
   - Set time (e.g., "14:30")
   - Click camera button
   - Should open new tab with mobile UI overlay

## 2. Install Redis (for full automation)

### macOS
```bash
brew install redis
brew services start redis
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

### Windows
Download from: https://redis.io/download

## 3. Test Basic System

```bash
cd /Users/ericchiu/playground/ad-screenshot

# Test environment
npm run dev

# Test with sample data (requires Redis)
npm start -- --csv data/ad543-advanced-samples.csv
```

## 4. What You'll Get

### ✅ **Manual Mode**
- Chrome extension works independently
- Mobile UI overlays (iOS/Android status bars)
- Professional screenshots

### ✅ **Automation Mode** (with Redis)
- Batch processing from CSV files
- AD543 ad injection automation
- Cross-platform screenshots (iOS + Android + Desktop)
- Google Drive upload (optional)

## 5. Testing Your AD543 Integration

The system integrates with your existing AD543 bookmarklet:

```
javascript:(function()%7B if(window.AD543Loaded)%7B alert('查廣告543...
```

1. **Manual Test**: Use AD543 bookmarklet on any page (Shift+W)
2. **Automation Test**: System will automatically inject ads and capture screenshots

## 6. Sample Workflow

```csv
WebsiteURL,PID,UID,AdType,Selector,DeviceUI,AD543Type,AD543Source,AD543PlayMode
https://news.com,P001,U001,AD543,.content,Android,outstream,staging,MIR
https://news.com,P001,U001,AD543,.content,iOS,outstream,staging,MIR
```

**Result**: Professional mobile screenshots with OneAD MIR ads on both Android and iOS!

## 🎯 Next Steps

1. ✅ Install Chrome extension (works immediately)
2. ⏳ Install Redis (for full automation)
3. 🚀 Test with your ad campaigns
4. 📈 Scale to production volumes

## 🆘 Need Help?

- Extension not working? Check chrome://extensions/ for errors
- Automation failing? Ensure Redis is running: `redis-cli ping`
- Build issues? Run `npm run build` to check for errors

**Your complete AD543 + Chrome extension automation system is ready!** 🎉