const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  console.log('Navigating to https://www.playdoit.mx/sports ...');
  await page.goto('https://www.playdoit.mx/sports', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Check Altenar / WSDK elements in the DOM
  const wsdkInfo = await page.evaluate(() => {
    // Check Altenar global objects
    const globalKeys = Object.keys(window).filter(k => 
      k.toLowerCase().includes('wsdk') || 
      k.toLowerCase().includes('altenar') || 
      k.toLowerCase().includes('sportsbook') ||
      k.toLowerCase().includes('sb')
    );

    // Look for Altenar container elements, shadow DOM, or custom elements
    const allCustomOrAsb = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const tag = el.tagName.toLowerCase();
        const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
        const id = el.id ? el.id.toLowerCase() : '';
        return tag.includes('asb') || tag.includes('sb') || cls.includes('asb') || cls.includes('sportsbook') || id.includes('asb') || id.includes('sportsbook') || el.shadowRoot;
      })
      .map(el => ({
        tag: el.tagName,
        id: el.id,
        className: typeof el.className === 'string' ? el.className.slice(0, 100) : '',
        hasShadowRoot: !!el.shadowRoot,
        textSnippet: (el.innerText || '').slice(0, 200).replace(/\n+/g, ' ')
      }));

    // Find all text in entire document body
    const bodyText = document.body.innerText;

    // Search for match names like Corinthians, Rosario, Athletic, CRB, LDU, Mirassol, Santos, etc.
    const searchTerms = ['corinthians', 'rosario', 'athletic', 'crb', 'ldu', 'quito', 'mirassol', 'santos', 'novorizontino', 'america'];
    const foundMatches = [];
    searchTerms.forEach(term => {
      if (bodyText.toLowerCase().includes(term)) {
        foundMatches.push(term);
      }
    });

    return {
      globalKeys,
      bodyLength: bodyText.length,
      foundMatches,
      asbElementsCount: allCustomOrAsb.length,
      asbSample: allCustomOrAsb.slice(0, 15),
      bodySnippet: bodyText.slice(0, 1500).replace(/\n+/g, ' | ')
    };
  });

  console.log('WSDK & DOM Inspection:\n', JSON.stringify(wsdkInfo, null, 2));

  await page.screenshot({ path: path.join(__dirname, 'playdoit_wsdk_inspection.png'), fullPage: true });

  await browser.close();
})();
