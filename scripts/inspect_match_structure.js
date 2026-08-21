const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sessionPath = path.join(__dirname, '..', 'datafut-marketing-session.json');
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  // 1. Check Calendario
  console.log('--- CHECKING /calendario.html ---');
  await page.goto('https://data-fut.com/calendario.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const calMatches = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => ({
      text: a.innerText.trim().replace(/\n+/g, ' | '),
      href: a.getAttribute('href')
    }));
  });
  console.log(`Found ${calMatches.length} matches on calendario:`);
  calMatches.forEach(m => console.log(' -', m.text, m.href));

  // 2. Check an example match page in detail
  const sampleUrl = 'https://data-fut.com/partido.html?local=131&visitante=437&liga=13&partido=1547767&fecha=2026-08-20';
  console.log('\n--- INSPECTING MATCH PAGE:', sampleUrl, '---');
  await page.goto(sampleUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const matchStructure = await page.evaluate(() => {
    // All buttons, tabs, sections
    const buttons = Array.from(document.querySelectorAll('button, .tab, [role="tab"], a.nav-link')).map(b => b.innerText.trim()).filter(Boolean);
    const sections = Array.from(document.querySelectorAll('h2, h3, h4, .section-title, .card-title')).map(s => s.innerText.trim()).filter(Boolean);
    
    // Check all text blocks and table headers
    const tables = Array.from(document.querySelectorAll('table')).map(t => {
      const headers = Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim());
      const rows = Array.from(t.querySelectorAll('tr')).slice(0, 5).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()));
      return { headers, rows };
    });

    return {
      buttons,
      sections,
      tablesCount: tables.length,
      tables
    };
  });

  console.log('Match Buttons/Tabs:', JSON.stringify(matchStructure.buttons, null, 2));
  console.log('Match Sections:', JSON.stringify(matchStructure.sections, null, 2));
  console.log('Tables found:', matchStructure.tablesCount);

  // Let's also check if there's any API or client side data in window / script tags
  const windowData = await page.evaluate(() => {
    const dataKeys = [];
    for (let k in window) {
      if (k.toLowerCase().includes('partido') || k.toLowerCase().includes('data') || k.toLowerCase().includes('match') || k.toLowerCase().includes('pick') || k.toLowerCase().includes('stats')) {
        dataKeys.push(k);
      }
    }
    return dataKeys;
  });
  console.log('Window data keys:', windowData);

  await browser.close();
})();
