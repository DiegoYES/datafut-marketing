const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const rawDir = path.join(__dirname, 'raw');
  if (!fs.existsSync(rawDir)) {
    fs.mkdirSync(rawDir, { recursive: true });
    console.log('Created directory:', rawDir);
  }

  console.log('--- STARTING PROMO ASSET GENERATION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.join(__dirname, 'datafut-session.json'),
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2 // High DPI for crisp promotional screenshots
  });

  const page = await context.newPage();

  // 1. PÁGINA PRINCIPAL DE DATAFUT
  console.log('Step 1: Navigating to homepage...');
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take full desktop viewport screenshot of home
  const img1Path = path.join(rawDir, '01-inicio.png');
  await page.screenshot({ path: img1Path });
  console.log('Saved:', img1Path);

  // Find all available matches to evaluate the best promotional pick
  const matches = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="partido.html"]'));
    return links.map(a => ({
      text: a.innerText.replace(/\n+/g, ' ').trim(),
      href: a.getAttribute('href')
    }));
  });

  console.log('Available matches on home:', matches);

  // Let's pick the match with highest sample/consistency candidate if available
  // e.g. Stromsgodset vs Egersund (Más de 0.5 goles 82.6% · muestra 7) or Haugesund vs Raufoss
  let promoMatch = matches.find(m => m.text.includes('82.6%')) || matches[0];
  console.log('Selected promotional match:', promoMatch);

  // 2. PARTIDO SELECCIONADO
  console.log('Step 2: Navigating to selected match...');
  const matchFullUrl = new URL(promoMatch.href, 'https://data-fut.com').href;
  await page.goto(matchFullUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Ensure top header & score are cleanly visible
  await page.evaluate(() => window.scrollTo(0, 0));
  const img2Path = path.join(rawDir, '02-partido.png');
  await page.screenshot({ path: img2Path });
  console.log('Saved:', img2Path);

  // 3. SECCIÓN DONDE APARECE LA PREDICCIÓN
  console.log('Step 3: Navigating to predictions section...');
  // Scroll to picks section or click picks tab
  await page.evaluate(() => {
    const picksBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Picks del partido'));
    if (picksBtn) picksBtn.click();

    const picksSection = document.querySelector('#picks') || document.querySelector('[class*="pick"]');
    if (picksSection) {
      picksSection.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else {
      window.scrollTo(0, 400);
    }
  });
  await page.waitForTimeout(1500);

  const img3Path = path.join(rawDir, '03-prediccion.png');
  await page.screenshot({ path: img3Path });
  console.log('Saved:', img3Path);

  // 4. VISTA CLARA DEL PORCENTAJE Y MERCADO SELECCIONADO
  console.log('Step 4: Framing specific prediction card with percentage and market...');
  // Locate the pick card containing percentage, click '¿Por qué ...?' if available to expand detail
  const cardFound = await page.evaluate(() => {
    const whyBtn = Array.from(document.querySelectorAll('button, a, div')).find(el => el.innerText && el.innerText.includes('¿Por qué'));
    if (whyBtn) {
      whyBtn.click();
      return true;
    }
    return false;
  });
  if (cardFound) {
    await page.waitForTimeout(1000);
  }

  // Scroll directly to the prediction card
  await page.evaluate(() => {
    const pickCard = document.querySelector('[class*="pick-card"]') || 
                     document.querySelector('[class*="card"]') ||
                     Array.from(document.querySelectorAll('div')).find(el => el.innerText && el.innerText.includes('%'));
    if (pickCard) {
      pickCard.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });
  await page.waitForTimeout(1000);

  const img4Path = path.join(rawDir, '04-porcentaje.png');
  // Capture a crisp screenshot of the framed section
  await page.screenshot({ path: img4Path });
  console.log('Saved:', img4Path);

  // Also take element-specific screenshot if possible for extra accuracy
  const pickCardElement = await page.$('[class*="pick-card"], [class*="card"]');
  if (pickCardElement) {
    const img4CropPath = path.join(rawDir, '04-porcentaje-card.png');
    await pickCardElement.screenshot({ path: img4CropPath });
    console.log('Saved element crop:', img4CropPath);
  }

  console.log('--- PROMO ASSET GENERATION FINISHED SUCCESSFULLY ---');
  await browser.close();
})();
