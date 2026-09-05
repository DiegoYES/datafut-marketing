const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const {
  isTrivialCandidate,
  matchCatalogEntry,
  parsePrediction
} = require('./lib/discovery');
const { readJson } = require('./lib/validation');

const projectDir = path.resolve(__dirname, '..');
const sessionPath = path.join(projectDir, 'datafut-marketing-session.json');
const catalogPath = path.join(projectDir, 'pipeline-state', 'playdoit-catalog.json');
const outputPath = path.join(__dirname, 'datafut-live-raw.json');

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function canonicalMatchKey(url) {
  const parsed = new URL(url);
  return parsed.searchParams.get('partido') || `${parsed.pathname}?${parsed.searchParams}`;
}

// Los enlaces pelados del calendario (sin texto de equipos) se resuelven
// visitando el partido con la misma sesion autenticada y usando su titulo.
// Cache operativo en Temp para no castigar el WAF de DataFut en re-corridas.
async function resolveBareLinkTitles(page, calendarLinks) {
  const os = require('node:os');
  const cachePath = path.join(os.tmpdir(), 'datafut-link-titles.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch { cache = {}; }
  let resolved = 0;
  let fetched = 0;
  for (const link of calendarLinks) {
    if ((`${link.text} ${link.fullCardText}`).trim().length >= 12) continue;
    const key = canonicalMatchKey(link.url);
    if (cache[key]) {
      link.text = cache[key];
      resolved++;
      continue;
    }
    try {
      await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      if (/\/login\.html(?:$|[?#])/i.test(page.url())) break;
      const title = await page.evaluate(() => document.title || '');
      if (title && !/login/i.test(title)) {
        cache[key] = title;
        link.text = title;
        fetched++;
      }
      await page.waitForTimeout(800);
    } catch {
      continue;
    }
  }
  try { fs.writeFileSync(cachePath, JSON.stringify(cache)); } catch { /* cache opcional */ }
  if (resolved + fetched > 0) {
    console.log(`Titulos resueltos para enlaces pelados: ${resolved + fetched} (${fetched} en vivo, ${resolved} de cache).`);
  }
}

function readAliasMap() {
  try {
    const aliasPath = path.join(projectDir, 'config', 'team-aliases.json');
    if (!fs.existsSync(aliasPath)) return null;
    const document = JSON.parse(fs.readFileSync(aliasPath, 'utf8'));
    return document && typeof document.aliases === 'object' ? document.aliases : null;
  } catch {
    return null;
  }
}

(async () => {
  const catalog = readJson(catalogPath);
  if (catalog.catalogStatus !== 'VERIFIED' || catalog.evidenceSource !== 'live_dom') {
    throw new Error('La extraccion requiere un catalogo VERIFIED con evidencia live_dom.');
  }
  if (!fs.existsSync(sessionPath)) {
    throw new Error('No existe datafut-marketing-session.json.');
  }

  const targetDate = optionValue('--date') || catalog.targetDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate || '')) {
    throw new Error('Falta una fecha valida --date YYYY-MM-DD o targetDate en el catalogo.');
  }

  console.log(`Extrayendo DataFut para ${targetDate} dentro del catalogo PlayDoIt...`);
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      storageState: sessionPath,
      viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();
    await page.goto(`https://data-fut.com/calendario.html?fecha=${targetDate}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    await page.waitForTimeout(3000);
    if (/\/login\.html(?:$|[?#])/i.test(page.url())) {
      throw new Error(
        'La sesion DataFut expiro o ya no es aceptada. Renueva datafut-marketing-session.json antes de Discovery.'
      );
    }

    const calendarLinks = await page.evaluate(() => Array.from(
      document.querySelectorAll('a[href*="partido.html"]')
    ).map(anchor => {
      const container = anchor.closest('.tarjeta-partido, [class*="match"], .card, div') || anchor;
      return {
        url: anchor.href,
        text: anchor.innerText.replace(/\n+/g, ' ').trim(),
        fullCardText: container.innerText.replace(/\n+/g, ' ').trim()
      };
    }));
    await resolveBareLinkTitles(page, calendarLinks);
    if (calendarLinks.length === 0) {
      throw new Error(
        'El calendario autenticado no expuso enlaces partido.html; no se escribira una extraccion vacia silenciosa.'
      );
    }

    const aliasMap = readAliasMap();
    const relevantLinks = new Map();
    for (const link of calendarLinks) {
      const catalogMatch = matchCatalogEntry(catalog, `${link.text} ${link.fullCardText}`, aliasMap);
      if (!catalogMatch) continue;
      const key = canonicalMatchKey(link.url);
      if (!relevantLinks.has(key)) relevantLinks.set(key, { ...link, catalogMatchId: catalogMatch.matchId });
    }

    console.log(
      `Calendario: ${calendarLinks.length} enlace(s), ${relevantLinks.size} partido(s) unico(s) dentro del catalogo.`
    );

    const rawMatches = [];
    for (const link of relevantLinks.values()) {
      await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const matchInfo = await page.evaluate(() => {
        const cards = Array.from(
          document.querySelectorAll('.tarjeta-pick, [class*="pick-card"], .card-pick, div')
        ).filter(element => {
          const text = element.innerText || '';
          return text.includes('%') && (
            text.includes('¿Por qué') || text.includes('De dónde sale') || text.includes('Guardar pick')
          );
        });

        const seen = new Set();
        const picks = [];
        for (const card of cards) {
          if (card.querySelectorAll('.tarjeta-pick, [class*="pick-card"], .card-pick').length > 1) continue;
          const lines = card.innerText.split('\n').map(line => line.trim()).filter(Boolean);
          if (lines.length < 2) continue;

          const rawTitle = lines[0];
          if (seen.has(rawTitle)) continue;
          seen.add(rawTitle);

          const percentageLine = lines.find(line => /^\d+(?:\.\d+)?%$/.test(line));
          const evidenceStart = lines.findIndex(line => line.includes('De dónde sale'));
          const sourceLine = lines.find(line => line.includes('Fuente local:') || line.includes('Fuente visitante:'));

          picks.push({
            rawTitle,
            percentage: percentageLine ? Number(percentageLine.replace('%', '')) : null,
            sampleLine: lines.find(line => line.includes('muestra')) || '',
            evidenceText: evidenceStart >= 0 && lines[evidenceStart + 1]
              ? [lines[evidenceStart + 1]]
              : sourceLine
                ? [sourceLine]
                : [],
            fullSnippet: card.innerText.replace(/\s+/g, ' ').trim()
          });
        }

        return { title: document.title, picks };
      });

      const catalogMatch = catalog.matches.find(match => match.matchId === link.catalogMatchId);
      if (!catalogMatch) {
        throw new Error(`No se encontro ${link.catalogMatchId} en el catalogo actual.`);
      }
      const prefilteredPicks = matchInfo.picks.filter(pick => {
        if (!Number.isFinite(pick.percentage) || pick.percentage <= 70) return false;
        const semantics = parsePrediction(pick.rawTitle, catalogMatch);
        return semantics && !isTrivialCandidate(semantics);
      });

      rawMatches.push({
        catalogMatchId: link.catalogMatchId,
        url: link.url,
        title: matchInfo.title,
        picks: prefilteredPicks
      });
      console.log(
        `${matchInfo.title}: ${matchInfo.picks.length} prediccion(es) leida(s), ` +
        `${prefilteredPicks.length} >70% y no trivial(es) conservada(s).`
      );
    }

    fs.writeFileSync(outputPath, `${JSON.stringify({
      extractedAt: new Date().toISOString(),
      datafutSource: 'authenticated_session_read',
      catalogGeneratedAt: catalog.generatedAt,
      targetDate,
      matches: rawMatches
    }, null, 2)}\n`);
    console.log(`Extraccion guardada: ${path.relative(projectDir, outputPath)}.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
