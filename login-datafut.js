const { chromium } = require('C:/DataFut-Marketing/node_modules/@playwright/test');
const fs = require('fs');

(async () => {
  console.log('--- INICIANDO VENTANA DE LOGIN DE DATAFUT ---');
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext({
    viewport: {
      width: 450,
      height: 750
    }
  });

  const page = await context.newPage();
  await page.goto('https://data-fut.com/login.html');

  console.log('\n======================================================');
  console.log('Por favor ingresa tu correo y contraseña en la ventana.');
  console.log('El script detectará automáticamente el inicio de sesión.');
  console.log('======================================================\n');

  // Poll until token cookie exists
  let tokenFound = false;
  for (let i = 0; i < 180; i++) { // wait up to 3 minutes
    const cookies = await context.cookies('https://data-fut.com');
    const tokenCookie = cookies.find(c => c.name === 'token');
    if (tokenCookie && tokenCookie.value) {
      console.log('¡Token detectado con éxito!');
      tokenFound = true;
      break;
    }
    await page.waitForTimeout(1000);
  }

  if (tokenFound) {
    await page.waitForTimeout(1000);
    const savePath = 'C:/DataFut-Marketing/datafut-marketing-session.json';
    await context.storageState({ path: savePath });
    console.log(`Sesión guardada exitosamente en ${savePath}`);
  } else {
    console.log('Tiempo de espera agotado sin detectar sesión.');
  }

  await browser.close();
})();