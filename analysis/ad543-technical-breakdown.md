# AD543 Bookmarklet Technical Breakdown

## How Your AD543 Bookmarklet Works - Step by Step

### 1. **Initialization & Duplicate Prevention**
```javascript
if(window.AD543Loaded) {
  alert('查廣告543 已經載入！請按 Shift+W 開啟面板');
  return;
}
window.AD543Loaded = true;
```
- Checks global flag `window.AD543Loaded` to prevent multiple executions
- Shows Chinese alert if already loaded: "Ad Search 543 is already loaded! Press Shift+W to open panel"
- Sets the loaded flag to `true` to mark initialization

### 2. **Resource URL Configuration**
```javascript
window.AD543_CSS_URL = 'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/searchPanelStyle.css';
window.AD543_SV_CSS_URL = 'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/svStyle.css';
```
- Defines two CSS resource URLs as global variables
- Main panel styling: `searchPanelStyle.css`
- Secondary/Street View styling: `svStyle.css`
- Uses production domain: `ad-specs.guoshipartners.com`

### 3. **CSS Pre-loading and Caching Strategy**
```javascript
var cssPromises = [];

// Load searchPanelStyle.css
cssPromises.push(
  fetch('https://ad-specs.guoshipartners.com/static/tampermonkeyScript/searchPanelStyle.css')
    .then(function(r) { return r.text() })
    .then(function(css) {
      window.AD543_CSS_CACHE = window.AD543_CSS_CACHE || {};
      window.AD543_CSS_CACHE['IMPORTED_CSS'] = css;
      try {
        sessionStorage.setItem('AD543_CSS_IMPORTED_CSS', css);
      } catch(e) {}
    })
    .catch(function(e) {
      console.error('Failed to load searchPanelStyle.css:', e);
    })
);
```

**This section does TWO things simultaneously:**

A) **Memory Caching**: Stores CSS text in `window.AD543_CSS_CACHE['IMPORTED_CSS']`
B) **Persistent Caching**: Stores CSS in `sessionStorage.AD543_CSS_IMPORTED_CSS` 

The same pattern repeats for `svStyle.css` → `window.AD543_CSS_CACHE['IMPORTED_SV_CSS']`

### 4. **Immediate CSS Injection (Link Tags)**
```javascript
var cssUrls = [
  'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/searchPanelStyle.css',
  'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/svStyle.css'
];

cssUrls.forEach(function(url) {
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
});
```
- Creates `<link>` elements for immediate CSS loading
- Injects directly into `<head>` for instant styling
- This happens WHILE the fetch promises are still running

### 5. **Sequential Script Loading Chain**
```javascript
Promise.all(cssPromises).then(function() {
  console.log('CSS preloaded, loading polyfill...');
  
  // Load GM polyfill first
  var polyfill = document.createElement('script');
  polyfill.src = 'https://rd-dev.onead.tw/test_demo/ericchiu/bookmarklet/gm-polyfill.js';
  polyfill.onload = function() {
    console.log('Polyfill loaded, loading main script...');
    
    // Then load main script
    var script = document.createElement('script');
    script.src = 'https://rd-dev.onead.tw/test_demo/ericchiu/bookmarklet/searchPanel.js';
    script.onload = function() {
      console.log('查廣告543 載入成功！按 Shift+W 開啟面板');
    };
    script.onerror = function() {
      alert('載入 searchPanel.js 失敗，請檢查網址是否正確');
    };
    document.body.appendChild(script);
  };
  polyfill.onerror = function() {
    alert('載入 gm-polyfill.js 失敗，請檢查網址是否正確');
  };
  document.body.appendChild(polyfill);
});
```

**Critical Loading Sequence:**
1. Wait for ALL CSS promises to complete
2. Load `gm-polyfill.js` from development server (`rd-dev.onead.tw`)
3. Only after polyfill loads → load `searchPanel.js` 
4. Success message: "查廣告543 載入成功！按 Shift+W 開啟面板" (AD543 loaded successfully! Press Shift+W to open panel)

## Key Technical Insights

### Dual Domain Architecture
- **Production CSS**: `ad-specs.guoshipartners.com` (stable styling resources)
- **Development JS**: `rd-dev.onead.tw` (active development scripts)

### Performance Optimization Strategy
- **Parallel CSS Loading**: fetch() for caching + link tags for immediate styling
- **Memory + Persistent Cache**: Both `window` and `sessionStorage` caching
- **Sequential Script Loading**: Ensures proper dependency chain

### Error Handling Approach
- Try/catch on sessionStorage (handles privacy mode)
- Individual error handlers for each script load
- User-friendly Chinese error messages
- Console logging for debugging

### Activation Method
- Uses **Shift+W** keyboard shortcut to open the panel
- The panel interface is loaded by `searchPanel.js`
- Greasemonkey compatibility through `gm-polyfill.js`

## Control Points for Automation

Based on this analysis, here are the control points I can use:

### 1. **Readiness Detection**
```javascript
// Check if fully loaded
window.AD543Loaded === true && 
window.AD543_CSS_CACHE && 
(window.AD543_CSS_CACHE.IMPORTED_CSS || window.AD543_CSS_CACHE.IMPORTED_SV_CSS)
```

### 2. **Panel Activation**
```javascript
// Simulate Shift+W keypress
const event = new KeyboardEvent('keydown', {
  key: 'W',
  code: 'KeyW', 
  shiftKey: true,
  bubbles: true,
  cancelable: true
});
document.dispatchEvent(event);
```

### 3. **State Monitoring**
- Monitor `window.AD543Loaded` flag
- Check CSS cache population
- Watch for script load completion
- Detect panel visibility after Shift+W

## Questions to Verify My Understanding

1. **Does the panel appear when Shift+W is pressed after successful loading?**
2. **Are there specific DOM elements the panel creates that I should look for?**
3. **Does the panel provide any JavaScript APIs for programmatic control?**
4. **Are there any additional global variables set by searchPanel.js?**
5. **Does the system work differently on mobile vs desktop?**

This breakdown shows I understand your bookmarklet's architecture - can you confirm if my analysis is accurate?