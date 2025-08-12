/**
 * Example of bookmarklet integration with the automation system
 */

const { BookmarkletExecutor } = require('../dist/index.js');

// Custom bookmarklet examples
const CUSTOM_BOOKMARKLETS = {
  adHighlighter: `
    const selector = getParam('selector', '.ad');
    const color = getParam('color', '#ff0000');
    const duration = getParam('duration', 5000);
    
    const elements = document.querySelectorAll(selector);
    logMessage('Found ' + elements.length + ' elements with selector: ' + selector);
    
    elements.forEach((element, index) => {
      highlightElement(element, color, duration);
      
      // Add number label
      const label = document.createElement('div');
      label.textContent = index + 1;
      label.style.cssText = 'position: absolute; top: -20px; left: 0; background: ' + color + '; color: white; padding: 2px 6px; font-size: 12px; font-weight: bold; border-radius: 3px; z-index: 9999;';
      element.style.position = 'relative';
      element.appendChild(label);
    });
    
    return { elementsFound: elements.length, selector: selector };
  `,

  dataExtractor: `
    const selectors = getParam('selectors', ['.ad', '.advertisement']);
    const includeImages = getParam('includeImages', true);
    
    const results = [];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, index) => {
        const data = {
          selector: selector,
          index: index,
          text: element.textContent?.trim(),
          html: element.innerHTML.slice(0, 500), // Limit HTML length
          attributes: {},
          images: [],
          links: []
        };
        
        // Extract attributes
        for (let attr of element.attributes) {
          data.attributes[attr.name] = attr.value;
        }
        
        // Extract images if requested
        if (includeImages) {
          const images = element.querySelectorAll('img');
          images.forEach(img => {
            data.images.push({
              src: img.src,
              alt: img.alt,
              width: img.width,
              height: img.height
            });
          });
        }
        
        // Extract links
        const links = element.querySelectorAll('a[href]');
        links.forEach(link => {
          data.links.push({
            href: link.href,
            text: link.textContent?.trim(),
            target: link.target
          });
        });
        
        results.push(data);
      });
    });
    
    logMessage('Extracted data from ' + results.length + ' elements');
    return results;
  `,

  performanceAnalyzer: `
    const startTime = performance.now();
    
    const analysis = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      title: document.title,
      performance: {},
      ads: {},
      errors: []
    };
    
    try {
      // Performance metrics
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        analysis.performance = {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
        };
      }
      
      // Ad detection
      const adSelectors = getParam('adSelectors', [
        '.ad', '.advertisement', '[class*="ad-"]', '[id*="ad-"]',
        '.banner', '.promo', '.sponsored'
      ]);
      
      analysis.ads.totalElements = 0;
      analysis.ads.visibleElements = 0;
      analysis.ads.hiddenElements = 0;
      analysis.ads.bySelector = {};
      
      adSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        analysis.ads.bySelector[selector] = elements.length;
        analysis.ads.totalElements += elements.length;
        
        elements.forEach(element => {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            analysis.ads.visibleElements++;
          } else {
            analysis.ads.hiddenElements++;
          }
        });
      });
      
      // Check for ad blockers
      analysis.ads.blockerDetected = false;
      try {
        const testAd = document.createElement('div');
        testAd.innerHTML = '&nbsp;';
        testAd.className = 'adsbox';
        testAd.style.cssText = 'position:absolute;left:-999px;';
        document.body.appendChild(testAd);
        
        setTimeout(() => {
          if (testAd.offsetHeight === 0) {
            analysis.ads.blockerDetected = true;
          }
          document.body.removeChild(testAd);
        }, 100);
      } catch (e) {
        analysis.errors.push('Ad blocker detection failed: ' + e.message);
      }
      
    } catch (error) {
      analysis.errors.push('Analysis error: ' + error.message);
    }
    
    analysis.executionTime = performance.now() - startTime;
    
    logMessage('Performance analysis completed in ' + analysis.executionTime.toFixed(2) + 'ms');
    return analysis;
  `
};

async function demonstrateBookmarkletExecution() {
  console.log('🔖 Demonstrating bookmarklet execution...\n');

  const executor = BookmarkletExecutor.getInstance();

  // Get available templates
  const templates = executor.getBookmarkletTemplates();
  console.log('📋 Available built-in templates:');
  templates.forEach(template => {
    console.log(`  - ${template.name}: ${template.description}`);
  });

  // Create configurations from templates
  const configs = [
    executor.createConfigFromTemplate('Element Highlighter', {
      selector: '.ad',
      color: '#ff0000',
      duration: 3000
    }),
    
    executor.createConfigFromTemplate('Ad Information Extractor', {
      selector: '.advertisement',
      includeMetadata: true
    }),

    executor.createConfigFromTemplate('Page Scanner', {
      adSelectors: ['.ad', '.banner', '.promo']
    })
  ];

  console.log('\n🛠️  Created configurations:');
  configs.forEach((config, index) => {
    console.log(`  ${index + 1}. Parameters: ${Object.keys(config.parameters).join(', ')}`);
  });

  // Validate configurations
  console.log('\n✅ Validating configurations:');
  configs.forEach((config, index) => {
    const validation = executor.validateConfig(config);
    console.log(`  Config ${index + 1}: ${validation.isValid ? 'Valid' : 'Invalid'}`);
    if (!validation.isValid) {
      validation.errors.forEach(error => console.log(`    ❌ ${error}`));
    }
  });

  console.log('\n📝 Custom bookmarklet examples created');
}

