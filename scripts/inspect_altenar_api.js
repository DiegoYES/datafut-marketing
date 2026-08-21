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

  // Capture event data responses from Altenar
  const altenarEventsData = [];
  page.on('response', async resp => {
    const url = resp.url();
    if (url.includes('sb2frontend-altenar2.biahosted.com') || url.includes('/api/widget/')) {
      try {
        const json = await resp.json();
        altenarEventsData.push({
          url: url.split('?')[0],
          dataKeys: Object.keys(json || {}),
          raw: json
        });
      } catch(e) {}
    }
  });

  console.log('Navigating to https://www.playdoit.mx/ ...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Check DOM structure under #main
  const domInfo = await page.evaluate(() => {
    // Find all elements with text
    const all = Array.from(document.querySelectorAll('*'));
    const withText = all.filter(el => {
      const txt = el.innerText || '';
      return txt.length > 5 && el.children.length === 0;
    }).map(el => ({
      tag: el.tagName,
      cls: el.className,
      text: el.innerText.trim()
    }));

    // Find any iframe or custom element
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => f.src);

    return {
      totalElements: all.length,
      leafNodesCount: withText.length,
      sampleLeafNodes: withText.slice(0, 30),
      iframes
    };
  });

  console.log('DOM Info:', JSON.stringify(domInfo, null, 2));
  console.log(`\nCaptured ${altenarEventsData.length} Altenar API responses:`);
  altenarEventsData.forEach((item, idx) => {
    console.log(`\n[${idx}] ${item.url} -> keys:`, item.dataKeys);
    if (item.raw && item.raw.events) {
      console.log(`  Events count: ${item.raw.events.length}`);
      item.raw.events.slice(0, 5).forEach(ev => {
        console.log(`    Event: ${ev.name || ev.Name} (ID: ${ev.id || ev.Id}) - Champ: ${ev.champName || ev.ChampName}`);
      });
    }
  });

  fs.writeFileSync(path.join(__dirname, 'altenar_captured_api.json'), JSON.stringify(altenarEventsData, null, 2));

  await browser.close();
})();
