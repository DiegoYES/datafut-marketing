const path = require('node:path');
const { readJson } = require('./lib/validation');

const catalogPath = path.resolve(
  process.cwd(),
  process.argv[2] || 'pipeline-state/playdoit-catalog.json'
);
const catalog = readJson(catalogPath);
const errors = [];

function requireText(value, location) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${location} debe ser texto no vacio.`);
  }
}

requireText(catalog.generatedAt, 'generatedAt');
requireText(catalog.navigationMode, 'navigationMode');

if (catalog.evidenceSource !== 'live_dom') {
  errors.push('evidenceSource debe ser "live_dom".');
}
if (catalog.catalogStatus !== 'VERIFIED') {
  errors.push('catalogStatus debe ser "VERIFIED".');
}
if (!['FULL', 'PARTIAL'].includes(catalog.marketCoverage)) {
  errors.push('marketCoverage debe ser "FULL" o "PARTIAL".');
}
if (!Array.isArray(catalog.matches) || catalog.matches.length === 0) {
  errors.push('matches debe contener al menos un partido observado.');
}

const seenMatches = new Set();
let marketCount = 0;

for (const [matchIndex, match] of (catalog.matches || []).entries()) {
  const location = `matches[${matchIndex}]`;
  requireText(match.matchId, `${location}.matchId`);
  requireText(match.homeTeam, `${location}.homeTeam`);
  requireText(match.awayTeam, `${location}.awayTeam`);
  requireText(match.eventUrl, `${location}.eventUrl`);

  if (seenMatches.has(match.matchId)) {
    errors.push(`${location}.matchId esta duplicado.`);
  }
  seenMatches.add(match.matchId);

  if (!Array.isArray(match.markets) || match.markets.length === 0) {
    errors.push(`${location}.markets debe contener mercados observados.`);
    continue;
  }

  for (const [marketIndex, market] of match.markets.entries()) {
    const marketLocation = `${location}.markets[${marketIndex}]`;
    marketCount += 1;
    requireText(market.marketText, `${marketLocation}.marketText`);
    requireText(market.period, `${marketLocation}.period`);

    const selections = Array.isArray(market.selections) ? market.selections : [];
    const directions = Array.isArray(market.directions) ? market.directions : [];
    if (selections.length === 0 && directions.length === 0) {
      errors.push(`${marketLocation} no contiene selecciones ni lineas.`);
    }

    for (const [selectionIndex, selection] of selections.entries()) {
      requireText(selection.selection, `${marketLocation}.selections[${selectionIndex}].selection`);
      requireText(selection.oddsText, `${marketLocation}.selections[${selectionIndex}].oddsText`);
    }

    for (const [directionIndex, direction] of directions.entries()) {
      const directionLocation = `${marketLocation}.directions[${directionIndex}]`;
      if (!['over', 'under'].includes(direction.direction)) {
        errors.push(`${directionLocation}.direction debe ser "over" o "under".`);
      }
      if (!Array.isArray(direction.lines) || direction.lines.length === 0) {
        errors.push(`${directionLocation}.lines debe contener lineas observadas.`);
        continue;
      }
      for (const [lineIndex, line] of direction.lines.entries()) {
        const lineLocation = `${directionLocation}.lines[${lineIndex}]`;
        if (!Number.isFinite(line.line)) {
          errors.push(`${lineLocation}.line debe ser numerica.`);
        }
        requireText(line.oddsText, `${lineLocation}.oddsText`);
      }
    }
  }
}

if (Number(catalog.totalMatchesCataloged) !== (catalog.matches || []).length) {
  errors.push('totalMatchesCataloged no coincide con matches.length.');
}
if (Number(catalog.totalStructuredMarkets) !== marketCount) {
  errors.push('totalStructuredMarkets no coincide con los mercados guardados.');
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  console.error(`Catalogo invalido: ${errors.length} problema(s).`);
  process.exit(1);
}

console.log(
  `Catalogo DOM valido: ${catalog.matches.length} partido(s), ${marketCount} mercado(s), cobertura ${catalog.marketCoverage}.`
);
