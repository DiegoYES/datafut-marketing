const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sessionPath = path.join(__dirname, '..', 'datafut-marketing-session.json');
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  console.log('Navigating to DataFut...');
  await page.goto('https://data-fut.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const title = await page.title();
  const url = page.url();
  console.log('Title:', title);
  console.log('URL:', url);

  // Check login state
  const isLogged = await page.evaluate(() => {
    return document.body.innerText.includes('Cerrar sesión') || 
           document.body.innerText.includes('Mi Perfil') || 
           document.body.innerText.includes('Perfil') ||
           !document.body.innerText.includes('Iniciar sesión');
  });
  console.log('Is logged in:', isLogged);

  // Find all match links
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({
        text: a.innerText.trim().replace(/\n+/g, ' | '),
        href: a.getAttribute('href')
      }))
      .filter(l => l.href && (l.href.includes('partido') || l.href.includes('match') || l.href.includes('fixture') || l.href.includes('game')));
  });

  console.log(`Found ${links.length} match links:`);
  console.log(JSON.stringify(links, null, 2));

  // Let's also check all league links or menu items if match links are few
  const allNav = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('nav a, header a, .menu a, .sidebar a'))
      .map(a => ({ text: a.innerText.trim(), href: a.getAttribute('href') }));
  });
  console.log('Nav links:', allNav);

  await browser.close();
})();
