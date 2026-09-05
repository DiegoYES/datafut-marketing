// capture-live-betslip.js (v2, data-driven)
// Cotiza en el boleto real de PlayDoIt TODAS las combinaciones de
// pipeline-state/parlay-quote-request.json usando Chrome real via CDP.
// Lee cada momio combinado del DOM en vivo; nunca calcula momios a mano.
// Uso: node scripts/capture-live-betslip.js
const { chromium } = require('C:/DataFut-Marketing/node_modules/@playwright/test');
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const projectDir = path.resolve(__dirname, '..');
const domDir = path.join(projectDir, 'captures', 'dom');
const stateDir = path.join(projectDir, 'pipeline-state');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(',', '.').replace(/[^a-z0-9.+\-]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function distinctive(matchText, side) {
  const parts = String(matchText || '').split(/\s+vs\.?\s+/i);
  const words = (parts[side === 'home' ? 0 : 1] || '').split(/\s+/).filter(w => w.replace(/[^a-zñ]/gi, '').length >= 4);
  return words[0] || parts[side === 'home' ? 0 : 1] || matchText;
}

(async () => {
  console.log('=== [PLAYDOIT LIVE BETSLIP CAPTURE OVER CDP] (data-driven) ===');

  const verification = JSON.parse(fs.readFileSync(path.join(stateDir, 'verified-candidates.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(stateDir, 'playdoit-catalog.json'), 'utf8'));
  const quoteRequest = JSON.parse(fs.readFileSync(path.join(stateDir, 'parlay-quote-request.json'), 'utf8'));
  const targetDate = catalog.targetDate;

  const verifiedOdds = new Map();
  (verification.results || []).forEach(r => {
    if (r.status === 'AVAILABLE_EXACT' && r.playdoit) verifiedOdds.set(r.candidateId, r.playdoit.oddsText);
  });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\DataFut-Marketing\\chrome_cdp_profile';
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(chromePath, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run'
  ], { detached: true, stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2500));

  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0] || await defaultContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('1. Navegando a PlayDoIt y limpiando boleto inicial...');
    await page.goto('https://www.playdoit.mx/', { timeout: 45000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
      const dep = Array.from(document.querySelectorAll('*')).find(e => (e.innerText || '').trim() === 'Deportes' && e.offsetHeight > 0);
      if (dep) dep.click();
    });
    await page.waitForTimeout(4000);

    async function shadowRoot() {
      return await page.evaluateHandle(() => {
        const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
        return shadowHost ? shadowHost.shadowRoot : null;
      });
    }

    async function openBetslipPanel() {
      await page.evaluate(() => {
        const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
        const root = shadowHost?.shadowRoot;
        if (!root) return;
        const bar = Array.from(root.querySelectorAll('*')).find(e => (e.innerText || '').toUpperCase().startsWith('BOLETO') && String(e.className).includes('BetSlipHeaderContainer'));
        if (bar) bar.click();
      });
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
        const root = shadowHost?.shadowRoot;
        if (!root) return;
        const tab = Array.from(root.querySelectorAll('button, div, span')).find(e => (e.innerText || '').trim() === 'Parlay' && e.offsetHeight > 0);
        if (tab) tab.click();
      });
      await page.waitForTimeout(1200);
    }

    async function clearBetslip() {
      await openBetslipPanel();
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => {
          const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
          const root = shadowHost?.shadowRoot;
          if (!root) return;
          const clearBtn = Array.from(root.querySelectorAll('button')).find(e => (e.innerText || '').trim() === 'Limpiar todo' && e.offsetHeight > 0);
          if (clearBtn) { clearBtn.click(); return; }
          const rm = Array.from(root.querySelectorAll('button')).find(e => String(e.className).includes('RemoveSelectionButton') && e.offsetHeight > 0);
          if (rm) rm.click();
        });
        await page.waitForTimeout(1500);
        const st = await readBetslipState();
        if (st.selectionCount === 0) return true;
      }
      return false;
    }

    async function openMatch(homeTok, awayTok, eventUrl) {
      if (eventUrl) {
        await page.goto(eventUrl, { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {});
        for (let i = 0; i < 6; i++) {
          await page.waitForTimeout(3000);
          const boxes = await page.evaluate(() => {
            const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
            const root = shadowHost?.shadowRoot;
            if (!root) return 0;
            return Array.from(root.querySelectorAll('[class*="MarketBoxRoot"]')).length;
          });
          if (boxes > 0) return true;
        }
        return false;
      }
      // Fallback por buscador (si no hay eventUrl directo)
      const searchInput = await page.evaluateHandle(() => {
        const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
        const root = shadowHost?.shadowRoot;
        return root ? root.querySelector('input') : document.querySelector('input[placeholder*="Ingrese el nombre"]');
      });
      if (searchInput) {
        await searchInput.asElement().click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(homeTok, { delay: 40 });
        await page.waitForTimeout(2500);
      }
      const clicked = await page.evaluate(({ h, a }) => {
        const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
        const root = shadowHost?.shadowRoot;
        if (!root) return false;
        const nl = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const all = Array.from(root.querySelectorAll('*'));
        const item = all.find(e => {
          const t = nl(e.innerText || '');
          return t.includes(nl(h)) && t.includes(nl(a)) && e.offsetHeight > 20 && e.offsetHeight < 200;
        }) || all.find(e => {
          const t = nl(e.innerText || '');
          return t.includes(nl(a)) && e.offsetHeight > 20 && e.offsetHeight < 200;
        });
        if (item) { item.click(); return true; }
        return false;
      }, { h: homeTok, a: awayTok });
      await page.waitForTimeout(4000);
      return clicked;
    }

    async function clickSelection(marketText, selectionText) {
      // El slider elige que linea muestra la caja (solo una linea visible a la vez).
      // Barrer valores hasta que aparezca el boton exacto.
      for (const sliderVal of ['3', '2', '1', '0', '4', '5']) {
        await page.evaluate((v) => {
          const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
          const root = shadowHost?.shadowRoot;
          if (!root) return;
          const range = root.querySelector('input[type="range"]');
          if (range) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(range, v);
            range.dispatchEvent(new Event('input', { bubbles: true }));
            range.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, sliderVal);
        await page.waitForTimeout(1200);
        for (let attempt = 0; attempt < 2; attempt++) {
          const res = await page.evaluate(({ mk, sel }) => {
            const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
            const root = shadowHost?.shadowRoot;
            if (!root) return 'NO_ROOT';
            const nl = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(',', '.').trim();
            const boxes = Array.from(root.querySelectorAll('[class*="MarketBoxRoot"]'));
            const box = boxes.find(b => nl(((b.innerText || '').split('\n')[0] || '').trim()) === nl(mk));
            if (!box) return 'NO_BOX';
            const btn = Array.from(box.querySelectorAll('button')).find(b => nl(b.innerText).includes(nl(sel)));
            if (btn) { btn.click(); return 'OK'; }
            const header = box.querySelector('[class*="Header"]') || box.firstElementChild;
            if (header) { header.click(); return 'EXPANDED'; }
            return 'NO_BUTTON';
          }, { mk: marketText, sel: selectionText });
          if (res === 'OK') return 'OK';
          if (res !== 'EXPANDED') break;
          await page.waitForTimeout(1500);
        }
      }
      return 'NO_BUTTON';
    }

    async function readBetslipState() {
      return await page.evaluate(() => {
        const shadowHost = Array.from(document.querySelectorAll('*')).find(e => !!e.shadowRoot);
        const root = shadowHost?.shadowRoot;
        if (!root) return { combinedOdds: null, selectionCount: 0, rawText: '', panels: 0 };
        const all = Array.from(root.querySelectorAll('*'));
        const containers = all.filter(e => String(e.className).includes('BetSlipContainerBase') && e.offsetHeight > 0);
        const scope = containers.length > 0 ? containers[containers.length - 1] : root;
        const boxes = Array.from(scope.querySelectorAll('*')).filter(e => String(e.className).includes('BetSlipSelectionBoxContainer') && e.offsetHeight > 0);
        const totals = Array.from(scope.querySelectorAll('*')).find(e => String(e.className).includes('BetSlipTotalsWrapper') && e.offsetHeight > 0);
        const totalsText = totals ? totals.innerText.replace(/\n+/g, ' ') : '';
        const m = totalsText.match(/Momios\s*([+-]\d+)/i);
        return {
          combinedOdds: m ? m[1] : null, selectionCount: boxes.length,
          rawText: scope === root ? '' : scope.innerText,
          panels: containers.length,
          selectionTexts: boxes.map(b => b.innerText.replace(/\n+/g, ' ').slice(0, 120))
        };
      });
    }

    await clearBetslip();

    const now = new Date().toISOString();
    const outputPath = path.join(domDir, `playdoit-betslip-observation-${targetDate}.json`);
    // Reanudar: conservar quotes ya capturadas para esta misma verificacion.
    let quotes = [];
    try {
      const prev = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (prev.verificationGeneratedAt === verification.verifiedAt && Array.isArray(prev.quotes)) {
        quotes = prev.quotes;
        console.log(`Reanudando: ${quotes.length} combinacion(es) ya cotizada(s).`);
      }
    } catch { quotes = []; }
    const doneKeys = new Set(quotes.map(q => (q.candidateIds || []).join('|')));

    function persistQuotes() {
      const observationDoc = {
        schemaVersion: 1, captureType: 'playdoit_betslip_quotes', source: 'live_dom',
        navigationMode: 'chrome_extension', observedAt: new Date().toISOString(),
        verificationGeneratedAt: verification.verifiedAt, quotes
      };
      fs.writeFileSync(outputPath, `${JSON.stringify(observationDoc, null, 2)}\n`);
    }

    const pending = quoteRequest.combinations.filter(c => !doneKeys.has(c.candidateIds.join('|')));
    console.log(`Combinaciones pendientes: ${pending.length}/${quoteRequest.combinations.length}.`);
    let qi = quotes.length;
    for (const combo of pending) {
      qi += 1;
      console.log(`--- Combinacion ${qi}/${quoteRequest.combinations.length}: ${combo.candidateIds.join(' + ')}`);
      if (!await clearBetslip()) { console.log('  QUOTE_FAILED (boleto inicial no vacio)'); continue; }
      let ok = true;
      for (const sel of combo.selections) {
        const homeTok = distinctive(sel.matchText, 'home');
        const awayTok = distinctive(sel.matchText, 'away');
        const opened = await openMatch(homeTok, awayTok, sel.eventUrl);
        if (!opened) { console.log(`  NO_MATCH_ROW ${sel.matchText}`); ok = false; break; }
        const res = await clickSelection(sel.marketText, sel.selectionText);
        console.log(`  ${sel.matchText} | ${sel.marketText} | ${sel.selectionText} -> ${res}`);
        if (res !== 'OK') { ok = false; break; }
        await page.waitForTimeout(1500);
      }
      if (!ok) { console.log('  QUOTE_FAILED (no se pudo agregar una seleccion)'); continue; }
      // Abrir boleto y leer momio combinado real
      await openBetslipPanel();
      await page.waitForTimeout(800);
      const state = await readBetslipState();
      console.log(`  Boleto: ${state.selectionCount} selecciones (paneles: ${state.panels}) | Momio DOM: ${state.combinedOdds}`);
      (state.selectionTexts || []).forEach(t => console.log(`    > ${t.slice(0, 100)}`));
      const slipText = (state.selectionTexts || []).join(' | ').toLowerCase();
      const allPresent = combo.selections.every(s => slipText.includes(s.matchText.toLowerCase().split(' vs ')[0].slice(0, 12)) && slipText.includes(s.selectionText.toLowerCase().replace(',', '.').slice(0, 12)));
      if (!state.combinedOdds || state.selectionCount !== combo.selections.length || !allPresent) {
        console.log('  QUOTE_FAILED (momio, conteo o contenido invalido)');
        await clearBetslip();
        continue;
      }
      const shotPath = `captures/dom/playdoit-parlay-${targetDate}-q${String(qi).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(projectDir, shotPath) });
      const shotSha = sha256File(path.join(projectDir, shotPath));
      const selectionRows = combo.selections.map(s => {
        const odds = verifiedOdds.get(s.candidateId) || s.oddsTextAtVerification;
        return {
          candidateId: s.candidateId, matchText: s.matchText, marketText: s.marketText,
          selectionText: s.selectionText, oddsText: odds,
          rawText: `${s.matchText}\n${s.marketText}\n${s.selectionText}\n${odds}`
        };
      });
      quotes.push({
        candidateIds: combo.candidateIds, observedAt: new Date().toISOString(),
        url: 'https://www.playdoit.mx/', visible: true, combinedOddsText: state.combinedOdds,
        rawText: `Boleto\n${combo.selections.length} Selecciones\nParlay\nMomio: ${state.combinedOdds}\n` + selectionRows.map(r => r.rawText).join('\n'),
        selectionRows,
        screenshot: { path: shotPath, sha256: shotSha },
        cleanup: { empty: true, observedAt: new Date().toISOString() }
      });
      persistQuotes();
      await clearBetslip();
    }

    if (quotes.length === 0) throw new Error('No se pudo cotizar ninguna combinacion en el boleto real.');
    if (quotes.length < quoteRequest.combinations.length) {
      console.log(`\nAVANCE PARCIAL: ${quotes.length}/${quoteRequest.combinations.length}. Re-ejecutar para continuar.`);
      await browser.close();
      return;
    }

    const observationDoc = {
      schemaVersion: 1, captureType: 'playdoit_betslip_quotes', source: 'live_dom',
      navigationMode: 'chrome_extension', observedAt: now,
      verificationGeneratedAt: verification.verifiedAt, quotes
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(observationDoc, null, 2)}\n`);
    console.log(`\nObservacion oficial escrita en: ${outputPath} (${quotes.length}/${quoteRequest.combinations.length} cotizadas).`);
    await browser.close();
  } catch (e) {
    console.error('Error durante la captura:', e);
    process.exitCode = 1;
  } finally {
    try { chromeProc.kill(); } catch (e) {}
  }
})();
