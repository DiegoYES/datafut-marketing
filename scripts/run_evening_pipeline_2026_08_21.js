const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_evening_2026_08_21');
if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

function decimalToAmerican(dec) {
  if (!dec || isNaN(dec) || dec <= 1) return '+100';
  if (dec >= 2.0) {
    return `+${Math.round((dec - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (dec - 1))}`;
  }
}

function getCombinations(arr, k) {
  const results = [];
  function backtrack(start, combo) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }
  backtrack(0, []);
  return results;
}

function isTrivialMarket(t) {
  const low = t.toLowerCase().trim();
  if (/más de 0\.5 goles/i.test(low) && !low.includes('local') && !low.includes('visitante') && !low.includes('tiempo') && !low.includes('mitad')) return true;
  if ((low.includes('tiro a puerta') || low.includes('tiros a puerta')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }
  if ((low.includes('tiro') || low.includes('tiros')) && !low.includes('puerta') && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 2.5) return true;
  }
  if ((low.includes('tarjeta') || low.includes('amarilla')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 0.5) return true;
  }
  if ((low.includes('córner') || low.includes('corner') || low.includes('córners') || low.includes('corners') || low.includes('esquina')) && (low.startsWith('más de') || low.startsWith('mas de'))) {
    const num = parseFloat((low.match(/\d+(\.\d+)?/) || [0])[0]);
    if (num <= 1.5) return true;
  }
  return false;
}

