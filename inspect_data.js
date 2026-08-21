const { chromium } = require('./node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const sessionPath = path.join(__dirname, 'datafut-marketing-session.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const matches = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="partido.html"]'))
      .map(a => ({
        text: a.innerText.replace(/\n+/g, ' ').trim(),
        href: a.getAttribute('href')
      }));
  });

  console.log(`Found ${matches.length} match links on home.`);

  const list = [];

  for (const m of matches) {
    const fullUrl = new URL(m.href, 'https://data-fut.com').href;
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const matchInfo = await page.evaluate(() => {
      const pageTitle = document.title;
      // Get all text content
      const text = document.body.innerText;
      
      // Look for cards or predictions specifically
      const cards = Array.from(document.querySelectorAll('.card, .pick-card, [class*="pick"], [class*="card"], [class*="prediction"]'))
        .map(c => c.innerText.replace(/\n+/g, ' ').trim());

      return {
        pageTitle,
        text,
        cards
      };
    });

    list.push({
      matchText: m.text,
      url: fullUrl,
      title: matchInfo.pageTitle,
      text: matchInfo.text
    });
  }

  fs.writeFileSync(path.join(__dirname, 'candidates.json'), JSON.stringify(list, null, 2));
  console.log('Saved candidates.json successfully');

  await browser.close();
})();
