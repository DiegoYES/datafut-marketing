const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=== REVERIFICACIÓN ESTRICTA Y AUDITORÍA COMPLETA (2026-08-21) ===\n');

  // Load scraped DataFut picks
  const dfMatches = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));

  // Connect to PlayDoIt in headless mode to fetch live markets
  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4000);

  // All matches to audit:
  const targetMatches = [
    // Morning matches
    { eventId: 17300447, match: 'Aldosivi vs Unión Santa Fe', dfTitle: 'Aldosivi vs Union Santa Fe', home: 'Aldosivi', away: 'Union de Santa Fe', time: '11:30 CDMX', league: 'Argentina Liga Profesional' },
    { eventId: 17325836, match: 'Alianza Atlético vs Sporting Cristal', dfTitle: 'Alianza Atletico vs Sporting Cristal', home: 'Alianza Atletico', away: 'Sporting Cristal', time: '14:00 CDMX', league: 'Perú Liga 1' },
    { eventId: 17360740, match: 'FC Cajamarca vs Atlético Grau', dfTitle: 'FC Cajamarca vs Atletico Grau', home: 'FC Cajamarca', away: 'Atlético Grau', time: '11:00 CDMX', league: 'Perú Liga 1' },
    { eventId: 16315255, match: 'Bohemians vs Derry City', dfTitle: 'Bohemians vs Derry City', home: 'Bohemians', away: 'Derry City', time: '12:45 CDMX', league: 'Irlanda Premier Division' },
    { eventId: 16315262, match: 'Dundalk vs Galway United', dfTitle: 'Dundalk vs Galway United', home: 'Dundalk', away: 'Galway United', time: '12:45 CDMX', league: 'Irlanda Premier Division' },
    // Afternoon matches
    { eventId: 17300449, match: 'Estudiantes Río Cuarto vs San Lorenzo', dfTitle: 'Estudiantes de Rio Cuarto vs San Lorenzo', home: 'Estudiantes Rio Cuarto', away: 'San Lorenzo', time: '17:00 CDMX', league: 'Argentina Liga Profesional' },
    { eventId: 17382142, match: 'Jaguares vs Boyacá Chicó', dfTitle: 'Jaguares vs Chico', home: 'Jaguares', away: 'Boyaca Chico', time: '15:05 CDMX', league: 'Colombia Primera A' },
    { eventId: 17392531, match: 'Liverpool vs Cerro', dfTitle: 'Liverpool Montevideo vs Cerro', home: 'Liverpool', away: 'Cerro', time: '16:00 CDMX', league: 'Uruguay Primera División' },
    { eventId: 16335538, match: 'Audax Italiano vs Unión La Calera', dfTitle: 'A. Italiano vs Union La Calera', home: 'Audax Italiano', away: 'Unión La Calera', time: '18:30 CDMX', league: 'Chile Primera División' }
  ];

  const auditResults = [];

  for (const tm of targetMatches) {
    const rawMarkets = await page.evaluate(async (eventId) => {
      const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${eventId}`);
      const data = await res.json();
      const oddsMap = new Map();
      (data.odds || []).forEach(o => oddsMap.set(o.id, o));

      return (data.markets || []).map(m => {
        const allOddIds = [];
        if (m.desktopOddIds) m.desktopOddIds.forEach(col => col.forEach(oid => allOddIds.push(oid)));
        const odds = allOddIds.map(oid => oddsMap.get(oid)).filter(Boolean);
        return {
          id: m.id,
          name: m.name,
          odds: odds.map(o => ({ id: o.id, name: o.name, price: o.price, sv: o.sv }))
        };
      });
    }, tm.eventId);

    const dfMatch = dfMatches.find(m => m.title.includes(tm.dfTitle) || m.header.includes(tm.dfTitle));
    if (!dfMatch) continue;

    console.log(`\n======================================================`);
    console.log(`AUDITANDO: ${tm.match} (${tm.time})`);
    console.log(`Mercados en PlayDoIt: ${rawMarkets.length}`);
    console.log(`======================================================`);

    for (const p of dfMatch.picks) {
      if (p.percentage < 65.0) continue;
      const rawLow = p.rawTitle.toLowerCase();

      // Determine DataFut scope & stat
      let dfScope = 'match';
      let dfStat = 'unknown';
      let dfDirection = rawLow.startsWith('más de') || rawLow.startsWith('mas de') ? 'over' : 'under';
      const numMatch = rawLow.match(/\d+(\.\d+)?/);
      const dfLine = numMatch ? parseFloat(numMatch[0]) : null;

      if (rawLow.includes('del local') || rawLow.includes('local marca') || rawLow.includes(tm.home.toLowerCase())) {
        dfScope = 'team_home';
      } else if (rawLow.includes('del visitante') || rawLow.includes('visitante marca') || rawLow.includes(tm.away.toLowerCase())) {
        dfScope = 'team_away';
      }

      if (rawLow.includes('gol') || rawLow.includes('goles') || rawLow.includes('marca')) dfStat = 'goals';
      else if (rawLow.includes('córner') || rawLow.includes('corner') || rawLow.includes('esquina')) dfStat = 'corners';
      else if (rawLow.includes('tarjeta') || rawLow.includes('amarilla')) dfStat = 'cards';
      else if (rawLow.includes('tiro a puerta') || rawLow.includes('remate a puerta')) dfStat = 'shots_on_target';
      else if (rawLow.includes('tiro') || rawLow.includes('remate')) dfStat = 'shots';
      else if (rawLow.includes('falta')) dfStat = 'fouls';

      // Find in PlayDoIt with STRICT SCOPE
      for (const mkt of rawMarkets) {
        const mLow = mkt.name.toLowerCase();

        // Classify PlayDoIt market scope
        let pdScope = 'match';
        if (mLow.includes(tm.home.toLowerCase()) || mLow.includes('local') || mLow.includes('aldosivi') || mLow.includes('alianza') || mLow.includes('cajamarca') || mLow.includes('bohemians') || mLow.includes('dundalk') || mLow.includes('estudiantes') || mLow.includes('jaguares') || mLow.includes('liverpool') || mLow.includes('audax')) {
          pdScope = 'team_home';
        } else if (mLow.includes(tm.away.toLowerCase()) || mLow.includes('visitante') || mLow.includes('santa fe') || mLow.includes('cristal') || mLow.includes('grau') || mLow.includes('derry') || mLow.includes('galway') || mLow.includes('san lorenzo') || mLow.includes('chico') || mLow.includes('cerro') || mLow.includes('calera')) {
          pdScope = 'team_away';
        }

        // Must match exact scope
        if (dfScope !== pdScope) continue;

        // Must match stat
        let matchesStat = false;
        if (dfStat === 'goals' && (mLow.includes('gol') || mLow.includes('goles') || mkt.name === 'Total')) matchesStat = true;
        if (dfStat === 'corners' && (mLow.includes('córner') || mLow.includes('corner') || mLow.includes('tiros de esquina'))) matchesStat = true;
        if (dfStat === 'cards' && (mLow.includes('tarjeta') || mLow.includes('amarilla'))) matchesStat = true;

        if (!matchesStat) continue;

        // Check exact line
        for (const odd of mkt.odds) {
          const oLow = odd.name.toLowerCase();
          const svNum = parseFloat(odd.sv || (odd.name.match(/\d+(\.\d+)?/) || [0])[0]);
          const isOddOver = oLow.startsWith('más de') || oLow.startsWith('over');
          const isOddUnder = oLow.startsWith('menos de') || oLow.startsWith('under');

          const dirMatch = (dfDirection === 'over' && isOddOver) || (dfDirection === 'under' && isOddUnder);

          if (dirMatch && Math.abs(svNum - dfLine) < 0.01) {
            console.log(`[VERIFICADO EXACTO 100%]`);
            console.log(`  DataFut: "${p.rawTitle}" (${p.percentage}%) [Scope: ${dfScope}]`);
            console.log(`  PlayDoIt: "${mkt.name} -> ${odd.name}" | Cuota: ${odd.price} [Scope: ${pdScope}]`);
            console.log(`  Muestra: ${p.sampleLine}`);
            console.log(`  Evidencia: ${p.evidenceText[0]}\n`);

            auditResults.push({
              match: tm.match,
              league: tm.league,
              time: tm.time,
              datafutTitle: p.rawTitle,
              percentage: p.percentage,
              scope: dfScope,
              sample: p.sampleLine,
              evidence: p.evidenceText[0],
              playdoitMarket: mkt.name,
              playdoitSelection: odd.name,
              price: odd.price
            });
          }
        }
      }
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(__dirname, 'strict_verified_all_21.json'), JSON.stringify(auditResults, null, 2));
  console.log(`Auditoría finalizada. ${auditResults.length} picks 100% exactos guardados.`);
})();
