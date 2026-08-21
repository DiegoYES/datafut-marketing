const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sessionPath = path.join(__dirname, '..', 'datafut-marketing-session.json');
  const context = await browser.newContext({
    storageState: fs.existsSync(sessionPath) ? sessionPath : undefined,
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  // List of active matches for today
  const matches = [
    {
      id: '1520820',
      league: 'Brasileirão Série B',
      homeTeam: 'Athletic Club',
      awayTeam: 'CRB',
      url: 'https://data-fut.com/partido.html?local=13975&visitante=146&liga=72&partido=1520820&fecha=2026-08-20'
    },
    {
      id: '1520828',
      league: 'Brasileirão Série B',
      homeTeam: 'Novorizontino',
      awayTeam: 'América Mineiro',
      url: 'https://data-fut.com/partido.html?local=7834&visitante=125&liga=72&partido=1520828&fecha=2026-08-20'
    },
    {
      id: '1547771',
      league: 'CONMEBOL Libertadores',
      homeTeam: 'LDU Quito',
      awayTeam: 'Mirassol',
      url: 'https://data-fut.com/partido.html?local=1158&visitante=7848&liga=13&partido=1547771&fecha=2026-08-20'
    },
    {
      id: '1547767',
      league: 'CONMEBOL Libertadores',
      homeTeam: 'Corinthians',
      awayTeam: 'Rosario Central',
      url: 'https://data-fut.com/partido.html?local=131&visitante=437&liga=13&partido=1547767&fecha=2026-08-20'
    },
    {
      id: '1606078',
      league: 'CONMEBOL Sudamericana',
      homeTeam: 'Macará',
      awayTeam: 'Santos',
      url: 'https://data-fut.com/partido.html?local=1155&visitante=128&liga=11&partido=1606078&fecha=2026-08-20'
    },
    {
      id: '1549591',
      league: 'Colombia Primera B',
      homeTeam: 'Leones FC',
      awayTeam: 'Real Cundinamarca',
      url: 'https://data-fut.com/partido.html?local=1143&visitante=22099&liga=240&partido=1549591&fecha=2026-08-20'
    },
    {
      id: '1549588',
      league: 'Colombia Primera B',
      homeTeam: 'Real Cartagena',
      awayTeam: 'Bogotá FC',
      url: 'https://data-fut.com/partido.html?local=1459&visitante=1458&liga=240&partido=1549588&fecha=2026-08-20'
    }
  ];

  const allParsedCandidates = [];

  for (const m of matches) {
    console.log(`\n--- PARSING MATCH: ${m.homeTeam} vs ${m.awayTeam} ---`);
    await page.goto(m.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const matchPicks = await page.evaluate((matchInfo) => {
      const items = [];
      const cards = Array.from(document.querySelectorAll('.tarjeta-pick, [class*="pick-card"], .card-pick, div')).filter(el => {
        const txt = el.innerText || '';
        return txt.includes('%') && (txt.includes('¿Por qué') || txt.includes('De dónde sale') || txt.includes('Guardar pick'));
      });

      // Filter to unique cards by their main text
      const seen = new Set();
      for (const card of cards) {
        // We only want the direct card container, not large parent sections containing multiple cards
        if (card.querySelectorAll('.tarjeta-pick, [class*="pick-card"], .card-pick').length > 1) {
          continue;
        }

        const lines = card.innerText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) continue;

        // Market title is usually first line
        const marketTitle = lines[0];
        if (seen.has(marketTitle)) continue;
        seen.add(marketTitle);

        // Percentage
        const pctLine = lines.find(l => /^\d+(\.\d+)?%$/.test(l));
        const percentage = pctLine ? parseFloat(pctLine.replace('%', '')) : null;

        // Sample
        const sampleLine = lines.find(l => l.includes('muestra'));
        
        // Evidence
        const deDondeIdx = lines.findIndex(l => l.includes('De dónde sale'));
        let evidenceText = [];
        if (deDondeIdx !== -1 && lines[deDondeIdx + 1]) {
          evidenceText.push(lines[deDondeIdx + 1]);
        } else {
          const fuenteLine = lines.find(l => l.includes('Fuente local:') || l.includes('Fuente visitante:'));
          if (fuenteLine) evidenceText.push(fuenteLine);
        }

        items.push({
          rawTitle: marketTitle,
          percentage,
          sampleLine: sampleLine || '',
          evidenceText,
          fullLines: lines
        });
      }

      return items;
    }, m);

    console.log(`Found ${matchPicks.length} unique pick cards.`);
    matchPicks.forEach(p => {
      allParsedCandidates.push({
        match: `${m.homeTeam} vs ${m.awayTeam}`,
        league: m.league,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        ...p
      });
    });
  }

  console.log(`\nTOTAL RAW PICKS COLLECTED ACROSS ALL MATCHES: ${allParsedCandidates.length}`);
  
  // Save to inspection json
  fs.writeFileSync(path.join(__dirname, 'all_raw_datafut_picks.json'), JSON.stringify(allParsedCandidates, null, 2));

  await browser.close();
})();
