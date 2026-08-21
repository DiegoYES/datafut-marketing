const { chromium } = require('./node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, 'raw-union-central');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log('--- RE-CAPTURING CLEAN COMPONENT ASSETS FOR UNIÓN VS CENTRAL CÓRDOBA ---');
  const browser = await chromium.launch({ headless: true });
  
  const sessionPath = path.join(__dirname, 'datafut-marketing-session.json');

  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  const matchUrl = 'https://data-fut.com/partido.html?local=441&visitante=1065&liga=128&partido=1493061&fecha=2026-08-10#picks';
  console.log('Navigating to:', matchUrl);
  await page.goto(matchUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // STAGE 1: Completely remove ANY session/user/header/nav element from DOM completely
  await page.evaluate(() => {
    // Remove header, user profile, nav bars, drawer menus, logout buttons, etc.
    const toRemove = [
      'header', 'nav', '[class*="user"]', '[class*="profile"]', '[class*="avatar"]',
      '[class*="admin"]', '[href*="logout"]', '[href*="admin"]', 'button:has-text("Salir")',
      'div:has-text("marketing")', 'div:has-text("Premium")', 'div:has-text("día(s)")'
    ];
    
    document.querySelectorAll('*').forEach(el => {
      const txt = el.innerText || '';
      if (txt.includes('marketing') || txt.includes('Premium ·') || txt.includes('Mi suscripción') || txt.includes('Cerrar sesión') || txt.includes('Salir')) {
        // If it's a small container or nav, hide or remove
        if (el.children.length < 5) {
          el.remove();
        }
      }
    });
  });

  // Let's find specific components (e.g. Match Card, Pick Card, Evidence Table)
  const components = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div, section, article')).filter(el => {
      const txt = el.innerText || '';
      return (txt.includes('Menos de 3.5') || txt.includes('73.1%') || txt.includes('Unión') && txt.includes('Central Córdoba')) && el.offsetWidth > 200 && el.offsetHeight > 100;
    });

    return cards.map((c, i) => {
      const rect = c.getBoundingClientRect();
      return { id: i, text: c.innerText.slice(0, 100), x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    });
  });

  console.log('Components found:', components);

  // Capture clean pick card bounding box screenshot
  const pickCardElement = await page.$('.card, [class*="pick"], [class*="card"]');
  if (pickCardElement) {
    await pickCardElement.screenshot({ path: path.join(dir, 'clean-pick-card.png') });
    console.log('Saved clean-pick-card.png');
  }

  // Take a clean targeted element screenshot of stats section
  const statsElement = await page.locator('text=Menos de 3.5 goles').locator('xpath=../..');
  if (await statsElement.count() > 0) {
    await statsElement.first().screenshot({ path: path.join(dir, 'clean-evidence-card.png') });
    console.log('Saved clean-evidence-card.png');
  } else {
    console.log('Locator not found, taking focused viewport screenshot...');
  }

  // Full page element cleanup screenshot
  await page.screenshot({ path: path.join(dir, '02-stats-table-clean.png') });
  console.log('Saved 02-stats-table-clean.png');

  await browser.close();
})();
