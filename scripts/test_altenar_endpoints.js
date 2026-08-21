const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Test endpoints
  const apiData = await page.evaluate(async () => {
    const endpoints = [
      'https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66',
      'https://sb2frontend-altenar2.biahosted.com/api/widget/GetOverview?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66'
    ];

    const results = {};
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        const json = await res.json();
        results[ep] = {
          hasEvents: Boolean(json.events),
          count: json.events ? json.events.length : 0,
          keys: Object.keys(json)
        };
      } catch(e) {
        results[ep] = { error: e.message };
      }
    }
    return results;
  });

  console.log('API endpoints test:', JSON.stringify(apiData, null, 2));

  await browser.close();
})();
