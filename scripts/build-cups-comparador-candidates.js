// build-cups-comparador-candidates.js
// Cura tarjetas del comparador DataFut (sweep) en candidatos oficiales del pipeline:
// 1) whitelist de mercados totales, 2) piso porcentual y de muestra,
// 3) cruce exacto con la ladder del catalogo PlayDoit (linea + momio + oddId),
// 4) inyeccion en discovery/verified/eligible con provenance comparador.
// Uso: node scripts/build-cups-comparador-candidates.js --date YYYY-MM-DD
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeText } = require('./lib/playdoit-semantics');

const projectDir = path.resolve(__dirname, '..');
const stateDir = path.join(projectDir, 'pipeline-state');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`); }

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

// Bloques full_time (mercados del partido, ladder sin prefijo).
const FULL_BLOCK = [
  { family: 'goals', statistic: 'goals', marketText: 'Total', pattern: /^(m[áa]s de|menos de) (\d+(?:\.\d+)?) goles$/i },
  { family: 'corners', statistic: 'corners', marketText: 'Total Tiros De Esquina', pattern: /^(m[áa]s de) (\d+(?:\.\d+)?) c[oó]rners totales$/i },
  { family: 'cards_total', statistic: 'cards_total', marketText: 'Total de tarjetas', pattern: /^(m[áa]s de) (\d+(?:\.\d+)?) tarjetas amarillas totales$/i }
];
// Bloques 1ª mitad: SOLO por equipo (córners/tarjetas del local/visitante);
// PlayDoit no ofrece ladders 1T match-level ni de goles por tiempo.
const HALF_BLOCK = [
  { family: 'corners', statistic: 'corners', catPrefix: '1ª mitad - Total tiros de esquina ', pattern: /^(m[áa]s de|menos de) (\d+(?:\.\d+)?) c[oó]rners (del local|del visitante)$/i },
  { family: 'cards_total', statistic: 'cards_total', catPrefix: '1ª mitad - total tarjetas ', pattern: /^(m[áa]s de|menos de) (\d+(?:\.\d+)?) tarjetas amarillas (del local|del visitante)$/i }
];
const tokenEquals = (a, b) => a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));
function sideScore(sideTokensOK, playdoitTeam) {
  const pd = normalizeText(playdoitTeam).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 1 && !/^(fc|fk|sk|sc|ac|as|cf|cd)$/.test(t));
  if (!pd.length) return 0;
  let hit = 0;
  for (const t of pd) if (sideTokensOK.some(s => tokenEquals(t, s))) hit++;
  return hit / pd.length;
}

const PERCENT_FLOOR = 70;
const SAMPLE_FLOOR = 3;

function decimalEs(n) { return Number(n).toFixed(2).replace(/\.0$/, '').replace(/\.25/, ',25').replace(/\.5/, ',5').replace(/\.75/, ',75'); }

(async () => {
  const targetDate = optionValue('--date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate || '')) throw new Error('Uso: build-cups-comparador-candidates.js --date YYYY-MM-DD');

  const sweep = readJson(path.join(projectDir, 'captures', 'dom', `datafut-comparador-sweep-${targetDate}.json`));
  const catalog = readJson(path.join(stateDir, 'playdoit-catalog.json'));
  const discoveryPath = path.join(stateDir, 'discovery-candidates.json');
  const verifiedPath = path.join(stateDir, 'verified-candidates.json');
  const eligiblePath = path.join(stateDir, 'eligible-candidates.json');
  const discovery = readJson(discoveryPath);
  const verified = readJson(verifiedPath);
  const eligible = readJson(eligiblePath);

  const catalogMatches = catalog.matches || [];
  const existingKeys = new Set((discovery.candidates || []).map(c => c.candidateKey));

  const nowIso = new Date().toISOString();
  const dryRun = process.argv.includes('--dry-run');
  const created = [];
  for (const fx of sweep.fixtures || []) {
    if (fx.status !== 'OK') continue;
    const cMatch = catalogMatches.find(m => String(m.eventId) === String(fx.eventId));
    if (!cMatch) continue;
    const periodCards = (fx.periods || [{ period: 'full_time', sourceUrl: fx.sourceUrl, top: fx.top || [] }]);
    for (const snap of periodCards) {
      for (const card of snap.top || []) {
        const pct = parseFloat(card.pct) || 0;
        if (pct < PERCENT_FLOOR) continue;
        const mSample = /muestra (\d+)/.exec(card.meta || '');
        const sampleCount = mSample ? Number(mSample[1]) : 0;
        if (sampleCount < SAMPLE_FLOOR) continue;
        const bothSources = /2\/2 fuentes/.test(card.meta || '');

        let block = null, direction, line, marketText, scope, subject, teamKey, period, playdoitTeam, teamMarket = null, sideName = null;
        if (snap.period === 'full_time') {
          block = FULL_BLOCK.find(b => b.pattern.test(card.market));
          if (!block) continue;
          const m33 = block.pattern.exec(card.market);
          direction = /m[áa]s/i.test(m33[1]) ? 'over' : 'under';
          line = Number(m33[2]);
          marketText = block.marketText;
          scope = 'match'; subject = cMatch.match; teamKey = 'match'; period = 'full_time';
        } else if (snap.period === 'first_half') {
          block = HALF_BLOCK.find(b => b.pattern.test(card.market));
          if (!block) continue;
          const m33 = block.pattern.exec(card.market);
          direction = /m[áa]s/i.test(m33[1]) ? 'over' : 'under';
          line = Number(m33[2]);
          sideName = m33[3];
          const sideName = m33[3];
          const ourTokens = (sideName === 'del local'
            ? normalizeText(fx.eventText.split(' vs ')[0].replace(/\(L\)/gi, ''))
            : normalizeText(fx.eventText.split(' vs ')[1] ? fx.eventText.split(' vs ')[1].replace(/\(V\)/gi, '') : '')
          ).toLowerCase().split(' ').filter(Boolean);
          const halfMarkets = (cMatch.markets || []).filter(m2 => String(m2.marketText || '').startsWith(block.catPrefix));
          let best = null;
          for (const m2 of halfMarkets) {
            const team = String(m2.marketText).slice(block.catPrefix.length).trim();
            let s = sideScore(ourTokens, team);
            if (s > 0.6 && (!best || s > best.s)) best = { s, team, market: m2 };
          }
          if (!best) { console.log(`SKIP (sin ladder 1T ${sideName}) ${fx.eventText} ${card.market}`); continue; }
          marketText = best.market.marketText;
          playdoitTeam = best.team;
          scope = 'team'; subject = best.team; teamKey = playdoitTeam; period = 'first_half';
          teamMarket = best.market;
        } else {
          continue;
        }

        const market = (scope === 'team')
          ? teamMarket
          : (cMatch.markets || []).find(m2 => m2.marketText === marketText);
        if (!market) continue;
        const dirNode = (market.directions || []).find(d => d.direction === direction);
        const lineNode = (dirNode && (dirNode.lines || []).find(l => Number(l.line) === line)) || null;
        if (!lineNode) { console.log(`SKIP (linea sin ladder) ${fx.eventText} ${card.market}`); continue; }
        const momioNum = Number(String(lineNode.oddsText || '').replace('+', ''));
        if (Number.isFinite(momioNum) && momioNum <= -1500) { console.log(`SKIP (linea sin valor ${lineNode.oddsText}) ${fx.eventText} ${card.market}`); continue; }

        const candidateKey = `${cMatch.matchId}|${normalizeText(cMatch.match).toLowerCase().replace(/\s+/g, ' ')}|${block.family}|${scope}|${direction}|${line}|${period}`;
        if (existingKeys.has(candidateKey)) { console.log(`DUP ya existente: ${candidateKey}`); continue; }
        existingKeys.add(candidateKey);

        const side = /fuente local/.test(card.reason || '') ? 'home' : 'away';
        const sample = { home: 0, away: 0 };
        sample[side] = sampleCount;

        const cardId = crypto.createHash('sha256').update(`comparador-card|${cMatch.matchId}|${period}|${sideName || 'match'}|${card.market}|${pct}`).digest('hex');
        const candidateId = `DF-RC-${String(created.length + 1).padStart(3, '0')}`;

      const candidate = {
        candidateId,
        candidateKey,
        catalogMatchId: cMatch.matchId,
        match: cMatch.match,
        league: cMatch.league,
        subject,
        statistic: block.statistic,
        scope,
        direction,
        line,
        period,
        market: card.market,
        percentage: pct,
        sample,
        sampleText: (card.meta || '').replace(/^baja\s*/, '').trim(),
        evidence: [String(card.reason || '').replace(/\s+/g, ' ').trim()],
        sourceUrl: snap.sourceUrl || fx.sourceUrl,
        family: block.family,
        playdoitOddsText: lineNode.oddsText,
        editorialPriority: 'medium',
        commercialPriority: 'normal',
        datafutCard: {
          schemaVersion: 1,
          source: 'datafut_authenticated_comparador',
          captureRoute: 'comparador_state_url',
          cardId,
          sourceUrl: snap.sourceUrl || fx.sourceUrl,
          rawTitle: card.market,
          displayedPercentage: pct,
          sampleLine: (card.meta || '').replace(/^baja\s*/, '').trim(),
          evidenceText: [String(card.reason || '').replace(/\s+/g, ' ').trim()],
          unfortunately: bothSources ? '2/2 relaciones de fuente' : '1/2 fuentes (estimacion de la fuente disponible)',
          observedAt: fx.observedAt || sweep.observedAt
        }
      };

      const verification = {
        candidateId,
        percentage: pct,
        datafutCardId: cardId,
        status: 'AVAILABLE_EXACT',
        reason: null,
        editorialEligible: true,
        evidenceSource: 'live_dom',
        verificationNote: `Cobertura exacta derivada de catalogo VERIFIED (ladder ${marketText}, ${direction === 'over' ? 'Más' : 'Menos'} de ${decimalEs(line)}, momio ${lineNode.oddsText}).`,
        requested: {
          match: cMatch.match,
          subject,
          statistic: block.statistic,
          scope,
          direction,
          line,
          period,
          market: card.market
        },
        playdoit: {
          matchText: cMatch.match,
          marketText,
          selectionText: lineNode.rawSelection,
          oddsText: lineNode.oddsText,
          priceDecimal: lineNode.oddsDecimal,
          marketId: market.marketId,
          oddId: lineNode.oddId,
          eventUrl: cMatch.eventUrl
        },
        domEvidence: {
          schemaVersion: 1,
          source: 'comparador_dom',
          verificationMethod: 'catalog_ladder_exact',
          observedAt: nowIso,
          url: snap.sourceUrl || fx.sourceUrl,
          catalogMatchId: cMatch.matchId,
          marketText,
          selectionText: lineNode.rawSelection,
          oddsText: lineNode.oddsText,
          oddId: lineNode.oddId,
          catalogGeneratedAt: catalog.generatedAt
        }
      };

      const eligibleItem = { candidateKey, discovery: candidate, verification, verifiedAt: nowIso };

      if (!dryRun) {
        (discovery.candidates = discovery.candidates || []).push(candidate);
        (verified.results = verified.results || []).push(verification);
        verified.totalCandidatesReviewed = (verified.totalCandidatesReviewed || 0) + 1;
        verified.totalEligible = (verified.totalEligible || 0) + 1;
        eligible.candidates = eligible.candidates || [];
        eligible.candidates.push(eligibleItem);
        eligible.eligibleCount = eligible.candidates.length;
      }

      created.push({ candidateId, market: card.market, pct, sampleCount, sources: bothSources ? '2/2' : '1/2', oddsText: lineNode.oddsText });
      console.log(`CANDIDATO ${candidateId} ${fx.eventText} :: ${card.market} ${pct}% muestra ${sampleCount} (${bothSources ? '2/2' : '1/2'} fuentes) momio ${lineNode.oddsText}`);
      }
    }
  }

  if (created.length === 0) { console.log('Sin candidatos comparadores curables con los pisos vigentes.'); return; }

  if (dryRun) { console.log(`DRY-RUN OK: ${created.length} candidato(s) detectado(s); estado no tocado.`); return; }

  discovery.discoveryUpdatedAt = nowIso;
  writeJson(discoveryPath, discovery);
  verified.verifiedAt = nowIso;
  writeJson(verifiedPath, verified);
  eligible.generatedAt = nowIso;
  writeJson(eligiblePath, eligible);
  console.log(`Inyeccion comparador OK: ${created.length} candidato(s).`);
})().catch(e => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });
