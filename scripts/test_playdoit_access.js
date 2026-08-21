const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Testing PlayDoIt navigation...');
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  
  let browser;
  let navigationMode = 'headless';
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (e) {
    console.error('Failed to launch headless browser:', e);
    return;
  }

  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  
  try {
    console.log('Navigating to https://www.playdoit.mx/sports ...');
    const response = await page.goto('https://www.playdoit.mx/sports', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    console.log('Response status:', response ? response.status() : 'none');
    await page.waitForTimeout(5000);
    
    const title = await page.title();
    const url = page.url();
    console.log('Page Title:', title);
    console.log('Page URL:', url);

    const bodyTextSnippet = await page.evaluate(() => document.body.innerText.slice(0, 1000));
    console.log('Body text snippet:', bodyTextSnippet.replace(/\n+/g, ' '));

    // Check if Cloudflare challenge is present
    const isCloudflare = await page.evaluate(() => {
      return document.title.includes('Just a moment') || document.body.innerText.includes('Cloudflare') || document.body.innerText.includes('Verifying you are human');
    });
    console.log('Is Cloudflare blocked:', isCloudflare);

  } catch (err) {
    console.error('Navigation error:', err.message);
  } finally {
    await browser.close();
  }
})();
