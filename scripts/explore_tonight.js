const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== CHECKING MATCHES TONIGHT (2026-08-20 >= 19:00 CDMX / 01:00 UTC) ===');

  // 1. PlayDoIt Upcoming Events for tonight (after 01:00 UTC)
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('[PLAYDOIT] Navigating to sportsbook...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  const playdoitEvents = await page.evaluate(async () => {
    const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66&count=500');
    const data = await res.json();
    return (data.events || []).map(e => ({
      id: e.id,
      name: e.name,
      startDate: e.startDate,
      champId: e.champId
    }));
  });

  // Filter window: from 2026-08-21T01:00:00Z (19:00 CDMX 20/08) to 2026-08-21T07:00:00Z (01:00 CDMX)
  const windowStart = new Date('2026-08-21T01:00:00Z').getTime();
  const windowEnd = new Date('2026-08-21T07:00:00Z').getTime();

  const tonightPlaydoit = playdoitEvents.filter(e => {
    const t = new Date(e.startDate).getTime();
    return t >= windowStart && t <= windowEnd;
  });

  console.log(`\nPlayDoIt Events Tonight (>= 19:00 CDMX): ${tonightPlaydoit.length}`);
  tonightPlaydoit.forEach(e => {
    console.log(` - [ID: ${e.id}] ${e.name} | Start: ${e.startDate}`);
  });

  // 2. Check DataFut for matches tonight
  console.log('\n[DATAFUT] Checking DataFut calendar for matches tonight...');
  const datafutSessionPath = path.join(__dirname, '..', 'datafut-marketing-session.json');
  const dfContext = await browser.newContext({
    storageState: fs.existsSync(datafutSessionPath) ? datafutSessionPath : undefined,
    viewport: { width: 1280, height: 900 }
  });
  const dfPage = await dfContext.newPage();

  await dfPage.goto('https://data-fut.com/calendario.html?fecha=2026-08-20', { waitUntil: 'networkidle', timeout: 45000 });
  await dfPage.waitForTimeout(3000);

  const dfLinks20 = await dfPage.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => {
      const parent = a.closest('.tarjeta-partido, [class*="match"], .card, div') || a;
      return {
        url: a.href,
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        fullCardText: parent.innerText.replace(/\n+/g, ' | ').trim()
      };
    });
  });

  console.log(`DataFut Matches on 2026-08-20 Calendar: ${dfLinks20.length}`);
  dfLinks20.forEach(m => console.log(` - ${m.text} -> ${m.url} | Info: ${m.fullCardText}`));

  // Also check if there are matches in DataFut for next morning / overnight (2026-08-21 early hours)
  await dfPage.goto('https://data-fut.com/calendario.html?fecha=2026-08-21', { waitUntil: 'networkidle', timeout: 45000 });
  await dfPage.waitForTimeout(3000);

  const dfLinks21 = await dfPage.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => {
      const parent = a.closest('.tarjeta-partido, [class*="match"], .card, div') || a;
      return {
        url: a.href,
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        fullCardText: parent.innerText.replace(/\n+/g, ' | ').trim()
      };
    });
  });

  console.log(`DataFut Matches on 2026-08-21 Calendar: ${dfLinks21.length}`);
  dfLinks21.forEach(m => console.log(` - ${m.text} -> ${m.url} | Info: ${m.fullCardText}`));

  await browser.close();
})();
