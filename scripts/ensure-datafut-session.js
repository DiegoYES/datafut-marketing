// ensure-datafut-session.js
// Verifica la sesion DataFut y, si expiro, reingresa solo con las
// credenciales de .env (gitignorado, jamas commitear).
// Uso: node scripts/ensure-datafut-session.js [--login]
// Sin --login solo verifica y reporta. Con --login renueva si hace falta.
// Los scripts del pipeline NO loguean solos: el agente ejecuta este helper
// cuando vea redireccion a login.html o sesion expirada.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
const SESSION_PATH = path.join(projectDir, 'datafut-marketing-session.json');
const ENV_PATH = path.join(projectDir, '.env');

function loadEnv() {
  const out = {};
  try {
    for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* sin .env: solo modo verificacion */ }
  return out;
}

async function sessionValid(browser) {
  const ctx = await browser.newContext({ storageState: SESSION_PATH });
  const page = await ctx.newPage();
  try {
    await page.goto('https://data-fut.com/calendario.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    return !/\/login\.html(?:$|[?#])/i.test(page.url());
  } finally {
    await ctx.close();
  }
}

async function login(env, browser) {
  if (!env.DATAFUT_EMAIL || !env.DATAFUT_PASSWORD) {
    throw new Error('Sin credenciales: completa .env (ver .env.example). No uses login manual salvo emergencia.');
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://data-fut.com/login.html', { waitUntil: 'networkidle', timeout: 45000 });
  await page.fill('#loginEmail', env.DATAFUT_EMAIL);
  await page.fill('#loginPassword', env.DATAFUT_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    page.click('button.submit')
  ]);
  await page.waitForTimeout(4000);
  if (/\/login\.html(?:$|[?#])/i.test(page.url())) throw new Error('Login rechazo credenciales de .env.');
  await ctx.storageState({ path: SESSION_PATH });
  await ctx.close();
}

(async () => {
  const wantLogin = process.argv.includes('--login');
  const browser = await chromium.launch({ headless: true });
  try {
    let valid = false;
    try { valid = await sessionValid(browser); } catch { valid = false; }
    if (valid) {
      console.log('SESSION_OK: datafut-marketing-session.json vigente.');
      return;
    }
    console.log('SESSION_EXPIRED.');
    if (!wantLogin) {
      console.log('Ejecuta con --login para renovar desde .env, o login-datafut manual.');
      process.exitCode = 2;
      return;
    }
    await login(loadEnv(), browser);
    console.log('SESSION_RENEWED desde .env.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
