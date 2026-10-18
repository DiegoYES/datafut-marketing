// build-catalog-observation.js
// Construye captures/dom/playdoit-catalog-observation-YYYY-MM-DD.json desde cero:
//  1. Lee el calendario DataFut de la fecha (sesion autenticada) y resuelve
//     titulos de enlaces pelados (cache operativo en Temp).
//  2. Cruza con el upcoming de PlayDoIt del mismo dia (CDMX) usando
//     config/team-aliases.json.
//  3. Por cada interseccion captura mercados con semantica demostrable +
//     captura PNG real y escribe la observacion oficial.
// Uso: node scripts/build-catalog-observation.js --date YYYY-MM-DD
//      node scripts/build-catalog-observation.js --date YYYY-MM-DD --events 123,456
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const projectDir = path.resolve(__dirname, '..');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const TEAM_NOISE = new Set(['ac', 'atletico', 'club', 'de', 'del', 'deportivo', 'deportes', 'el', 'fc', 'la', 'las', 'los', 'mg', 'sc', 'sjdr', 'sp', 'univ', 'universidad', 'cf', 'cd']);

function readAliasMap() {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(projectDir, 'config', 'team-aliases.json'), 'utf8'));
    return doc && typeof doc.aliases === 'object' ? doc.aliases : {};
  } catch { return {}; }
}

function variants(teamName, aliasMap) {
  const names = [teamName];
  for (const [canonical, list] of Object.entries(aliasMap || {})) {
    const group = [canonical, ...((Array.isArray(list) ? list : [list]).filter(Boolean))];
    if (group.some(n => norm(n) === norm(teamName))) names.push(...group);
  }
  return [...new Set(names.map(norm).filter(Boolean))];
}

function matchesTitle(homeTeam, awayTeam, title, aliasMap) {
  const t = norm(title);
  return variants(homeTeam, aliasMap).some(v => v && t.includes(v)) &&
    variants(awayTeam, aliasMap).some(v => v && t.includes(v));
}

function am(dec) {
  if (!dec || isNaN(dec) || dec <= 1) return '+100';
  if (dec >= 2) return `+${Math.round((dec - 1) * 100)}`;
  return `-${Math.round(100 / (dec - 1))}`;
}

// Solo mercados con semantica demostrable (mismo criterio del importador).
function acceptableMarket(marketText, homeTeam, awayTeam) {
  const m = norm(marketText);
  if (/roja/.test(m)) return false;
  const exact = ['total', 'goles totales', 'total de goles', 'total de corners', 'corners totales', 'total corners', 'total tiros de esquina', 'total de tiros', 'tiros totales', 'total de remates', 'remates totales', 'total de tiros a puerta', 'tiros a puerta totales', 'total de remates a puerta', 'remates a puerta totales', 'total de faltas', 'total de faltas cometidas', 'faltas totales', 'total de tarjetas', 'tarjetas totales', 'total tarjetas'].includes(m);
  const m1 = m.replace(/^(primera|segunda) mitad /, '');
  if (['total tiros de esquina', 'total de tarjetas'].includes(m1) && m !== m1) return true;
  if (exact) return true;
  const hn = norm(homeTeam), an = norm(awayTeam);
  const hasTeam = (m.includes(hn) && hn.length > 2) || (m.includes(an) && an.length > 2);
  return hasTeam && /total de goles|remates|tiros de esquina|tiros a puerta|tarjetas|faltas|corners?/.test(m);
}

function selectionsOf(odds) {
  const out = [];
  for (const o of (odds || [])) {
    const nm = (o.name || '').trim();
    if (/^(m[aá]s de|menos de|over|under)\s+\d/i.test(nm)) out.push({ selectionText: nm, oddsText: am(o.price) });
    // Cobertura amplia de lineas por mercado (el book ofrece escaleras de
    // ~20 selecciones; recortar a 6 escondia respaldos como Over 4.5 junto
    // a Under 7.5). Tope operativo 30.
    if (out.length >= 30) break;
  }
  return out;
}

