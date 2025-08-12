# Enhanced CSV Format for Advanced AD543 Integration

## Complete Column Reference

### Base Columns (Required)
- **WebsiteURL**: Target website URL for ad injection
- **PID**: Product ID for OneAD configuration  
- **UID**: User ID for OneAD configuration
- **AdType**: General ad type (use "AD543" for all AD543 injections)
- **Selector**: CSS selector for ad injection target
- **DeviceUI**: Device emulation (Android, iOS, Desktop)

### AD543 Integration Columns
- **BookmarkletType**: Set to "AD543" to enable AD543 automation
- **AD543Type**: Type of AD543 injection (outstream, instream, dv360)

### Outstream Ad Configuration
- **AD543Source**: Ad source server (staging, onevision)
- **AD543PlayMode**: Play mode (MFS, MIR, Desktop, TD, IP, IR)

### Instream Video Configuration  
- **AD543Player**: Player type (glia, truvid)
- **AD543VideoUrl**: Video source URL
- **AD543ClickUrl**: Click-through URL

### DV360 Campaign Configuration
- **AD543CampaignUrl**: DV360 campaign URL
- **AD543TargetIframe**: Target iframe CSS selector

## AD543 Play Modes Explained

### **MFS (Mobile Fullscreen)**
- Full-screen mobile video ads
- Best for: Mobile devices, high-impact campaigns
- Selector: Usually body or main container

### **MIR (Mobile Inread)**  
- In-content mobile ads that appear within articles
- Best for: Content websites, news sites, blogs
- Selector: Specific content area (e.g., `.article-content`)

### **Desktop Frame**
- Desktop display ads in frame format
- Best for: Desktop websites, banner placements
- Selector: Banner or sidebar areas

### **TD (Text-Drive)**
- Text-based contextual ads
- Best for: Content-heavy sites, article integration
- Selector: Text content areas

### **IP (Instream)**  
- Video ads within video content streams
- Best for: Video platforms, media sites
- Selector: Video container elements

### **IR (Inread)**
- In-article video ads that play as user scrolls
- Best for: Editorial content, long-form articles  
- Selector: Article body or content sections

## Example CSV Configurations

### 1. **Basic Outstream Ads**
```csv
WebsiteURL,PID,UID,AdType,Selector,DeviceUI,BookmarkletType,AD543Type,AD543Source,AD543PlayMode
https://news.site.com,PROD001,USER001,AD543,.content-area,Android,AD543,outstream,staging,MIR
https://blog.site.com,PROD002,USER002,AD543,.article-body,iOS,AD543,outstream,onevision,MFS
```

### 2. **Instream Video Ads**
```csv  
WebsiteURL,PID,UID,AdType,Selector,DeviceUI,BookmarkletType,AD543Type,AD543Player,AD543VideoUrl,AD543ClickUrl
https://video.site.com,PROD003,USER003,AD543,.player,Android,AD543,instream,glia,https://videos.com/ad.mp4,https://click.com
https://stream.site.com,PROD004,USER004,AD543,.video-area,iOS,AD543,instream,truvid,https://videos.com/promo.mp4,https://landing.com
```

### 3. **DV360 Campaign Integration**
```csv
WebsiteURL,PID,UID,AdType,Selector,DeviceUI,BookmarkletType,AD543Type,AD543CampaignUrl,AD543TargetIframe  
https://campaign.site.com,PROD005,USER005,AD543,.dv360-zone,Desktop,AD543,dv360,https://doubleclick.net/campaign/xyz,#ad-iframe
```

### 4. **Mixed Configuration (All Types)**
```csv
WebsiteURL,PID,UID,AdType,Selector,DeviceUI,BookmarkletType,AD543Type,AD543Source,AD543PlayMode,AD543Player,AD543VideoUrl,AD543ClickUrl,AD543CampaignUrl,AD543TargetIframe
https://site1.com,P001,U001,AD543,.content,Android,AD543,outstream,staging,MIR,,,,,
https://site2.com,P002,U002,AD543,.video,iOS,AD543,instream,,,,glia,https://vid.mp4,https://click.com,,
https://site3.com,P003,U003,AD543,.campaign,Desktop,AD543,dv360,,,,,,,https://dv360.com/camp,#iframe
```

## Automation Processing Flow

### Step 1: Load AD543 System
- Execute bookmarklet to initialize AD543
- Load CSS styles and JavaScript components
- Wait for GM polyfill and search panel to be ready

### Step 2: Configure Based on Type
- **Outstream**: Set source, play mode, PID, UID, selector
- **Instream**: Set player type, video URL, click URL
- **DV360**: Set campaign URL, target iframe selector

### Step 3: Execute Ad Injection
- Simulate Shift+R keypress to trigger injection
- OneAD scripts load and execute based on configuration  
- Ads render in specified target elements

### Step 4: Wait and Verify
- Monitor for ad rendering completion
- Verify ad elements are present and visible
- Capture screenshot of injected ad content

### Step 5: Save and Upload
- Save screenshot with enhanced naming convention
- Include AD543 type and configuration in metadata
- Upload to Google Drive with organized folder structure

## Advanced Features

### **Conditional Logic**
- Certain play modes (MIR, TD, IP, IR) require specific selectors
- System automatically detects and validates requirements
- Fallback configurations for unsupported combinations

### **Error Handling**
- Network timeout handling for resource loading
- Retry logic for failed ad injections
- Graceful fallback for unsupported configurations

### **Performance Optimization**  
- CSS/JS resource caching via session storage
- Browser session reuse for batch processing
- Parallel processing of multiple ad types

### **Monitoring & Logging**
- Detailed logging of each configuration step
- Performance metrics for ad loading times
- Error categorization and reporting

## Best Practices

### **Selector Targeting**
- Use specific, stable CSS selectors
- Avoid dynamic class names or IDs
- Test selectors across different device types

### **Resource Planning**
- Staging for testing, onevision for production
- Verify video URLs are accessible and properly encoded
- Ensure iframe targets exist before DV360 injection

### **Batch Organization**  
- Group similar ad types for efficient processing
- Mix device types for comprehensive testing
- Include error handling test cases

### **Quality Assurance**
- Validate all URLs before processing
- Test configurations in staging environment first
- Verify ad rendering across all target devices

This enhanced CSV format transforms your automation system from simple screenshot capture into a powerful **ad testing and injection platform**! 🚀