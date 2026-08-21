const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const rawMobileDir = path.join(__dirname, 'raw-mobile');
  if (!fs.existsSync(rawMobileDir)) {
    fs.mkdirSync(rawMobileDir, { recursive: true });
    console.log('Created directory:', rawMobileDir);
  }

  console.log('--- STARTING MOBILE ASSET GENERATION ---');
  const browser = await chromium.launch({ headless: true });
  
  // Mobile device emulation: iPhone 13/14 viewport (390x844), scaleFactor 3
  const context = await browser.newContext({
    storageState: path.join(__dirname, 'datafut-session.json'),
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();

  // 1. PÁGINA PRINCIPAL MÓVIL
  console.log('Step 1: Navigating to mobile homepage...');
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const img1Path = path.join(rawMobileDir, '01-inicio.png');
  await page.screenshot({ path: img1Path });
  console.log('Saved mobile home screenshot:', img1Path);

  // Find available match links
  const matches = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="partido.html"]'));
    return links.map(a => ({
      text: a.innerText.replace(/\n+/g, ' ').trim(),
      href: a.getAttribute('href')
    }));
  });

  console.log('Matches found on mobile home:', matches);

  // Pick top prediction candidate (e.g. Stromsgodset vs Egersund with 82.6%)
  let selectedMatch = matches.find(m => m.text.includes('82.6%')) || matches[0];
  console.log('Selected match for mobile promo:', selectedMatch);

  // 2. PARTIDO SELECCIONADO EN MÓVIL
  console.log('Step 2: Navigating to mobile match center...');
  const matchFullUrl = new URL(selectedMatch.href, 'https://data-fut.com').href;
  await page.goto(matchFullUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.evaluate(() => window.scrollTo(0, 0));
  const img2Path = path.join(rawMobileDir, '02-partido.png');
  await page.screenshot({ path: img2Path });
  console.log('Saved mobile match screenshot:', img2Path);

  // 3. SECCIÓN DE PREDICCIÓN EN MÓVIL
  console.log('Step 3: Scrolling to predictions section on mobile...');
  await page.evaluate(() => {
    const picksSection = document.querySelector('#picks') || document.querySelector('[class*="pick"]');
    if (picksSection) {
      picksSection.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else {
      window.scrollTo(0, 350);
    }
  });
  await page.waitForTimeout(1500);

  const img3Path = path.join(rawMobileDir, '03-prediccion.png');
  await page.screenshot({ path: img3Path });
  console.log('Saved mobile prediction screenshot:', img3Path);

  // 4. VISTA ENCUADRADA DEL PORCENTAJE EN MÓVIL
  console.log('Step 4: Focusing prediction card and percentage on mobile...');
  // Click '¿Por qué ...?' button if available on mobile
  await page.evaluate(() => {
    const whyBtn = Array.from(document.querySelectorAll('button, a, div')).find(el => el.innerText && el.innerText.includes('¿Por qué'));
    if (whyBtn) whyBtn.click();
  });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const pickCard = document.querySelector('[class*="pick-card"]') || 
                     document.querySelector('[class*="card"]') ||
                     Array.from(document.querySelectorAll('div')).find(el => el.innerText && el.innerText.includes('%'));
    if (pickCard) {
      pickCard.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });
  await page.waitForTimeout(1000);

  const img4Path = path.join(rawMobileDir, '04-porcentaje.png');
  await page.screenshot({ path: img4Path });
  console.log('Saved mobile percentage screenshot:', img4Path);

  // Element crop of the mobile card
  const cardElem = await page.$('[class*="pick-card"], [class*="card"]');
  if (cardElem) {
    const cropPath = path.join(rawMobileDir, '04-porcentaje-card.png');
    await cardElem.screenshot({ path: cropPath });
    console.log('Saved mobile card element crop:', cropPath);
  }

  console.log('--- MOBILE ASSET GENERATION FINISHED SUCCESSFULLY ---');
  await browser.close();
})();
