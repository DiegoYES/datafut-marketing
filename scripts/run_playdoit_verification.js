const fs = require('fs');
const path = require('path');

// Read discovery candidates
const discoveryPath = path.join(__dirname, '..', 'pipeline-state', 'discovery-candidates.json');
const discoveryData = JSON.parse(fs.readFileSync(discoveryPath, 'utf8'));
const candidates = discoveryData.candidates;

// Read live PlayDoIt dump captured during current session
const playdoitDumpPath = path.join(__dirname, 'detailed_playdoit_markets_dump.json');
const playdoitDump = JSON.parse(fs.readFileSync(playdoitDumpPath, 'utf8'));

// Match ID mapping for PlayDoIt
const matchEventMap = {
  'LDU Quito vs Mirassol': '16807924',
  'Macará vs Santos': '17281413',
  'Leones FC vs Real Cundinamarca': '17414465'
};

const verifiedResults = [];

for (const c of candidates) {
  const eventId = matchEventMap[c.match];
  
  if (!eventId || !playdoitDump[eventId] || playdoitDump[eventId].error) {
    verifiedResults.push({
      candidateId: c.candidateId,
      status: 'NOT_AVAILABLE',
      reason: 'NOT_AVAILABLE: Partido no ofrecido actualmente en el catálogo público de PlayDoIt.',
      requested: {
        match: c.match,
        subject: c.subject,
        statistic: c.statistic,
        scope: c.scope,
        direction: c.direction,
        line: c.line,
        period: c.period,
        market: c.market
      },
      playdoit: null
    });
    continue;
  }

  const eventData = playdoitDump[eventId];
  const allMarkets = eventData.markets || [];

  let matched = false;
  let matchStatus = 'MARKET_MISMATCH';
  let matchReason = '';
  let foundPlaydoitData = null;

  // 1. GOALS MARKETS (Match Total / Team Total)
  if (c.statistic === 'goals') {
    if (c.scope === 'match') {
      // Find 'Total' or 'Goles Totales'
      const totalMarket = allMarkets.find(m => m.name === 'Total' || m.name === 'Goles Totales');
      if (totalMarket && totalMarket.odds) {
        // Look for exact line and direction
        const dirText = c.direction === 'over' ? 'Más de' : 'Menos de';
        const lineStr = String(c.line).replace('.', ',');
        const exactOdd = totalMarket.odds.find(o => {
          const name = o.name.toLowerCase();
          const sv = parseFloat(o.sv || '0');
          return name.startsWith(dirText.toLowerCase()) && (sv === c.line || name.includes(lineStr) || name.includes(String(c.line)));
        });

        if (exactOdd) {
          matched = true;
          matchStatus = 'AVAILABLE_EXACT';
          // Convert price to American odds format for reporting
          let americanOdds = '';
          const p = exactOdd.price;
          if (p >= 2.0) {
            americanOdds = `+${Math.round((p - 1) * 100)}`;
          } else {
            americanOdds = `-${Math.round(100 / (p - 1))}`;
          }

          foundPlaydoitData = {
            matchText: `${eventData.event.name || c.match}`,
            marketText: totalMarket.name,
            selectionText: exactOdd.name,
            oddsText: `${exactOdd.price.toFixed(2)} (${americanOdds})`,
            priceDecimal: exactOdd.price,
            priceAmerican: americanOdds,
            subject: c.subject,
            statistic: c.statistic,
            scope: c.scope,
            direction: c.direction,
            line: c.line,
            period: c.period,
            marketId: totalMarket.id,
            oddId: exactOdd.id
          };
        } else {
          // Line mismatch
          matchStatus = 'LINE_MISMATCH';
          const availableLines = totalMarket.odds.map(o => `${o.name} (@${o.price})`).join(', ');
          matchReason = `LINE_MISMATCH: El mercado de Total Goles existe pero no contiene la línea exacta ${c.line}. Líneas disponibles: [${availableLines}]`;
        }
      } else {
        matchStatus = 'MARKET_MISMATCH';
        matchReason = 'MARKET_MISMATCH: Mercado de Total Goles no disponible para este partido en PlayDoIt.';
      }
    } else if (c.scope === 'team') {
      // Team goals: e.g. "Local marca" -> PlayDoIt has "Qué equipo marca" or "[Team] total de goles"
      const teamMarket = allMarkets.find(m => 
        m.name.toLowerCase().includes(`${c.subject.toLowerCase()} total de goles`) ||
        m.name.toLowerCase().includes('qué equipo marca') ||
        (m.name.toLowerCase().includes('total de goles') && m.name.toLowerCase().includes(c.subject.toLowerCase()))
      );
      if (teamMarket && teamMarket.odds) {
        const exactOdd = teamMarket.odds.find(o => {
          const n = o.name.toLowerCase();
          const sv = parseFloat(o.sv || '0');
          return (n.includes('más de') || n.includes('si') || n.includes('marcan')) && (sv === c.line || c.line === 0.5);
        });
        if (exactOdd) {
          matched = true;
          matchStatus = 'AVAILABLE_EXACT';
          let americanOdds = '';
          const p = exactOdd.price;
          if (p >= 2.0) {
            americanOdds = `+${Math.round((p - 1) * 100)}`;
          } else {
            americanOdds = `-${Math.round(100 / (p - 1))}`;
          }
          foundPlaydoitData = {
            matchText: `${eventData.event.name || c.match}`,
            marketText: teamMarket.name,
            selectionText: exactOdd.name,
            oddsText: `${exactOdd.price.toFixed(2)} (${americanOdds})`,
            priceDecimal: exactOdd.price,
            priceAmerican: americanOdds,
            subject: c.subject,
            statistic: c.statistic,
            scope: c.scope,
            direction: c.direction,
            line: c.line,
            period: c.period,
            marketId: teamMarket.id,
            oddId: exactOdd.id
          };
        } else {
          matchStatus = 'LINE_MISMATCH';
          matchReason = `LINE_MISMATCH: Mercado de goles de equipo encontrado pero línea ${c.line} no disponible.`;
        }
      } else {
        matchStatus = 'MARKET_MISMATCH';
        matchReason = `MARKET_MISMATCH: Mercado de goles individuales para ${c.subject} no disponible en PlayDoIt.`;
      }
    }
  }

  // 2. CORNERS MARKETS
  else if (c.statistic === 'corners') {
    const cornerMarket = allMarkets.find(m => 
      m.name.toLowerCase() === 'total de córners' || 
      m.name.toLowerCase() === 'total tiros de esquina' ||
      m.name.toLowerCase() === 'córners totales'
    );
    if (cornerMarket && cornerMarket.odds) {
      const dirText = c.direction === 'over' ? 'más de' : 'menos de';
      const exactOdd = cornerMarket.odds.find(o => {
        const n = o.name.toLowerCase();
        const sv = parseFloat(o.sv || '0');
        return n.startsWith(dirText) && (sv === c.line || n.includes(String(c.line).replace('.', ',')));
      });

      if (exactOdd) {
        matched = true;
        matchStatus = 'AVAILABLE_EXACT';
        let americanOdds = exactOdd.price >= 2.0 ? `+${Math.round((exactOdd.price - 1) * 100)}` : `-${Math.round(100 / (exactOdd.price - 1))}`;
        foundPlaydoitData = {
          matchText: `${eventData.event.name || c.match}`,
          marketText: cornerMarket.name,
          selectionText: exactOdd.name,
          oddsText: `${exactOdd.price.toFixed(2)} (${americanOdds})`,
          priceDecimal: exactOdd.price,
          priceAmerican: americanOdds,
          subject: c.subject,
          statistic: c.statistic,
          scope: c.scope,
          direction: c.direction,
          line: c.line,
          period: c.period,
          marketId: cornerMarket.id,
          oddId: exactOdd.id
        };
      } else {
        matchStatus = 'LINE_MISMATCH';
        const available = cornerMarket.odds.map(o => o.name).join(', ');
        matchReason = `LINE_MISMATCH: Mercado de córners existe pero no con línea ${c.line}. Líneas en PlayDoIt: [${available}]`;
      }
    } else {
      // Check if interval corners or only team corners exist
      const otherCorners = allMarkets.filter(m => m.name.toLowerCase().includes('córner') || m.name.toLowerCase().includes('esquina'));
      if (otherCorners.length > 0) {
        matchStatus = 'SCOPE_MISMATCH';
        matchReason = `SCOPE_MISMATCH: PlayDoIt solo ofrece córners por intervalos/tiempo (${otherCorners.map(m => m.name).slice(0, 2).join('; ')}), no la línea regular ${c.line}.`;
      } else {
        matchStatus = 'MARKET_MISMATCH';
        matchReason = 'MARKET_MISMATCH: Mercado de tiros de esquina / córners no habilitado para este partido en PlayDoIt.';
      }
    }
  }

  // 3. CARDS / TARJETAS
  else if (c.statistic === 'yellow_cards' || c.statistic === 'cards') {
    const cardMarket = allMarkets.find(m => m.name.toLowerCase() === 'total de tarjetas' || m.name.toLowerCase() === 'tarjetas');
    if (cardMarket && cardMarket.odds) {
      if (c.scope === 'team') {
        const teamCardMarket = allMarkets.find(m => m.name.toLowerCase().includes(`total de tarjetas ${c.subject.toLowerCase()}`));
        if (teamCardMarket && teamCardMarket.odds) {
          const dirText = c.direction === 'over' ? 'más de' : 'menos de';
          const exactOdd = teamCardMarket.odds.find(o => o.name.toLowerCase().startsWith(dirText) && parseFloat(o.sv || '0') === c.line);
          if (exactOdd) {
            matched = true;
            matchStatus = 'AVAILABLE_EXACT';
            let americanOdds = exactOdd.price >= 2.0 ? `+${Math.round((exactOdd.price - 1) * 100)}` : `-${Math.round(100 / (exactOdd.price - 1))}`;
            foundPlaydoitData = {
              matchText: `${eventData.event.name || c.match}`,
              marketText: teamCardMarket.name,
              selectionText: exactOdd.name,
              oddsText: `${exactOdd.price.toFixed(2)} (${americanOdds})`,
              priceDecimal: exactOdd.price,
              priceAmerican: americanOdds,
              subject: c.subject,
              statistic: c.statistic,
              scope: c.scope,
              direction: c.direction,
              line: c.line,
              period: c.period,
              marketId: teamCardMarket.id,
              oddId: exactOdd.id
            };
          } else {
            matchStatus = 'LINE_MISMATCH';
            matchReason = `LINE_MISMATCH: Tarjetas de equipo existe pero línea ${c.line} no encontrada.`;
          }
        } else {
          matchStatus = 'SCOPE_MISMATCH';
          matchReason = `SCOPE_MISMATCH: PlayDoIt ofrece Total de Tarjetas del partido pero no tarjetas individuales de ${c.subject}.`;
        }
      } else {
        const dirText = c.direction === 'over' ? 'más de' : 'menos de';
        const exactOdd = cardMarket.odds.find(o => o.name.toLowerCase().startsWith(dirText) && parseFloat(o.sv || '0') === c.line);
        if (exactOdd) {
          matched = true;
          matchStatus = 'AVAILABLE_EXACT';
          let americanOdds = exactOdd.price >= 2.0 ? `+${Math.round((exactOdd.price - 1) * 100)}` : `-${Math.round(100 / (exactOdd.price - 1))}`;
          foundPlaydoitData = {
            matchText: `${eventData.event.name || c.match}`,
            marketText: cardMarket.name,
            selectionText: exactOdd.name,
            oddsText: `${exactOdd.price.toFixed(2)} (${americanOdds})`,
            priceDecimal: exactOdd.price,
            priceAmerican: americanOdds,
            subject: c.subject,
            statistic: c.statistic,
            scope: c.scope,
            direction: c.direction,
            line: c.line,
            period: c.period,
            marketId: cardMarket.id,
            oddId: exactOdd.id
          };
        } else {
          matchStatus = 'LINE_MISMATCH';
          const available = cardMarket.odds.map(o => o.name).join(', ');
          matchReason = `LINE_MISMATCH: Mercado de tarjetas existe pero no con línea ${c.line}. Disponibles: [${available}]`;
        }
      }
    } else {
      matchStatus = 'MARKET_MISMATCH';
      matchReason = 'MARKET_MISMATCH: Mercado de tarjetas no disponible para este partido en PlayDoIt.';
    }
  }

  // 4. FOULS / TIROS / SHOTS / SHOTS ON TARGET
  else if (c.statistic === 'fouls' || c.statistic === 'shots' || c.statistic === 'shots_on_target') {
    // Check if player props / team stats markets exist
    const statsMarkets = allMarkets.filter(m => 
      m.name.toLowerCase().includes('falta') || 
      m.name.toLowerCase().includes('tiro') || 
      m.name.toLowerCase().includes('remate')
    );
    if (statsMarkets.length > 0) {
      matchStatus = 'SCOPE_MISMATCH';
      matchReason = `SCOPE_MISMATCH: Mercados de tiros/faltas en PlayDoIt no corresponden a la estadística/alcance regular (${statsMarkets.map(m => m.name).slice(0, 2).join('; ')}).`;
    } else {
      matchStatus = 'MARKET_MISMATCH';
      matchReason = `MARKET_MISMATCH: El mercado de ${c.statistic} (${c.market}) no está publicado comercialmente en PlayDoIt para este partido.`;
    }
  }

  if (matched) {
    verifiedResults.push({
      candidateId: c.candidateId,
      status: 'AVAILABLE_EXACT_CAPTURED',
      evidenceSource: 'captured_dump',
      requested: {
        match: c.match,
        subject: c.subject,
        statistic: c.statistic,
        scope: c.scope,
        direction: c.direction,
        line: c.line,
        period: c.period,
        market: c.market
      },
      playdoit: foundPlaydoitData
    });
  } else {
    verifiedResults.push({
      candidateId: c.candidateId,
      status: matchStatus,
      reason: matchReason,
      requested: {
        match: c.match,
        subject: c.subject,
        statistic: c.statistic,
        scope: c.scope,
        direction: c.direction,
        line: c.line,
        period: c.period,
        market: c.market
      },
      playdoit: null
    });
  }
}

