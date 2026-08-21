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
  console.log('Navigating to PlayDoIt sports...');
  await page.goto('https://www.playdoit.mx/sports', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(6000);

  // Close cookie popup or any modal if present
  try {
    const closeBtn = await page.$('button.close, .cookie-close, [aria-label="Close"], button:has-text("✕")');
    if (closeBtn) {
      console.log('Clicking close button...');
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch(e) {
    console.log('No popup close button found or error:', e.message);
  }

  // Check what matches, leagues, sports, or search inputs exist
  const pageDetails = await page.evaluate(() => {
    const allText = document.body.innerText;
    
    // Find all inputs
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      placeholder: i.placeholder,
      id: i.id,
      className: i.className,
      value: i.value
    }));

    // Find all links or clickable items that look like events / sports
    const sportItems = Array.from(document.querySelectorAll('a, button, div, span, li'))
      .filter(el => {
        const t = (el.innerText || '').toLowerCase();
        return (
          t.includes('fútbol') || t.includes('futbol') || 
          t.includes('libertadores') || t.includes('sudamericana') || 
          t.includes('brasil') || t.includes('serie b') ||
          t.includes('corinthians') || t.includes('ldu') ||
          t.includes('athletic') || t.includes('novorizontino') ||
          t.includes('santos') || t.includes('cundinamarca')
        ) && el.children.length === 0;
      })
      .map(el => ({
        tag: el.tagName,
        text: el.innerText.trim(),
        className: el.className
      }));

    // Check all iframes if any
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
      src: f.src,
      id: f.id,
      className: f.className
    }));

    return {
      bodyLength: allText.length,
      bodyPreview: allText.slice(0, 2000),
      inputs,
      sportItems: sportItems.slice(0, 30),
      iframes
    };
  });

  console.log('Page Details Body Length:', pageDetails.bodyLength);
  console.log('Body Preview:\n', pageDetails.bodyPreview);
  console.log('\nInputs:', pageDetails.inputs);
  console.log('\nSport / Match Items Found:', pageDetails.sportItems);
  console.log('\nIframes:', pageDetails.iframes);

  await page.screenshot({ path: path.join(__dirname, 'playdoit_sports_dom.png'), fullPage: true });

  await browser.close();
})();
