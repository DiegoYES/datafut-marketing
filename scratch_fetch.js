const { chromium } = require('./node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('--- FETCHING MATCHES & PREDICTIONS FROM DATAFUT ---');
  const sessionPath = path.join(__dirname, 'datafut-marketing-session.json');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 390, height: 844 }
  });
  
  const page = await context.newPage();
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Extract all matches visible on home or navigation
  const pageData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const matchLinks = links
      .filter(a => {
        const href = a.getAttribute('href') || '';
        return href.includes('partido') || href.includes('match') || href.includes('game') || href.includes('/m/');
      })
      .map(a => ({
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        href: a.getAttribute('href')
      }));

    const bodyText = document.body.innerText;
    return { matchLinks, bodyTextSnippet: bodyText.slice(0, 1500) };
  });

  console.log(`Found ${pageData.matchLinks.length} match links.`);

  const matchesDetails = [];

  for (let i = 0; i < pageData.matchLinks.length; i++) {
    const m = pageData.matchLinks[i];
    const fullUrl = new URL(m.href, 'https://data-fut.com').href;
    console.log(`Navigating to [${i+1}/${pageData.matchLinks.length}]: ${fullUrl}`);
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const details = await page.evaluate(() => {
      const title = document.title;
      const fullText = document.body.innerText;
      return {
        title,
        fullText
      };
    });

    matchesDetails.push({
      match: m.text,
      url: fullUrl,
      title: details.title,
      text: details.fullText
    });
  }

  fs.writeFileSync(path.join(__dirname, 'predictions_raw.json'), JSON.stringify(matchesDetails, null, 2));
  console.log('Saved predictions to predictions_raw.json');

  await browser.close();
})();
