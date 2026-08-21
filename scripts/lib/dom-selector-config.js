const REQUIRED_SELECTOR_GROUPS = [
  'marketContainer',
  'selection',
  'betslipContainer',
  'selectionRow',
  'combinedOdds'
];

const UNSAFE_SELECTOR_PATTERNS = [
  /^\*$/,
  /^\[class\*=\s*["']?(odd|price|selection|market|betslip|coupon)["']?\]$/i
];

function validateDomSelectorConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, errors: ['La configuracion de selectores debe ser un objeto.'] };
  }
  if (config.version !== 1) errors.push('version debe ser 1.');
  if (config.status !== 'VERIFIED_LIVE_DOM') {
    errors.push('status debe ser "VERIFIED_LIVE_DOM" antes de ejecutar automatizacion publicable.');
  }
  if (config.targetOrigin !== 'https://www.playdoit.mx') {
    errors.push('targetOrigin debe ser exactamente https://www.playdoit.mx.');
  }

  REQUIRED_SELECTOR_GROUPS.forEach(group => {
    const selectors = config.selectors && config.selectors[group];
    if (!Array.isArray(selectors) || selectors.length === 0) {
      errors.push(`selectors.${group} debe contener al menos un selector probado.`);
      return;
    }
    selectors.forEach((selector, index) => {
      if (typeof selector !== 'string' || selector.trim().length === 0) {
        errors.push(`selectors.${group}[${index}] debe ser texto no vacio.`);
        return;
      }
      if (UNSAFE_SELECTOR_PATTERNS.some(pattern => pattern.test(selector.trim()))) {
        errors.push(`selectors.${group}[${index}] es demasiado amplio: ${selector}`);
      }
    });
  });

  if (!config.verification || typeof config.verification !== 'object') {
    errors.push('verification es obligatorio.');
  } else {
    if (!config.verification.observedAt || !Number.isFinite(Date.parse(config.verification.observedAt))) {
      errors.push('verification.observedAt debe ser ISO-8601.');
    }
    if (!/^[a-f0-9]{64}$/i.test(config.verification.screenshotSha256 || '')) {
      errors.push('verification.screenshotSha256 debe ser un SHA-256 hexadecimal.');
    }
    if (!config.verification.browser || typeof config.verification.browser !== 'string') {
      errors.push('verification.browser es obligatorio.');
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  REQUIRED_SELECTOR_GROUPS,
  validateDomSelectorConfig
};