(async () => {
  const targetDate = optionValue('--date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate || '')) throw new Error('Uso: build-catalog-observation.js --date YYYY-MM-DD [--events id1,id2]');
  const forcedEvents = (optionValue('--events') || '').split(',').map(s => s.trim()).filter(Boolean);

  const browser = await chromium.launch({ headless: true });
  try {
    // --- DataFut: calendario + titulos ---
    const dfCtx = await browser.newContext({
      storageState: path.join(projectDir, 'datafut-marketing-session.json'),
      viewport: { width: 1280, height: 900 }
    });
    const dfPage = await dfCtx.newPage();
    await dfPage.goto(`https://data-fut.com/calendario.html?fecha=${targetDate}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dfPage.waitForTimeout(5000);
    if (/\/login\.html(?:$|[?#])/i.test(dfPage.url())) throw new Error('Sesion DataFut expirada. Renueva con: npm run datafut -- login-datafut');
    let links = await dfPage.evaluate(() => Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(a => ({
      url: a.href, text: a.innerText.replace(/\s+/g, ' ').trim()
    })));
    // El calendario viene agrupado por competicion CONTRAIDA: expandir todo y
    // recolectar una segunda pasada, si el boton existe.
    const didExpand = await dfPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button, a, [role="button"]'))
        .find(el => /expandir todo/i.test((el.innerText || '').trim()));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (didExpand) {
      await dfPage.waitForTimeout(2500);
      const links2 = await dfPage.evaluate(() => {
        const grab = a => ({ url: a.href, text: a.innerText.replace(/\s+/g, ' ').trim() });
        const rows = Array.from(document.querySelectorAll('.match[data-match-open], .match-picks[data-match-url]')).map(el => {
          const raw = el.getAttribute('data-match-open') || el.getAttribute('data-match-url');
          if (!raw) return null;
          let abs;
          try { abs = raw.startsWith('http') ? raw : new URL(raw, location.origin).href; } catch { return null; }
          const names = Array.from(el.querySelectorAll('.equipo span')).map(s => (s.innerText || '').trim()).filter(Boolean);
          const hora = (() => { const h = el.querySelector('.hora'); return h ? (h.innerText || '').trim() : ''; })();
          const league = (() => {
            const det = el.closest('details');
            const t = det ? det.querySelector('.liga-title') : null;
            return t ? (t.innerText || '').replace(/\s+/g, ' ').trim() : '';
          })();
          const text = names.length ? names.join(' vs ') : '';
          return { url: abs, text, fullCardText: `${league} ${hora} ${text}`.trim(), fromRow: true };
        }).filter(Boolean);
        const anchors = Array.from(document.querySelectorAll('a[href*="partido.html"]')).map(grab);
        return [...anchors, ...rows];
      });
      console.log(`Calendario DataFut expandido: ${links.length} -> ${links2.length} elemento(s).`);
      const seen = new Set(links.map(l => l.url));
      for (const link of links2) if (!seen.has(link.url)) { links.push(link); seen.add(link.url); }
    } else {
      console.log('Calendario DataFut: boton Expandir todo no encontrado (vista ya expandida).');
    };
    if (links.length === 0) throw new Error('Calendario sin enlaces partido.html; no se escribe extraccion vacia.');
    const cachePath = path.join(os.tmpdir(), 'datafut-link-titles.json');
    let cache = {};
    try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch { cache = {}; }
    const dfTitles = [];
    for (const link of links) {
      if (link.text && link.text.length >= 12) { dfTitles.push(link.text); continue; }
      const key = (() => { try { return new URL(link.url).searchParams.get('partido') || link.url; } catch { return link.url; } })();
      if (cache[key]) { dfTitles.push(cache[key]); continue; }
      try {
        await dfPage.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await dfPage.waitForTimeout(2000);
        const title = await dfPage.evaluate(() => document.title || '');
        if (title && !/login/i.test(title)) { cache[key] = title; dfTitles.push(title); }
        await dfPage.waitForTimeout(600);
      } catch { /* fail-soft */ }
    }
    try { fs.writeFileSync(cachePath, JSON.stringify(cache)); } catch { /* opcional */ }
    console.log(`DataFut: ${links.length} enlaces, ${dfTitles.length} con titulo.`);

    // --- PlayDoIt: upcoming del dia (CDMX) ---
    const pdCtx = await browser.newContext({
      storageState: fs.existsSync(path.join(projectDir, 'playdoit-public-state.json'))
        ? path.join(projectDir, 'playdoit-public-state.json') : undefined,
      viewport: { width: 1440, height: 900 }
    });
    const pdPage = await pdCtx.newPage();
    await pdPage.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
    await pdPage.waitForTimeout(2000);
    const upcoming = await pdPage.evaluate(async () => {
      const res = await fetch('https://sb2frontend-altenar2.biahosted.com/api/widget/GetUpcoming?culture=es-ES&timezoneOffset=360&integration=playdoit2&sportId=66');
      const j = await res.json();
      const champs = {};
      (j.champs || []).forEach(c => { champs[c.id] = c.name; });
      return (j.events || []).map(e => ({ id: String(e.id), name: e.name, start: e.startDate, league: champs[e.champId] || '' }));
    });
    const inDay = upcoming.filter(e => {
      const mx = new Date(new Date(e.start).getTime() - 6 * 3600 * 1000);
      return mx.toISOString().slice(0, 10) === targetDate;
    });
    const aliasMap = readAliasMap();
    let targets;
    if (forcedEvents.length > 0) {
      targets = forcedEvents.flatMap(id => {
        const ev = upcoming.find(e => String(e.id) === String(id));
        if (!ev) { console.log(`Evento ${id} ya no esta en upcoming (finalizado): se omite.`); return []; }
        const parts = String(ev.name || '').split(/\s+vs\.?\s+/i);
        return { eventId: String(ev.id), homeTeam: (parts[0] || '').trim(), awayTeam: (parts[1] || '').trim(), league: ev.league };
      });
    } else {
      targets = [];
      for (const ev of inDay) {
        // Interseccion: el titulo DataFut debe contener ambos equipos del
        // evento PlayDoIt (con alias explicitos).
        const parts = String(ev.name).split(/\s+vs\.?\s+/i);
        const dfHit = dfTitles.find(t => matchesTitle(parts[0] || '', parts[1] || '', t, aliasMap));
        if (dfHit) {
          const parts = String(ev.name).split(/\s+vs\.?\s+/i);
          const startMX = new Date(new Date(ev.start).getTime() - 6 * 3600 * 1000);
          targets.push({
            eventId: String(ev.id),
            homeTeam: (parts[0] || '').replace(/\s+vs\.?$/i, '').trim(),
            awayTeam: (parts[1] || '').trim(),
            league: ev.league,
            startTime: `${targetDate}T${startMX.toISOString().slice(11, 16)}:00-06:00`
          });
        }
      }
    }
    console.log(`Interseccion: ${targets.length} partido(s).`);
    if (targets.length === 0) throw new Error('Sin interseccion DataFut x PlayDoIt para la fecha.');

    // --- Mercados + capturas ---
    const now = new Date().toISOString();
    const events = [];
    for (const t of targets) {
      const url = `https://www.playdoit.mx/#page=event&eventId=${t.eventId}&sportId=66`;
      let r;
      try {
        r = await pdPage.evaluate(async eid => {
          const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${eid}`);
          if (!res.ok) return { error: `HTTP ${res.status}` };
          const j = await res.json();
          const om = new Map();
          (j.odds || []).forEach(o => om.set(o.id, o));
          return {
            markets: (j.markets || []).map(m => {
              const ids = [];
              (m.desktopOddIds || []).forEach(col => col.forEach(id => ids.push(id)));
              return { name: m.name, odds: ids.map(id => om.get(id)).filter(Boolean).map(o => ({ name: o.name, price: o.price })) };
            })
          };
        }, t.eventId);
      } catch (e) { console.log(t.eventId, 'ERR', e.message); continue; }
      if (r.error) { console.log(t.eventId, 'ERR', r.error); continue; }
      const seen = new Set();
      const mkts = [];
      for (const m of r.markets) {
        const name = (m.name || '').trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        if (!acceptableMarket(name, t.homeTeam, t.awayTeam)) continue;
        const ss = selectionsOf(m.odds);
        if (ss.length === 0) continue;
        seen.add(name.toLowerCase());
        mkts.push({
          marketText: name,
          rawText: `${name}\nSGP\n${ss.map(x => `${x.selectionText}\n${x.oddsText}`).join('\n')}`,
          selections: ss.map((x, i) => ({ selectionId: `dom-${t.eventId}-m${mkts.length}s${i}`, selectionText: x.selectionText, oddsText: x.oddsText }))
        });
        if (mkts.length >= 40) break;
      }
      if (mkts.length === 0) { console.log(t.eventId, 'SIN MERCADOS'); continue; }
      await pdPage.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await pdPage.waitForTimeout(3500);
      const shotPath = `captures/dom/playdoit-catalog-${t.eventId}-${targetDate}.png`;
      await pdPage.screenshot({ path: path.join(projectDir, shotPath) });
      const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(projectDir, shotPath))).digest('hex');
      const eventText = `${t.homeTeam} vs ${t.awayTeam}`;
      events.push({
        observedAt: now, url, eventId: t.eventId, homeTeam: t.homeTeam, awayTeam: t.awayTeam,
        eventText, league: t.league || '', startTime: t.startTime || '', visible: true, marketCoverage: 'PARTIAL',
        rawText: `${eventText}\n${mkts.map(m => m.rawText).join('\n')}`,
        selectors: {
          marketContainer: '[class^="EventDetailsMarketBoxRoot-"]',
          selection: '[class^="EventDetailsMarketBoxRoot-"] button[class^="OddBoxButton-"]'
        },
        screenshot: { path: shotPath, sha256: sha }, markets: mkts
      });
      console.log(t.eventId, 'mkts=', mkts.length);
    }
    const doc = {
      schemaVersion: 1, captureType: 'playdoit_catalog', source: 'live_dom', observedAt: now,
      targetDate, targetWindow: `partidos del ${targetDate} desde las 00:00 hora centro de México`,
      targetTimezone: 'America/Mexico_City', navigationMode: 'chrome_extension', events
    };
    const outPath = path.join(projectDir, 'captures', 'dom', `playdoit-catalog-observation-${targetDate}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`Catalogo escrito: ${outPath} (${events.length} eventos).`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
