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

  // Listen to console and network
  page.on('console', msg => console.log('PLAYDOIT CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PLAYDOIT PAGE ERROR:', err.message));

  console.log('Navigating to https://www.playdoit.mx ...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);

  // Check buttons and links on home page
  const homeButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button')).map(el => ({
      text: el.innerText.trim(),
      href: el.getAttribute('href'),
      className: el.className
    })).filter(b => b.text.length > 0);
  });
  console.log('Home buttons/links:', homeButtons);

  // Click on "Deportes" button/link
  const deportesLink = await page.$('a:has-text("Deportes"), button:has-text("Deportes"), [href*="sports"], [href*="deportes"]');
  if (deportesLink) {
    console.log('Clicking Deportes link...');
    await deportesLink.click();
    await page.waitForTimeout(6000);
  }

  const postClickDetails = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 1000)
    };
  });
  console.log('Post Click Details:', postClickDetails);

  await page.screenshot({ path: path.join(__dirname, 'playdoit_after_deportes_click.png'), fullPage: true });

  await browser.close();
})();
