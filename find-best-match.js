const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.join(__dirname, 'datafut-session.json'),
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });

  const matches = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="partido.html"]'));
    return links.map(a => {
      const text = a.innerText.replace(/\n+/g, ' ').trim();
      const href = a.getAttribute('href');
      return { text, href };
    });
  });

  console.log('--- AVAILABLE MATCHES TODAY ---');
  matches.forEach((m, idx) => console.log(`[${idx}]`, m.text, '-->', m.href));

  // Inspect detail of top 3 matches
  for (let i = 0; i < Math.min(matches.length, 3); i++) {
    const fullUrl = new URL(matches[i].href, 'https://data-fut.com').href;
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    const details = await page.evaluate(() => {
      const title = document.title;
      const text = document.body.innerText;
      return { title, textSnippet: text.slice(0, 1000).replace(/\n+/g, ' | ') };
    });
    console.log(`\n--- MATCH ${i} DETAILS ---`);
    console.log('Title:', details.title);
    console.log('Snippet:', details.textSnippet);
  }

  await browser.close();
})();
