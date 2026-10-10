// publish-to-datafut.js
// Publica un finalista oficial del pipeline como Pick del Dia en DataFut.
// Flujo Playwright con la sesion marketing (sin passwords, sin API inventada):
//   1. Puerta de auditoria: la opcion debe ser finalista oficial publicado.
//   2. Por cada seleccion: abre su tarjeta DataFut (sourceUrl de Discovery)
//      y pulsa "Guardar pick".
//   3. Panel Mis boletas -> "Guardar Boleta (N)" -> modal Nombrar boleta.
//   4. En la boleta propia -> "Recomendar en Picks del Dia".
//   5. Modal: titulo(=boleta), visibilidad, estado=Publicar ahora,
//      momio decimal (del americano real del boleto PlayDoIt),
//      destacar=Destacada, visible hasta = ahora + 24h, analisis.
//   6. Por defecto DRY-RUN: evidencia y se detiene SIN publicar.
//      Solo con --publish se envia el formulario.
// Uso:
//   node scripts/publish-to-datafut.js --option <optionId> --visibility <gratis|premium> [--dry-run|--publish] [--boleta-name "..."] [--project-dir C:\...]
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function optionValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
function hasFlag(name) {
  return process.argv.includes(name);
}

const projectDir = path.resolve(optionValue('--project-dir') || path.join(__dirname, '..'));
const stateDir = path.join(projectDir, 'pipeline-state');
const domDir = path.join(projectDir, 'captures', 'dom');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

