const { chromium } = require('./node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = path.join(__dirname, 'raw-union-central');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log('--- CAPTURING PURE CLEAN COMPONENT ASSETS FOR V3 REEL ---');
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
  await page.waitForTimeout(2500);

  // STRICT DOM CLEANUP - Remove ALL session, user, profile, header, sidebar, drawer elements
  await page.evaluate(() => {
    // Hide/remove all header/nav/user/admin/drawer elements
    const elementsToRemove = document.querySelectorAll(
      'header, nav, aside, [class*="user"], [class*="profile"], [class*="avatar"], [class*="admin"], [class*="sidebar"], [class*="drawer"], [href*="logout"], [href*="admin"], [href*="profile"], button, a'
    );
    elementsToRemove.forEach(el => {
      const txt = (el.innerText || '').toLowerCase();
      if (txt.includes('marketing') || txt.includes('premium') || txt.includes('perfil') || txt.includes('salir') || txt.includes('suscripción') || txt.includes('boletas') || txt.includes('día(s)') || txt.includes('guiá') || txt.includes('inicio') || txt.includes('calendario')) {
        el.style.display = 'none';
        if (el.parentElement && el.parentElement.tagName === 'NAV') {
          el.parentElement.style.display = 'none';
        }
      }
    });

    // Also remove top bar if present
    const allDivs = document.querySelectorAll('div, span, p');
    allDivs.forEach(div => {
      const txt = (div.innerText || '').trim();
      if (txt.startsWith('👤') || txt.includes('2912222') || txt.includes('marketing') || txt === 'Salir' || txt.includes('Mi suscripción')) {
        div.style.display = 'none';
      }
    });
  });

  await page.waitForTimeout(500);

  // 1. Capture clean match header (Teams, VS, League)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(dir, 'v3-clean-header.png') });
  console.log('Saved v3-clean-header.png');

  // 2. Scroll to prediction / stats card and capture
  await page.evaluate(() => {
    const pickEl = document.querySelector('[class*="pick"]') || document.querySelector('#picks') || document.body;
    pickEl.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dir, 'v3-clean-pick.png') });
  console.log('Saved v3-clean-pick.png');

  // 3. Scroll to evidence section
  await page.evaluate(() => {
    window.scrollBy(0, 300);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dir, 'v3-clean-evidence.png') });
  console.log('Saved v3-clean-evidence.png');

  console.log('--- V3 CLEAN ASSETS CAPTURED SUCCESSFULLY ---');
  await browser.close();
})();
