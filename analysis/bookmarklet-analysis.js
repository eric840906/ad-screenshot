// Company Bookmarklet Analysis - Decoded and Formatted
// Original bookmarklet URL decoded for analysis

(function() {
    // Check if already loaded to prevent duplicate loading
    if (window.AD543Loaded) {
        alert('查廣告543 已經載入！請按 Shift+W 開啟面板');
        return;
    }
    
    // Set loaded flag
    window.AD543Loaded = true;
    
    // Define CSS URLs for the ad search panel
    window.AD543_CSS_URL = 'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/searchPanelStyle.css';
    window.AD543_SV_CSS_URL = 'https://ad-specs.guoshipartners.com/static/tampermonkeyScript/svStyle.css';
    
    var cssPromises = [];
    
    // Load and cache search panel CSS
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
    
    // Load and cache SV (Street View?) CSS
    cssPromises.push(
        fetch('https://ad-specs.guoshipartners.com/static/tampermonkeyScript/svStyle.css')
            .then(function(r) { return r.text() })
            .then(function(css) {
                window.AD543_CSS_CACHE = window.AD543_CSS_CACHE || {};
                window.AD543_CSS_CACHE['IMPORTED_SV_CSS'] = css;
                try {
                    sessionStorage.setItem('AD543_CSS_IMPORTED_SV_CSS', css);
                } catch(e) {}
            })
            .catch(function(e) {
                console.error('Failed to load svStyle.css:', e);
            })
    );
    
    // Inject CSS links into document head
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
    
    // After CSS is loaded, load the polyfill and main script
    Promise.all(cssPromises).then(function() {
        console.log('CSS preloaded, loading polyfill...');
        
        // Load GM polyfill (Greasemonkey/Tampermonkey compatibility)
        var polyfill = document.createElement('script');
        polyfill.src = 'https://rd-dev.onead.tw/test_demo/ericchiu/bookmarklet/gm-polyfill.js';
        polyfill.onload = function() {
            console.log('Polyfill loaded, loading main script...');
            
            // Load main search panel script
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
})();