function americanToDecimal(oddsText) {
  const n = Number(String(oddsText || '').replace('+', ''));
  if (!Number.isFinite(n) || n === 0) throw new Error(`Momio invalido: ${oddsText}`);
  const dec = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  return (Math.round(dec * 100) / 100).toFixed(2);
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const optionId = optionValue('--option');
  const visibility = (optionValue('--visibility') || '').toLowerCase();
  const doPublish = hasFlag('--publish');
  const dryRun = hasFlag('--dry-run') || !doPublish;
  if (!optionId) throw new Error('Uso: publish-to-datafut.js --option <optionId> --visibility <gratis|premium> [--publish]');
  if (!['gratis', 'premium'].includes(visibility)) throw new Error('visibility debe ser gratis|premium');

  // --- 1. Puerta de auditoria ---
  const catalog = readJson(path.join(stateDir, 'playdoit-catalog.json'));
  const verification = readJson(path.join(stateDir, 'verified-candidates.json'));
  const parlays = readJson(path.join(stateDir, 'parlay-options.json'));
  const discovery = readJson(path.join(stateDir, 'discovery-candidates.json'));
  if (catalog.catalogStatus !== 'VERIFIED') throw new Error('Catalog no VERIFIED: publicacion bloqueada.');
  if (!parlays.publishable || !Array.isArray(parlays.finalists)) throw new Error('Sin finalistas oficiales: publicacion bloqueada.');
  const finalist = parlays.finalists.find(f => f.candidateIds.join('+') === optionId || `PAR-${f.candidateIds.join('-')}` === optionId);
  if (!finalist) throw new Error(`Opcion ${optionId} no es finalista oficial.`);
  const discById = new Map((discovery.candidates || []).map(c => [c.candidateId, c]));
  const selections = finalist.candidateIds.map(id => {
    const d = discById.get(id);
    if (!d || !d.sourceUrl || !d.market) throw new Error(`Sin tarjeta DataFut trazable para ${id}.`);
    const v = (verification.results || []).find(r => r.candidateId === id);
    return { candidateId: id, match: d.match, market: d.market, percentage: d.percentage, sample: d.sample, sourceUrl: d.sourceUrl, oddsText: v?.playdoit?.oddsText };
  });
  const momioDecimal = americanToDecimal(finalist.combinedOddsText);
  console.log(`Opcion oficial: ${optionId} (${finalist.type} ${finalist.combinedOddsText} = ${momioDecimal} decimal), ${selections.length} picks. Modo: ${dryRun ? 'DRY-RUN (no publica)' : 'PUBLICAR'}.`);

  const browser = await chromium.launch({ headless: true });
  const shots = [];
  try {
    const ctx = await browser.newContext({
      storageState: path.join(projectDir, 'datafut-marketing-session.json'),
      viewport: { width: 1600, height: 900 }
    });
    const page = await ctx.newPage();
    const shot = async tag => {
      const p = `captures/dom/datafut-publish-${tag}.png`;
      await page.screenshot({ path: path.join(projectDir, p) });
      shots.push({ tag, path: p, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(projectDir, p))).digest('hex') });
    };
    // Estado limpio: cerrar modales previos sin tocar datos.
    await page.goto('https://data-fut.com/boletas.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1000);

    // --- 2. Guardar cada pick desde su tarjeta (clic JS: los botones
    // viven en contenedores virtualizados no visibles hasta scroll) ---
    for (const sel of selections) {
      await page.goto(sel.sourceUrl, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => {
        await page.goto(sel.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      });
      await sleep(5000);
      // Espera activa: abrir la pestana "Picks del partido" (lazy por clic).
      const tabState = await page.evaluate(async () => {
        for (let i = 0; i < 4; i++) {
          const tab = Array.from(document.querySelectorAll('button')).find(el => /^\s*picks del partido\s*$/i.test(el.innerText || ''));
          if (tab) { tab.scrollIntoView(); tab.click(); await new Promise(x => setTimeout(x, 5000)); return 'CLICKED'; }
          await new Promise(x => setTimeout(x, 2500));
        }
        return 'NO_TAB';
      }).catch(() => 'EVAL_FAIL');
      console.log(`  ${sel.candidateId} tab: ${tabState}`);
      await sleep(2000);
      let saved = 'NO_ENCONTRADO';
      for (let attempt = 0; attempt < 3 && (saved === 'NO_ENCONTRADO' || saved === 'SIN_BOTON'); attempt++) {
        try {
          const art = page.locator('article', { hasText: sel.market }).first();
          await art.scrollIntoViewIfNeeded({ timeout: 20000 });
          const artText = await art.innerText().catch(() => '');
          sel.livePct = ((artText.match(/(\d+(?:[.,]\d+)?)\s*%/) || [])[1] || '?');
          const btn = art.getByRole('button', { name: /^guardar pick$/i });
          if ((await btn.count()) === 0) {
            const txt = await art.innerText().catch(() => '');
            saved = /guardado/i.test(txt) ? 'YA_GUARDADO' : 'SIN_BOTON';
          } else {
            await btn.first().click({ timeout: 20000 });
            await page.waitForFunction(
              m => Array.from(document.querySelectorAll('article')).some(a => (a.innerText || '').includes(m) && /guardado/i.test(a.innerText || '')),
              sel.market, { timeout: 15000 }
            );
            saved = 'GUARDADO';
          }
        } catch {
          saved = 'NO_ENCONTRADO';
          await sleep(4000);
        }
      }
      console.log(`  ${sel.candidateId} | ${sel.market} -> ${saved} (sitio hoy: ${sel.livePct || '?'}% vs certificado ${sel.percentage}%)`);
      if (saved === 'NO_ENCONTRADO') throw new Error(`Tarjeta no encontrada en DOM: ${sel.market}`);
      await sleep(2500);
    }
    await shot('picks-guardados');

    // Guarda: Por armar debe traer EXACTAMENTE nuestras selecciones.
    const porArmar = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('button')).find(x => /por armar/i.test(x.innerText || ''));
      const m = (el?.innerText || '').match(/\((\d+)\)/);
      return m ? Number(m[1]) : -1;
    }).catch(() => -1);
    console.log(`  Por armar: ${porArmar} (esperado ${selections.length})`);
    if (porArmar !== selections.length) throw new Error(`Por armar trae ${porArmar}, no ${selections.length}: boleta contaminada, aborto.`);

    // --- 3. Armar boleta con nombre propio ---
    const stamp = new Date();
    const hhmm = `${String(stamp.getHours()).padStart(2, '0')}:${String(stamp.getMinutes()).padStart(2, '0')}`;
    const boletaName = optionValue('--boleta-name') || `Parlay ${stamp.toISOString().slice(0, 10)} ${hhmm} ${finalist.combinedOddsText}`;
    await page.goto('https://data-fut.com/boletas.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);
    // Abrir panel Mis picks y pulsar Guardar Boleta (scroll + clic real).
    const pill = page.getByRole('button', { name: /mis picks/i }).first();
    let panelOpen = false;
    for (let attempt = 0; attempt < 4 && !panelOpen; attempt++) {
      await page.evaluate(() => {
        const el = document.querySelector('button.global-picks-trigger');
        if (el) { el.scrollIntoView(); el.click(); }
      }).catch(() => {});
      await sleep(2500);
      panelOpen = await page.evaluate(() => {
        const w = document.querySelector('aside.global-picks-widget');
        return !!w && w.offsetHeight > 0;
      }).catch(() => false);
    }
    if (!panelOpen) throw new Error('No abrio el panel Mis picks.');
    const created = await page.evaluate(() => {
      const b = document.querySelector('aside.global-picks-widget button.btn-create-boleta');
      if (!b) return false;
      b.scrollIntoView();
      b.click();
      return true;
    }).catch(() => false);
    if (!created) throw new Error('No se pudo pulsar Guardar Boleta.');
    await sleep(2500);
    const nameModal = page.locator('div.global-boleta-card').filter({ hasText: 'Nombrar boleta' }).first();
    await nameModal.waitFor({ timeout: 15000 });
    await page.locator('#global-boleta-modal-input').fill(boletaName, { timeout: 15000 });
    await nameModal.getByRole('button', { name: /^guardar boleta/i }).click({ timeout: 15000 });
    await page.getByText(boletaName, { exact: false }).first().waitFor({ timeout: 20000 });
    console.log(`  Boleta: "${boletaName}"`);
    await shot('boleta-creada');

    // --- 4. Recomendar en Picks del Dia (boton de NUESTRA boleta) ---
    // Esperar a que la tarjeta renderice (no el modal: nombre + pick).
    await page.waitForFunction(data => {
      const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
      return Array.from(document.querySelectorAll('h1,h2,h3')).some(h => {
        if ((h.innerText || '').trim() !== data.name) return false;
        let node = h.parentElement;
        while (node && node !== document.body) {
          const t = norm(node.innerText || '');
          if (t.includes(norm(data.firstMarket)) && node.querySelector('button.btn-admin-recomendar')) return true;
          node = node.parentElement;
        }
        return false;
      });
    }, { name: boletaName, firstMarket: selections[0].market }, { timeout: 30000 });
    const recClicked = await page.evaluate(data => {
      const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
      const heads = Array.from(document.querySelectorAll('h1,h2,h3')).filter(h => (h.innerText || '').trim() === data.name);
      for (const h of heads) {
        let node = h.parentElement;
        while (node && node !== document.body) {
          const t = norm(node.innerText || '');
          // La tarjeta correcta contiene el nombre Y el primer pick.
          if (t.includes(norm(data.firstMarket))) {
            const btn = node.querySelector('button.btn-admin-recomendar');
            if (btn) { btn.scrollIntoView(); btn.click(); return true; }
          }
          node = node.parentElement;
        }
      }
      return false;
    }, { name: boletaName, firstMarket: selections[0].market }).catch(() => false);
    console.log(`  Recomendar click en boleta propia: ${recClicked}`);
    if (!recClicked) throw new Error('No se encontro el boton Recomendar de la boleta creada.');
    const formModal = page.locator('.rec-modal-dialog:visible').first();
    await formModal.waitFor({ timeout: 20000 });
    console.log('  Modal Recomendar abierto.');

    // --- 5. Formulario (todo dentro del modal) ---
    const until = new Date(Date.now() + 24 * 3600 * 1000);
    const untilLocal = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(until.getDate()).padStart(2, '0')}T${String(until.getHours()).padStart(2, '0')}:${String(until.getMinutes()).padStart(2, '0')}`;
    const analisis = `Parlay ${finalist.type} ${finalist.combinedOddsText} (${momioDecimal} decimal). ` +
      selections.map(s => `${s.match}: ${s.market} (${s.percentage}% respaldo)`).join('. ') +
      '. Momio combinado leido del boleto real PlayDoIt.';
    const filled = {};
    // IDs reales del modal (verificados en DOM).
    const setById = async (id, want) => {
      const sel = formModal.locator(`#${id}`);
      await sel.selectOption({ label: want }, { timeout: 15000 });
      return `${want}`;
    };
    const estadoWant = optionValue('--estado') || 'Publicar ahora';
    filled.visibilidad = await setById('rec-modal-visibilidad', visibility === 'premium' ? 'Premium' : 'Gratis').catch(() => 'MISS');
    filled.estado = await setById('rec-modal-estado', estadoWant).catch(() => 'MISS');
    filled.destacar = await setById('rec-modal-destacada', '⭐ Destacada').catch(async () => {
      return await setById('rec-modal-destacada', 'Destacada').catch(() => 'MISS');
    });
    const momioBox = formModal.locator('div', { hasText: /momio \/ cuota total/i }).locator('input').first();
    await momioBox.fill(momioDecimal, { timeout: 15000 }).catch(() => {});
    filled.momio = (await momioBox.inputValue().catch(() => '')) === momioDecimal ? `OK:${momioDecimal}` : 'MISS';
    // Momios individuales (verificados PlayDoIt): inputs con placeholder
    // "Ej. 1.35". OBLIGATORIOS: sin ellos el submit falla validacion.
    // Mapeo por PAREJA de equipos (home+away), nunca posicional ni por
    // un solo lado (hay homonimos: Cordoba en Jaguares y en Boca).
    const toks = s => { const w = norm(s).replace(/\(.*?\)/g, '').split(' ').filter(Boolean); const long = w.filter(x => x.length >= 4); return long.length ? long : w; };
    const indivDec = selections.map(s => {
      const sides = s.match.split(' vs ').map(toks);
      return { sides, dec: americanToDecimal(s.oddsText) };
    });
    const indivRes = await page.evaluate(items => {
      const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      const out = [];
      const dlg = document.querySelector('.rec-modal-dialog');
      if (!dlg || dlg.offsetHeight === 0) return ['NO_MODAL'];
      const inputs = Array.from(dlg.querySelectorAll('input')).filter(i => i.offsetHeight > 0 && /ej\. 1\.35/i.test(i.placeholder || ''));
      for (const inp of inputs) {
        // Subir hasta el ancestro MAS PEQUENO que mencione un equipo.
        let node = inp.parentElement, best = '', g = 0;
        const cands = [];
        while (node && node !== dlg && g++ < 12) {
          const t = norm(node.innerText || '');
          if (t.length > 5) cands.push(t);
          node = node.parentElement;
        }
        cands.sort((a, b) => a.length - b.length);
        const row = cands.find(t => items.some(x => x.sides[0].some(tk => t.includes(tk)) || x.sides[1].some(tk => t.includes(tk)))) || '';
        const w = items.find(x => !x.done && x.sides[0].some(t => row.includes(t)) && x.sides[1].some(t => row.includes(t)));
        if (!w) { out.push('SKIP:' + row.slice(0, 60)); continue; }
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, '');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(inp, w.dec);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        w.done = true;
        out.push(w.sides.map(s => s[0]).join('+') + '=' + w.dec + (inp.value === w.dec ? ':OK' : ':FAIL'));
      }
      return out;
    }, indivDec.map(s => ({ sides: s.sides, dec: s.dec }))).catch(() => ['EVAL_FAIL']);
    filled.individuales = indivRes;
    console.log('  Individuales:', JSON.stringify(indivRes));
    const dtBox = formModal.locator('input[type="datetime-local"], input[type="datetime"]').first();
    const dtCount = await dtBox.count();
    if (dtCount > 0) {
      await dtBox.fill(untilLocal.slice(0, 16), { timeout: 15000 });
      filled.hasta = 'OK:' + untilLocal.slice(0, 16);
    } else {
      const dtText = formModal.locator('input').nth(1);
      if (await dtText.count() > 0) {
        await dtText.fill(`${String(until.getDate()).padStart(2, '0')}/${String(until.getMonth() + 1).padStart(2, '0')}/${until.getFullYear()} ${String(until.getHours()).padStart(2, '0')}:${String(until.getMinutes()).padStart(2, '0')}`, { timeout: 15000 });
        filled.hasta = 'OK(texto)';
      } else filled.hasta = 'MISS_HASTA';
    }
    await formModal.locator('textarea').first().fill(analisis, { timeout: 15000 });
    filled.analisis = 'OK';
    console.log('  Formulario:', JSON.stringify(filled));
    await shot('formulario-lleno');

    const evidence = {
      schemaVersion: 1, captureType: 'datafut_publish', source: 'live_dom',
      observedAt: new Date().toISOString(), dryRun,
      optionId, type: finalist.type, visibility,
      combinedOddsAmerican: finalist.combinedOddsText, combinedOddsDecimal: momioDecimal,
      boletaName, visibleUntil: until.toISOString(), selections, formFill: filled, screenshots: shots
    };
    const outPath = path.join(domDir, `datafut-publish-${dryRun ? 'dryrun' : 'live'}-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`Evidencia: ${outPath}`);

    if (dryRun) {
      console.log('DRY-RUN completo: formulario lleno, NO se publico. Revisa los PNG antes de --publish.');
    } else {
      await formModal.getByRole('button', { name: /publicar pick del d[ií]a/i }).click({ timeout: 20000 });
      // Verificacion fail-closed: la RECOMENDACION debe aparecer en picks
      // (no basta el nombre de la boleta: esa ya existe antes de publicar).
      let confirmed = false;
      for (let attempt = 0; attempt < 6 && !confirmed; attempt++) {
        await sleep(5000);
        await page.goto('https://data-fut.com/picks.html', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await sleep(4000);
        confirmed = await page.evaluate(data => {
          const body = document.body?.innerText || '';
          if (!body.includes(data.name)) return false;
          // La tarjeta publicada trae EDITAR MOMIOS (la boleta no).
          const idx = body.indexOf(data.name);
          const seg = body.slice(idx, idx + 1500);
          return /editar momios/i.test(seg) || /momio total/i.test(seg);
        }, { name: boletaName }).catch(() => false);
      }
      if (!confirmed) throw new Error('Submit enviado pero la publicacion NO aparece en picks: verificar manualmente.');
      console.log('  Publicacion CONFIRMADA en vivo.');
      await shot('publicado');
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