const verifiedOutput = {
  verifiedAt: new Date().toISOString(),
  navigationMode: "offline_dump",
  evidenceSource: "captured_dump",
  publishable: false,
  integrityNotice: "Este script compara contra un dump capturado; no constituye verificacion live_dom para publicar.",
  totalCandidatesReviewed: verifiedResults.length,
  availableExactCount: 0,
  availableExactCapturedCount: verifiedResults.filter(r => r.status === 'AVAILABLE_EXACT_CAPTURED').length,
  discardedCount: verifiedResults.filter(r => r.status !== 'AVAILABLE_EXACT_CAPTURED').length,
  results: verifiedResults
};

const verifiedOutputPath = path.join(__dirname, '..', 'pipeline-state', 'verified-candidates.json');
fs.writeFileSync(verifiedOutputPath, JSON.stringify(verifiedOutput, null, 2), 'utf8');

console.log('--- VERIFICATION COMPLETED ---');
console.log(`Candidates Reviewed: ${verifiedOutput.totalCandidatesReviewed}`);
console.log(`AVAILABLE_EXACT: ${verifiedOutput.availableExactCount}`);
console.log(`Discarded: ${verifiedOutput.discardedCount}`);
console.log(`Saved to: ${verifiedOutputPath}`);

console.log('\n--- VERIFICATION RESULTS TABLE ---');
verifiedResults.forEach(r => {
  const pData = r.playdoit;
  console.log(`[${r.candidateId}] [${r.status.padEnd(16)}] ${r.requested.match.padEnd(32)} | DataFut: ${r.requested.market.padEnd(35)} | PlayDoIt: ${(pData ? pData.selectionText + ' (' + pData.oddsText + ')' : r.reason).slice(0, 45)}`);
});
