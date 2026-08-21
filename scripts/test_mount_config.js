const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  console.log('Navigating to PlayDoIt home...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  const testConfig = await page.evaluate(async () => {
    const wsdk = window.WSDK || window.altenarWSDK;
    if (!wsdk) return { error: 'No WSDK' };

    let container = document.createElement('div');
    container.id = 'altenar-app-root';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '999999';
    container.style.background = '#fff';
    document.body.appendChild(container);

    const log = [];

    try {
      const config = {
        container,
        culture: 'es-ES',
        timezoneOffset: 360,
        integration: 'playdoit2',
        routerType: window.__WSDK_ROUTER_TYPE__ || 'hash',
        theme: window.__WSDK_THEME__ || 'default'
      };
      
      const sb = wsdk.addSportsBook(config);
      log.push({ success: true, sb: !!sb });
    } catch(e) {
      log.push({ error: e.message, stack: e.stack });
    }

    await new Promise(r => setTimeout(r, 4000));

    const elements = Array.from(container.querySelectorAll('*')).map(el => ({
      tag: el.tagName,
      className: el.className,
      text: (el.innerText || '').slice(0, 50).replace(/\n+/g, ' ')
    }));

    return {
      log,
      elementCount: elements.length,
      elements: elements.slice(0, 20)
    };
  });

  console.log('Test Config Result:\n', JSON.stringify(testConfig, null, 2));

  await browser.close();
})();
