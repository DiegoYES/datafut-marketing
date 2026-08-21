const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== EXPLORING PLAYDOIT & DATAFUT FOR 2026-08-21 (>= 15:00 CDMX / 21:00 UTC) ===');

  // 1. PlayDoIt Upcoming Events for 2026-08-21
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
    const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66&count=2000');
    const data = await res.json();
    return (data.events || []).map(e => ({
      id: e.id,
      name: e.name,
      startDate: e.startDate,
      champId: e.champId,
      catId: e.catId
    }));
  });

  // Filter PlayDoIt events for 2026-08-21 starting from 21:00 UTC (15:00 CDMX)
  // Target window: 2026-08-21T21:00:00Z to 2026-08-22T06:00:00Z
  const targetWindowStart = new Date('2026-08-21T21:00:00Z').getTime();
  const targetWindowEnd = new Date('2026-08-22T06:00:00Z').getTime();

  const filteredPlaydoit = playdoitEvents.filter(e => {
    const t = new Date(e.startDate).getTime();
    return t >= targetWindowStart && t <= targetWindowEnd;
  });

  console.log(`\nPlayDoIt Total Upcoming Soccer Events: ${playdoitEvents.length}`);
  console.log(`PlayDoIt Events in Target Window (21/08 >= 15:00 CDMX): ${filteredPlaydoit.length}`);
  filteredPlaydoit.forEach(e => {
    console.log(` - [ID: ${e.id}] ${e.name} | Start: ${e.startDate}`);
  });

  // 2. Check DataFut for matches on 2026-08-21
  console.log('\n[DATAFUT] Checking matches on DataFut for 2026-08-21...');
  const datafutSessionPath = path.join(__dirname, '..', 'datafut-marketing-session.json');
  const dfContext = await browser.newContext({
    storageState: fs.existsSync(datafutSessionPath) ? datafutSessionPath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const dfPage = await dfContext.newPage();

  // Navigate to DataFut home or calendar
  await dfPage.goto('https://data-fut.com/', { waitUntil: 'networkidle', timeout: 45000 });
  await dfPage.waitForTimeout(3000);

  const dfMatches = await dfPage.evaluate(async () => {
    // Check if there are match links or calendar
    const matchLinks = Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => ({
      text: a.innerText.replace(/\n+/g, ' ').trim(),
      href: a.href
    }));

    // Also check any date selector or list of matches on home
    const cards = Array.from(document.querySelectorAll('.tarjeta-partido, [class*="match"], .card, div'))
      .filter(el => {
        const txt = el.innerText || '';
        return (txt.includes('vs') || txt.includes(' - ')) && (txt.includes(':') || txt.includes('2026'));
      })
      .map(el => el.innerText.replace(/\n+/g, ' | ').slice(0, 100));

    return {
      matchLinks,
      sampleCards: cards.slice(0, 20)
    };
  });

  console.log(`DataFut Match Links on Home: ${dfMatches.matchLinks.length}`);
  dfMatches.matchLinks.forEach(m => console.log(` - ${m.text} -> ${m.href}`));

  // Check specific calendar date if available: e.g. calendar for 2026-08-21
  try {
    await dfPage.goto('https://data-fut.com/calendario.html?fecha=2026-08-21', { waitUntil: 'networkidle', timeout: 30000 });
    await dfPage.waitForTimeout(3000);
    const calLinks = await dfPage.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => ({
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        href: a.href
      }));
    });
    console.log(`DataFut Matches on 2026-08-21 Calendar: ${calLinks.length}`);
    calLinks.forEach(m => console.log(` - ${m.text} -> ${m.href}`));
  } catch(e) {
    console.log('Calendar error:', e.message);
  }

  await browser.close();
})();
