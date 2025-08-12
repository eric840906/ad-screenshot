# Complete AD543 searchPanel.js Analysis

## 🎯 What Your AD543 System Actually Does

Your AD543 is a **sophisticated ad injection and testing tool** with three main modules:

### 1. **Outstream Ad Module** (Main Feature)
- **Purpose**: Inject OneAD outstream advertisements into web pages
- **Ad Types**: Mobile Fullscreen (MFS), Mobile Inread (MIR), Desktop Frame, Text Drive (TD), Instream (IP), Inread (IR)
- **Sources**: Staging (`staging.onead.com.tw`) or Production (`onead.onevision.com.tw`)
- **Parameters**: PID (Product ID), UID (User ID)

### 2. **Instream Video Ad Module**
- **Purpose**: Replace existing video players with ad-enabled video content
- **Players**: Glia Player or Truvid Player with custom controls
- **Features**: Play/pause, mute/unmute, volume slider, ad labeling
- **Input**: Video URL and click-through link URL

### 3. **DV360 Integration Module**
- **Purpose**: Inject Display & Video 360 campaigns into iframes
- **Input**: DV360 campaign URL and target iframe selector
- **Visual Indicator**: Adds info and close icons to injected content

## 🏗️ Technical Architecture Deep Dive

### Shadow DOM Implementation
```javascript
const shadow = bodyElement.appendChild(document.createElement('onead-ui')).attachShadow({ mode: 'closed' })
```
- Uses **closed Shadow DOM** for complete CSS/JS isolation
- Prevents external interference with the panel UI
- Custom element `<onead-ui>` as the shadow host

### Data Persistence Strategy
```javascript
const adInfo = GM_getValue('adInfo') ? GM_getValue('adInfo') : {}
const svInfo = GM_getValue('svInfo') ? GM_getValue('svInfo') : {}  
const dv360Info = GM_getValue('dv360Info') ? GM_getValue('dv360Info') : {}
```
- Uses Greasemonkey storage API (`GM_getValue/GM_setValue`) 
- Persists configuration across page reloads
- Three separate storage buckets for each module

### CSS Resource Management
```javascript
const mainStyle = GM_getResourceText('IMPORTED_CSS')
const svStyle = GM_getResourceText('IMPORTED_SV_CSS')
```
- Retrieves cached CSS from Greasemonkey resource system
- Two stylesheets: main panel UI + instream video player styles

### Dynamic Ad Injection Engine
```javascript
const adCaller = ({ sourceValue, playmodeValue, pid, uid }, targetDiv) => {
  // Creates OneAD configuration objects
  // Injects ad-serving scripts dynamically
  // Handles both outstream and text-drive ad types
}
```

## 🎮 User Interface & Controls

### Modal Dialog System
- **Activation**: `Shift+W` opens modal dialog
- **Tabs**: Three-tab interface (Outstream, Instream, DV360)
- **Forms**: Separate form for each ad type with validation

### Keyboard Shortcuts
- **`Shift+W`**: Open configuration panel
- **`Shift+R`**: Execute ad injection based on current settings

### Form Controls
1. **Outstream Tab**:
   - Radio buttons: Ad source (Staging/Production)
   - Radio buttons: Play mode (MFS, MIR, Desktop Frame, TD, IP, IR)
   - Number inputs: PID, UID
   - Conditional selector input for certain modes

2. **Instream Tab**:
   - Radio buttons: Player type (Glia/Truvid)
   - Text inputs: Video URL, Click-through link

3. **DV360 Tab**:
   - Text inputs: Campaign URL, Target iframe selector

## 🔧 Advanced Features

### Intelligent Selector Handling
```javascript
const isRequireSelector = () => {
  return ['MIR', 'TD', 'IP', 'IR'].includes(adInfo.playmodeValue)
}
```
- Certain ad types require CSS selector targeting
- Dynamically shows/hides selector input field
- Instructions adapt based on selected mode

### Video Player Generation
- Creates complete video player interfaces with custom controls
- Handles both Glia and Truvid player types
- Event listeners for play/pause/mute functionality
- Custom styling and positioning

### Ad Script Integration
- Dynamically loads OneAD library scripts:
  - `onead-lib.min.js` for video ads
  - `ad-serv.min.js` for text-drive ads
- Creates global configuration objects (`_ONEAD`, `ONEAD_TEXT`)
- Handles serving flags and callback functions

## 🎯 Key Integration Points for Automation

### 1. **Panel State Detection**
```javascript
// Check if panel is open
dialog.open === true

// Check current active tab
shadow.querySelector('.tab-active').id // 'outstream-tab', 'instream-tab', 'dv360-tab'
```

### 2. **Configuration Retrieval**
```javascript
// Get current settings
const currentAdInfo = JSON.parse(GM_getValue('adInfo') || '{}')
const currentSvInfo = JSON.parse(GM_getValue('svInfo') || '{}')
const currentDv360Info = JSON.parse(GM_getValue('dv360Info') || '{}')
```

### 3. **Programmatic Form Control**
```javascript
// Set form values
shadow.querySelector('#pid777').value = 'PROD001'
shadow.querySelector('#uid777').value = 'USER001'
shadow.querySelector('input[value="staging"]').checked = true
shadow.querySelector('input[value="MIR"]').checked = true

// Submit form programmatically  
shadow.querySelector('#onead-form777').requestSubmit()
```

### 4. **Direct Ad Injection**
```javascript
// Trigger ad injection directly (bypasses form)
const targetElement = document.querySelector('.content-area')
adCaller({
  sourceValue: 'staging',
  playmodeValue: 'MIR', 
  pid: 'PROD001',
  uid: 'USER001'
}, targetElement)
```

### 5. **Event Simulation**
```javascript
// Simulate Shift+W to open panel
const event = new KeyboardEvent('keydown', {
  key: 'W', keyCode: 87, shiftKey: true, bubbles: true
})
document.dispatchEvent(event)

// Simulate Shift+R to execute injection  
const event2 = new KeyboardEvent('keydown', {
  key: 'R', keyCode: 82, shiftKey: true, bubbles: true
})
document.dispatchEvent(event2)
```

## 🔍 What This Means for Automation

### Your AD543 is More Powerful Than Expected!
1. **Complete Ad Testing Suite**: Not just detection, but full ad injection and testing
2. **Multi-Platform Support**: Handles mobile, desktop, and various ad formats
3. **Professional Video Players**: Custom video ad players with full controls
4. **Enterprise Integration**: DV360 support for display advertising campaigns
5. **Persistent Configuration**: Settings survive across page reloads

### Enhanced Automation Possibilities
1. **Automated Ad Testing**: Can inject test ads and capture results
2. **Cross-Format Coverage**: Test multiple ad formats automatically  
3. **A/B Testing**: Compare staging vs production ad performance
4. **Video Ad Automation**: Automated video ad placement and testing
5. **Campaign Testing**: Automated DV360 campaign injection and verification

### Integration Strategy Update Needed
Your system is much more sophisticated than a simple bookmarklet - it's a complete ad testing and injection platform. I need to enhance the automation integration to:

1. **Support Ad Injection Automation**: Not just detection, but actual ad placement
2. **Handle Multiple Ad Formats**: MFS, MIR, Desktop, Text-Drive, Instream, DV360
3. **Manage Persistent Settings**: Work with GM storage system
4. **Control Video Players**: Interact with generated video interfaces
5. **Screenshot Enhanced Content**: Capture pages with injected ads, not just existing content

This is a **game-changer** for the automation system! 🚀