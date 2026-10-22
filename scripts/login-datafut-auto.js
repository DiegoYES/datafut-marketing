const { chromium } = require('C:/DataFut-Marketing/node_modules/@playwright/test');
const fs = require('fs');
const env = {};
for (const line of fs.readFileSync('C:/DataFut-Marketing/.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
(async () => {
  const browser = await chromium.launch({ headless: !process.env.HEADFUL });
  const context = await browser.newContext({ viewport: { width: 480, height: 780 } });
  const page = await context.newPage();
  await page.goto('https://data-fut.com/login.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const ok = await page.evaluate(({ email, pass }) => {
    const emailInput = document.querySelector('input[type="email"], input[name*="mail" i], input[autocomplete*="email" i]') || document.querySelector('form input:not([type="password"])');
    const passInput = document.querySelector('input[type="password"]');
    if (!emailInput || !passInput) return 'NO_FIELDS';
    const setV = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setV(emailInput, email);
    setV(passInput, pass);
    return 'FILLED';
  }, { email: env.DATAFUT_EMAIL, pass: env.DATAFUT_PASSWORD });
  if (ok !== 'FILLED') { console.log(`ERROR: ${ok}`); await browser.close(); process.exitCode = 1; return; }
  const submitHit = page.getByRole('button', { name: /iniciar sesi|acced|entrar|login|ingresar/i }).first();
  await submitHit.click({ timeout: 15000 }).catch(async () => {
    await page.keyboard.press('Enter');
  });
  let auth = false;
  for (let i = 0; i < 60 && !auth; i++) {
    await page.waitForTimeout(2000);
    const cookies = await context.cookies('https://data-fut.com');
    auth = !!(cookies.find(c => c.name === 'token' && c.value));
    const left = !/\/login\.html(?:$|[?#])/i.test(page.url());
    auth = auth || left;
  }
  if (!auth) { console.log('ERROR: no detecto sesion tras submitting.'); await page.screenshot({ path: 'captures/dom/login-diag.png' }); await browser.close(); process.exitCode = 1; return; }
  await page.waitForTimeout(1500);
  await context.storageState({ path: 'C:/DataFut-Marketing/datafut-marketing-session.json' });
  console.log('SESION_OK自动 guardada (login-datafut-auto.js)');
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; });
