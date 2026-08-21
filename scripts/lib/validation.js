const fs = require('fs');

const MOJIBAKE_MARKERS = ['Ã', 'Â', 'ðŸ', 'â€', 'âš', 'â', 'ï¸'];

function readJson(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath}: ${error.message}`);
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`JSON invalido en ${filePath}: ${error.message}`);
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function collectMojibake(value, currentPath = '$', findings = []) {
  if (typeof value === 'string') {
    if (MOJIBAKE_MARKERS.some(marker => value.includes(marker))) {
      findings.push(currentPath);
    }
    return findings;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectMojibake(item, `${currentPath}[${index}]`, findings);
    });
    return findings;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      collectMojibake(item, `${currentPath}.${key}`, findings);
    });
  }

  return findings;
}

function validateParlayData(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: ['La raiz debe ser un objeto JSON.'], warnings };
  }

  if (data.format !== 'parlay-de-datos') {
    errors.push('format debe ser "parlay-de-datos".');
  }

  if (!isNonEmptyString(data.date) || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('date debe usar el formato YYYY-MM-DD.');
  }

  ['title', 'subtitle', 'ctaTitle', 'ctaText', 'probabilityNotice', 'disclaimer']
    .forEach(field => {
      if (!isNonEmptyString(data[field])) {
        errors.push(`${field} debe ser texto no vacio.`);
      }
    });

  if (!['analysis', 'energy', 'tension'].includes(data.musicPreset)) {
    errors.push('musicPreset debe ser analysis, energy o tension.');
  }

  if (!Array.isArray(data.picks) || ![2, 3].includes(data.picks.length)) {
    errors.push('picks debe contener exactamente 2 o 3 elementos.');
  } else {
    data.picks.forEach((pick, index) => {
      const prefix = `picks[${index}]`;

      if (!pick || typeof pick !== 'object' || Array.isArray(pick)) {
        errors.push(`${prefix} debe ser un objeto.`);
        return;
      }

      ['league', 'homeTeam', 'awayTeam', 'market', 'sampleText'].forEach(field => {
        if (!isNonEmptyString(pick[field])) {
          errors.push(`${prefix}.${field} debe ser texto no vacio.`);
        }
      });

      if (typeof pick.percentage !== 'number' || !Number.isFinite(pick.percentage)) {
        errors.push(`${prefix}.percentage debe ser un numero.`);
      } else {
        if (pick.percentage < 65) {
          errors.push(`${prefix}.percentage debe ser al menos 65.`);
        }
        if (pick.percentage > 100) {
          errors.push(`${prefix}.percentage no puede superar 100.`);
        }
      }

      if (!Array.isArray(pick.evidence) || pick.evidence.length !== 2) {
        errors.push(`${prefix}.evidence debe contener exactamente 2 elementos.`);
      } else {
        pick.evidence.forEach((evidence, evidenceIndex) => {
          ['label', 'value', 'detail'].forEach(field => {
            if (!evidence || !isNonEmptyString(evidence[field])) {
              errors.push(`${prefix}.evidence[${evidenceIndex}].${field} debe ser texto no vacio.`);
            }
          });
        });
      }
    });
  }

  const mojibake = collectMojibake(data);
  if (mojibake.length > 0) {
    warnings.push(
      `Se detecto texto posiblemente corrompido por codificacion en ${mojibake.length} campo(s): ` +
      mojibake.slice(0, 8).join(', ') +
      (mojibake.length > 8 ? ', ...' : '')
    );
  }

  return { errors, warnings };
}

module.exports = {
  collectMojibake,
  readJson,
  validateParlayData
};