async function createCustomBookmarkletTemplate() {
  console.log('🔧 Creating custom bookmarklet template...\n');

  // Example of how to extend the system with custom bookmarklets
  const customTemplate = {
    name: 'Ad Performance Analyzer',
    description: 'Analyzes ad performance and visibility metrics',
    script: CUSTOM_BOOKMARKLETS.performanceAnalyzer,
    parameters: [
      {
        name: 'adSelectors',
        type: 'object',
        required: false,
        defaultValue: ['.ad', '.advertisement'],
        description: 'Array of CSS selectors for ad detection'
      }
    ]
  };

  console.log('Custom template created:', customTemplate.name);
  console.log('Description:', customTemplate.description);
  console.log('Parameters:', customTemplate.parameters.map(p => p.name).join(', '));

  // This is how you would add it to the executor in a real scenario
  // executor.addCustomTemplate(customTemplate);
}

function generateBookmarkletUrl(script, parameters = {}) {
  // Create a bookmarklet URL that can be saved as a browser bookmark
  const paramScript = Object.keys(parameters).length > 0 
    ? `window.__bookmarkletParams = ${JSON.stringify(parameters)};` 
    : '';

  const fullScript = paramScript + script;
  const encodedScript = encodeURIComponent(fullScript);
  
  return `javascript:(function(){${encodedScript}})();`;
}

function demonstrateBookmarkletGeneration() {
  console.log('🔗 Generating bookmarklet URLs...\n');

  // Generate bookmarklet URLs for browser bookmarks
  const bookmarklets = [
    {
      name: 'Ad Highlighter',
      script: CUSTOM_BOOKMARKLETS.adHighlighter,
      parameters: { selector: '.ad', color: '#ff0000', duration: 5000 }
    },
    {
      name: 'Data Extractor',
      script: CUSTOM_BOOKMARKLETS.dataExtractor,
      parameters: { selectors: ['.ad', '.banner'], includeImages: true }
    }
  ];

  bookmarklets.forEach(bookmarklet => {
    const url = generateBookmarkletUrl(bookmarklet.script, bookmarklet.parameters);
    console.log(`📌 ${bookmarklet.name}:`);
    console.log(`   ${url.slice(0, 100)}...`);
    console.log(`   Length: ${url.length} characters\n`);
  });

  console.log('💡 To use these bookmarklets:');
  console.log('1. Copy the full URL');
  console.log('2. Create a new bookmark in your browser');
  console.log('3. Paste the URL as the bookmark location');
  console.log('4. Navigate to a webpage and click the bookmark');
}

async function integrateWithProcessingPipeline() {
  console.log('🔄 Integration with processing pipeline...\n');

  // Example of how bookmarklets integrate with the main processing pipeline
  const exampleRecord = {
    WebsiteURL: 'https://example.com',
    PID: 'PROD001',
    UID: 'USER001',
    AdType: 'Banner',
    Selector: 'bookmarklet:Element Highlighter:selector=.ad,color=#ff0000',
    DeviceUI: 'Desktop'
  };

  console.log('📄 Example record with bookmarklet selector:');
  console.log(JSON.stringify(exampleRecord, null, 2));

  console.log('\n🔧 Bookmarklet selector format:');
  console.log('  bookmarklet:<template-name>:<param1>=<value1>,<param2>=<value2>');
  console.log('');
  console.log('📋 Examples:');
  console.log('  bookmarklet:Element Highlighter:selector=.ad,color=#ff0000');
  console.log('  bookmarklet:Ad Information Extractor:includeMetadata=true');
  console.log('  bookmarklet:Page Scanner:adSelectors=[".ad",".banner"]');
}

// Main execution
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'demo':
      await demonstrateBookmarkletExecution();
      break;
    case 'custom':
      await createCustomBookmarkletTemplate();
      break;
    case 'generate':
      demonstrateBookmarkletGeneration();
      break;
    case 'integrate':
      await integrateWithProcessingPipeline();
      break;
    default:
      console.log(`
🔖 Bookmarklet Integration Examples

Available commands:
  node examples/bookmarklet-integration.js demo      - Demonstrate built-in bookmarklets
  node examples/bookmarklet-integration.js custom    - Show custom bookmarklet creation
  node examples/bookmarklet-integration.js generate  - Generate bookmarklet URLs
  node examples/bookmarklet-integration.js integrate - Show pipeline integration

Usage in CSV/Google Sheets:
  Use selector format: bookmarklet:<template-name>:<parameters>
  
Examples:
  bookmarklet:Element Highlighter:selector=.ad,color=#ff0000
  bookmarklet:Ad Information Extractor:includeMetadata=true
      `);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  CUSTOM_BOOKMARKLETS,
  demonstrateBookmarkletExecution,
  createCustomBookmarkletTemplate,
  generateBookmarkletUrl,
  demonstrateBookmarkletGeneration,
  integrateWithProcessingPipeline
};