(async () => {
  console.log('========================================================================');
  console.log('    DATAFUT MARKETING: PARLAYS DE HOY DESPUÉS DE LAS 5:00 PM (>= 17:00) ');
  console.log('========================================================================\n');

  // Matches >= 17:00 CDMX available in both PlayDoIt and DataFut
  const eveningMatches = [
    {
      eventId: 17300449,
      match: 'Estudiantes de Río Cuarto vs. San Lorenzo',
      dfTitle: 'Estudiantes de Rio Cuarto vs San Lorenzo',
      homeTeam: 'Estudiantes de Río Cuarto',
      awayTeam: 'San Lorenzo',
      homeKeywords: ['estudiantes'],
      awayKeywords: ['san lorenzo'],
      timeCDMX: '17:00',
      league: 'Argentina Liga Profesional'
    },
    {
      eventId: 16335538,
      match: 'Audax Italiano vs. Unión La Calera',
      dfTitle: 'A. Italiano vs Union La Calera',
      homeTeam: 'Audax Italiano',
      awayTeam: 'Unión La Calera',
      homeKeywords: ['audax', 'italiano'],
      awayKeywords: ['la calera', 'calera'],
      timeCDMX: '18:30',
      league: 'Chile Primera División'
    },
    {
      eventId: 17175292,
      match: 'San Diego Wave (F) vs. Utah Royals (F)',
      dfTitle: 'San Diego Wave W vs Utah Royals W',
      homeTeam: 'San Diego Wave',
      awayTeam: 'Utah Royals',
      homeKeywords: ['san diego', 'wave'],
      awayKeywords: ['utah', 'royals'],
      timeCDMX: '20:00',
      league: 'EE.UU. NWSL Femenil'
    }
  ];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Extract PlayDoIt markets for evening matches
  const catalogData = await page.evaluate(async (matches) => {
    const results = [];
    for (const m of matches) {
      try {
        const res = await fetch(`https://sb2frontend-altenar2.biahosted.com/api/widget/GetEventDetails?culture=es-ES&timezoneOffset=360&integration=playdoit2&eventId=${m.eventId}`);
        if (!res.ok) continue;
        const json = await res.json();
        const oddsMap = new Map();
        (json.odds || []).forEach(o => oddsMap.set(o.id, o));

        const markets = (json.markets || []).map(mkt => {
          const allOddIds = [];
          if (mkt.desktopOddIds) mkt.desktopOddIds.forEach(col => col.forEach(oid => allOddIds.push(oid)));
          const odds = allOddIds.map(oid => oddsMap.get(oid)).filter(Boolean);
          return {
            id: mkt.id,
            name: mkt.name,
            odds: odds.map(o => ({ id: o.id, name: o.name, price: o.price, sv: o.sv }))
          };
        });

        results.push({ ...m, markets });
      } catch(e) {
        results.push({ ...m, error: e.message });
      }
    }
    return results;
  }, eveningMatches);

  // Load DataFut picks
  const dfScrapedMatches = JSON.parse(fs.readFileSync(path.join(__dirname, 'datafut_2026_08_21_raw.json'), 'utf8'));

  const verifiedPicks = [];

  for (const cat of catalogData) {
    if (!cat.markets) continue;
    const dfMatch = dfScrapedMatches.find(m => m.title.includes(cat.dfTitle) || m.header.includes(cat.dfTitle));
    if (!dfMatch || !dfMatch.picks) continue;

    console.log(`\nAuditando mercados para: ${cat.match} (${cat.timeCDMX} CDMX | ${cat.league})`);

    for (const p of dfMatch.picks) {
      if (p.percentage < 65.0) continue;
      if (isTrivialMarket(p.rawTitle)) continue;

      const rawLow = p.rawTitle.toLowerCase();
      let dfScope = 'match';
      let dfStat = 'unknown';
      let dfPeriod = 'full_time';
      let dfDir = rawLow.startsWith('más de') || rawLow.startsWith('mas de') ? 'over' : 'under';
      const numMatch = rawLow.match(/\d+(\.\d+)?/);
      const dfLine = numMatch ? parseFloat(numMatch[0]) : null;

      if (rawLow.includes('del local') || rawLow.includes('local marca')) dfScope = 'team_home';
      else if (rawLow.includes('del visitante') || rawLow.includes('visitante marca')) dfScope = 'team_away';

      if (rawLow.includes('gol') || rawLow.includes('goles') || rawLow.includes('marca')) dfStat = 'goals';
      else if (rawLow.includes('córner') || rawLow.includes('corner') || rawLow.includes('esquina')) dfStat = 'corners';
      else if (rawLow.includes('tarjeta') || rawLow.includes('amarilla')) dfStat = 'cards';
      else if (rawLow.includes('tiro a puerta') || rawLow.includes('remate a puerta')) dfStat = 'shots_on_target';
      else if (rawLow.includes('tiro') || rawLow.includes('remate')) dfStat = 'shots';
      else if (rawLow.includes('falta')) dfStat = 'fouls';

      for (const mkt of cat.markets) {
        const mLow = mkt.name.toLowerCase();
        let pdScope = 'match';
        if (cat.homeKeywords.some(kw => mLow.includes(kw)) || mLow.includes('local')) pdScope = 'team_home';
        else if (cat.awayKeywords.some(kw => mLow.includes(kw)) || mLow.includes('visitante')) pdScope = 'team_away';

        // STRICT SCOPE MATCH
        if (dfScope !== pdScope) continue;

        // STRICT STAT MATCH
        let statMatch = false;
        if (dfStat === 'goals' && (mLow.includes('gol') || mLow.includes('goles') || mkt.name === 'Total')) statMatch = true;
        if (dfStat === 'corners' && (mLow.includes('córner') || mLow.includes('corner') || mLow.includes('tiros de esquina'))) statMatch = true;
        if (dfStat === 'cards' && (mLow.includes('tarjeta') || mLow.includes('amarilla'))) statMatch = true;
        if (dfStat === 'shots' && (mLow.includes('remates totales') || mLow.includes('tiros totales'))) statMatch = true;

        if (!statMatch) continue;

        for (const odd of mkt.odds) {
          const oLow = odd.name.toLowerCase();
          const svNum = parseFloat(odd.sv || (odd.name.match(/\d+(\.\d+)?/) || [0])[0]);
          const isOddOver = oLow.startsWith('más de') || oLow.startsWith('over');
          const isOddUnder = oLow.startsWith('menos de') || oLow.startsWith('under');

          const dirMatch = (dfDir === 'over' && isOddOver) || (dfDir === 'under' && isOddUnder);

          if (dirMatch && Math.abs(svNum - dfLine) < 0.01) {
            const dec = odd.price;
            const am = decimalToAmerican(dec);

            verifiedPicks.push({
              match: cat.match,
              league: cat.league,
              timeCDMX: cat.timeCDMX,
              datafutMarket: p.rawTitle,
              percentage: p.percentage,
              scope: dfScope,
              sample: p.sampleLine,
              evidence: p.evidenceText && p.evidenceText.length > 0 ? p.evidenceText[0] : 'Nativa',
              playdoitMarket: mkt.name,
              playdoitSelection: odd.name,
              oddsDecimal: dec,
              oddsAmerican: am,
              oddsText: `${dec.toFixed(2)} (${am})`,
              oddId: odd.id,
              eventId: cat.eventId
            });
          }
        }
      }
    }
  }

  // Deduplicate
  const uniqueMap = new Map();
  verifiedPicks.forEach(p => {
    const k = `${p.match}|${p.datafutMarket}|${p.playdoitMarket}|${p.playdoitSelection}`;
    if (!uniqueMap.has(k)) uniqueMap.set(k, p);
  });

  const cleanPicks = Array.from(uniqueMap.values());
  console.log(`\n======================================================`);
  console.log(`TOTAL PICKS VERIFICADOS HOY DESPUÉS DE LAS 17:00: ${cleanPicks.length}`);
  console.log(`======================================================\n`);

  cleanPicks.forEach((p, idx) => {
    console.log(`[Pick ${idx + 1}] ${p.match} (${p.timeCDMX} CDMX | ${p.league})`);
    console.log(`   - Mercado DataFut: "${p.datafutMarket}" -> ${p.percentage}% | Muestra: ${p.sample}`);
    console.log(`   - Mercado PlayDoIt: "${p.playdoitMarket} -> ${p.playdoitSelection}" -> Cuota: ${p.oddsText}`);
    console.log(`   - Alcance: ${p.scope === 'match' ? 'PARTIDO COMPLETO (Ambos equipos)' : 'EQUIPO INDIVIDUAL'}`);
    console.log(`   - Evidencia: ${p.evidence}\n`);
  });

  // Build the 3 Finalist Parlays:
  const finalistParlays = [
    {
      id: 'parlay_vespertino_1_control_sudamericano',
      name: 'Opción 1 (Doble): Control Sudamericano (Argentina + Chile)',
      type: 'Parlay Doble',
      combinedDecimal: 2.04,
      combinedAmerican: '+104',
      picks: [
        {
          teamA: 'Estudiantes Río Cuarto',
          teamB: 'San Lorenzo',
          match: 'Estudiantes de Río Cuarto vs. San Lorenzo (17:00 CDMX)',
          market: 'Total',
          selection: 'Menos de 2.5',
          price: '-275 (1.36)',
          percentage: '78.6%',
          evidence: 'Estudiantes cumplió el under 2.5 en 8/10 en casa (80%) y San Lorenzo en 10/10 fuera (100%).'
        },
        {
          teamA: 'Audax Italiano',
          teamB: 'Unión La Calera',
          match: 'Audax Italiano vs. Unión La Calera (18:30 CDMX)',
          market: 'Total Tiros De Esquina',
          selection: 'Menos de 10.5',
          price: '-200 (1.50)',
          percentage: '66.2%',
          evidence: 'Audax cumplió menos de 10.5 córners en 9/10 en casa (90%) y Unión La Calera en 5/9 fuera (55.6%).'
        }
      ]
    },
    {
      id: 'parlay_vespertino_2_goles_nocturnos',
      name: 'Opción 2 (Doble): Goles Nocturnos (Chile + EE.UU. NWSL)',
      type: 'Parlay Doble',
      combinedDecimal: 2.00,
      combinedAmerican: '+100',
      picks: [
        {
          teamA: 'Audax Italiano',
          teamB: 'Unión La Calera',
          match: 'Audax Italiano vs. Unión La Calera (18:30 CDMX)',
          market: 'Total',
          selection: 'Más de 1.5',
          price: '-300 (1.33)',
          percentage: '66.5%',
          evidence: 'Audax cumplió 2+ goles en 8/10 de local (80%) y La Calera en 6/9 de visita (66.7%).'
        },
        {
          teamA: 'San Diego Wave',
          teamB: 'Utah Royals',
          match: 'San Diego Wave (F) vs. Utah Royals (F) (20:00 CDMX)',
          market: 'Total',
          selection: 'Más de 1.5',
          price: '-200 (1.50)',
          percentage: '71.4%',
          evidence: 'San Diego Wave registró 2+ goles en 8/10 juegos en casa (80%) y Utah Royals en 7/10 salidas (70%).'
        }
      ]
    },
    {
      id: 'parlay_vespertino_3_triple_completo',
      name: 'Opción 3 (Triple): Triple Completo de la Tarde-Noche',
      type: 'Parlay Triple',
      combinedDecimal: 3.06,
      combinedAmerican: '+206',
      picks: [
        {
          teamA: 'Estudiantes Río Cuarto',
          teamB: 'San Lorenzo',
          match: 'Estudiantes vs. San Lorenzo (17:00 CDMX)',
          market: 'Total',
          selection: 'Menos de 2.5',
          price: '-275 (1.36)',
          percentage: '78.6%',
          evidence: '8/10 de local y 10/10 de visita.'
        },
        {
          teamA: 'Audax Italiano',
          teamB: 'Unión La Calera',
          match: 'Audax Italiano vs. Unión La Calera (18:30 CDMX)',
          market: 'Total Tiros De Esquina',
          selection: 'Menos de 10.5',
          price: '-200 (1.50)',
          percentage: '66.2%',
          evidence: '9/10 en casa y 5/9 fuera.'
        },
        {
          teamA: 'San Diego Wave',
          teamB: 'Utah Royals',
          match: 'San Diego Wave vs. Utah Royals (20:00 CDMX)',
          market: 'Total',
          selection: 'Más de 1.5',
          price: '-200 (1.50)',
          percentage: '71.4%',
          evidence: '8/10 de local y 7/10 de visita.'
        }
      ]
    }
  ];

  // Capture images for the 3 finalists
  for (const fp of finalistParlays) {
    await page.evaluate((p) => {
      const old = document.getElementById('native-playdoit-boleto-box');
      if (old) old.remove();

      let itemsHtml = '';
      p.picks.forEach(pick => {
        itemsHtml += `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 700; color: #1e293b; display: flex; align-items: center; justify-content: space-between;">
              <span>🛡️ ${pick.teamA} <span style="color: #64748b; font-weight: 500;">vs</span> ${pick.teamB} 🛡️</span>
              <span style="color: #94a3b8; font-size: 14px; cursor: pointer;">×</span>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${pick.market}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
              <span style="font-size: 13px; font-weight: 800; color: #0f172a;">${pick.selection}</span>
              <span style="font-size: 13px; font-weight: 800; color: #0f172a;">${pick.price}</span>
            </div>
          </div>
        `;
      });

      const boletoEl = document.createElement('div');
      boletoEl.id = 'native-playdoit-boleto-box';
      boletoEl.style.position = 'fixed';
      boletoEl.style.bottom = '40px';
      boletoEl.style.left = '50%';
      boletoEl.style.transform = 'translateX(-50%)';
      boletoEl.style.width = '420px';
      boletoEl.style.background = '#f8fafc';
      boletoEl.style.borderRadius = '12px';
      boletoEl.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
      boletoEl.style.zIndex = '9999999';
      boletoEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      boletoEl.style.overflow = 'hidden';
      boletoEl.style.border = '1px solid #cbd5e1';

      boletoEl.innerHTML = `
        <div style="background: #e11d48; color: #ffffff; padding: 10px 16px; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>BOLETO</span>
            <span style="background: #ffffff; color: #e11d48; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">${p.picks.length}</span>
          </div>
          <span style="font-size: 16px;">_</span>
        </div>
        <div style="display: flex; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-size: 12px; font-weight: 700; color: #64748b;">
          <div style="flex: 1; text-align: center; padding: 8px 0;">Derecha</div>
          <div style="flex: 1; text-align: center; padding: 8px 0; color: #e11d48; border-bottom: 2px solid #e11d48; background: #ffffff;">Parlay</div>
          <div style="flex: 1; text-align: center; padding: 8px 0;">Sistema</div>
        </div>
        <div style="padding: 12px 14px; max-height: 280px; overflow-y: auto;">
          ${itemsHtml}
          <div style="text-align: center; font-size: 11px; font-weight: 600; color: #64748b; padding: 4px 0;">Limpiar todo 🗑️</div>
        </div>
        <div style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: #1e293b;">Parlay</span>
            <span style="font-size: 12px; font-weight: 700; color: #0f172a;">1 x $10.00</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span style="color: #64748b;">Momios</span>
            <span style="font-weight: 800; color: #0f172a;">${p.combinedAmerican}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
            <span style="color: #0f172a;">Ganancia Total</span>
            <span style="color: #10b981; font-size: 14px;">$${(p.combinedDecimal * 10).toFixed(2)} MXN</span>
          </div>
          <button style="width: 100%; margin-top: 10px; background: #e11d48; color: #ffffff; border: none; padding: 10px 0; border-radius: 8px; font-size: 13px; font-weight: 800;">
            Inicia sesión para realizar apuestas
          </button>
        </div>
      `;

      document.body.appendChild(boletoEl);
    }, fp);

    await page.waitForTimeout(1000);
    const shotPath = path.join(capturesDir, `${fp.id}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`[CAPTURA GUARDADA]: ${shotPath}`);
  }

  await browser.close();
  console.log('\nPipeline vespertino completado.');
})();
