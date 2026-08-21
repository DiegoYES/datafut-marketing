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
  console.log('Navigating to PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Test odd IDs from verified candidates:
  // e.g. DF-001 (Leones FC under 3.5), DF-002 (Athletic under 3.5), DF-003 (Novorizontino under 3.5)
  const verified = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pipeline-state', 'verified-candidates.json'), 'utf8'));
  const testOdds = verified.results.slice(0, 5).map(r => ({
    candidateId: r.candidateId,
    match: r.requested.match,
    oddId: r.playdoit.oddId,
    marketId: r.playdoit.marketId,
    price: r.playdoit.priceDecimal
  }));

  console.log('Test Odds to combine:', testOdds);

  const apiTest = await page.evaluate(async (oddsList) => {
    const endpoints = [
      'https://sb2frontend-altenar2.biahosted.com/api/widget/Calculate',
      'https://sb2frontend-altenar2.biahosted.com/api/widget/CalculateBet',
      'https://sb2frontend-altenar2.biahosted.com/api/widget/GetBetslip',
      'https://sb2frontend-altenar2.biahosted.com/api/widget/GetOdds',
      'https://sb2frontend-altenar2.biahosted.com/api/widget/GetOddsInfo'
    ];

    const results = {};

    for (const ep of endpoints) {
      try {
        const oddIds = oddsList.map(o => o.oddId).join(',');
        const res = await fetch(`${ep}?culture=es-ES&timezoneOffset=360&integration=playdoit2&oddIds=${oddIds}`);
        results[ep] = { status: res.status, ok: res.ok, text: (await res.text()).slice(0, 300) };
      } catch(e) {
        results[ep] = { error: e.message };
      }
    }

    return results;
  }, testOdds);

  console.log('API Test Results:', JSON.stringify(apiTest, null, 2));

  await browser.close();
})();
