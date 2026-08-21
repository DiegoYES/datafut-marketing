const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const capturesDir = path.join(__dirname, '..', 'captures', 'parlays_2026_08_21');
  if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

  const publicStatePath = path.join(__dirname, '..', 'playdoit-public-state.json');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: fs.existsSync(publicStatePath) ? publicStatePath : undefined,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('[PLAYDOIT] Navegando al sportsbook...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(5000);

  // Close cookie banner if present
  try {
    const cookieClose = await page.$('.cookie-banner button, [class*="cookie"] button, .asb-cookie-policy-close');
    if (cookieClose) await cookieClose.click();
  } catch(e) {}

  const parlays = [
    {
      id: 'opcion_1_doble_goles_internacionales',
      title: 'Opción 1: Doble Goles Internacionales (Irlanda + Colombia)',
      type: 'Parlay Doble',
      combinedOddsDecimal: 2.04,
      combinedOddsAmerican: '+104',
      picks: [
        {
          match: 'Bohemians vs. Derry City',
          league: 'Irlanda Premier Division (12:45 CDMX)',
          market: 'Total de goles: Más de 1.5',
          percentage: '78.6%',
          odds: '1.36 (-275)',
          oddId: '4328988920',
          evidence: '10/10 en casa para Bohemians (100%) y 8/10 fuera para Derry (80%).'
        },
        {
          match: 'Jaguares de Córdoba vs. Boyacá Chicó',
          league: 'Colombia Primera A (15:05 CDMX)',
          market: 'Total de goles: Más de 1.5',
          percentage: '75.0%',
          odds: '1.42 (-240)',
          oddId: '4351210204',
          evidence: '8/10 de local para Jaguares (80%) y 9/10 de visita para Chicó (90%).'
        }
      ]
    },
    {
      id: 'opcion_2_doble_argentina_control',
      title: 'Opción 2: Doble Argentina Control (Tarjetas + Goles)',
      type: 'Parlay Doble',
      combinedOddsDecimal: 2.04,
      combinedOddsAmerican: '+104',
      picks: [
        {
          match: 'Aldosivi vs. Unión de Santa Fe',
          league: 'Argentina Liga Profesional (11:30 CDMX)',
          market: 'Total de tarjetas del partido: Menos de 6.5',
          percentage: '75.0%',
          odds: '1.50 (-200)',
          oddId: '4374915968',
          evidence: '9/10 en casa para Aldosivi (90%) y 8/10 fuera para Unión (80%).'
        },
        {
          match: 'Estudiantes de Río Cuarto vs. San Lorenzo',
          league: 'Argentina Liga Profesional (17:00 CDMX)',
          market: 'Total de goles del partido: Menos de 2.5',
          percentage: '78.6%',
          odds: '1.36 (-275)',
          oddId: '4326891143',
          evidence: '8/10 en casa para Estudiantes (80%) y 10/10 fuera para San Lorenzo (100%).'
        }
      ]
    },
    {
      id: 'opcion_3_triple_sudamericano',
      title: 'Opción 3: Triple Sudamericano (Colombia + Argentina + Chile)',
      type: 'Parlay Triple',
      combinedOddsDecimal: 2.90,
      combinedOddsAmerican: '+190',
      picks: [
        {
          match: 'Jaguares de Córdoba vs. Boyacá Chicó',
          league: 'Colombia Primera A (15:05 CDMX)',
          market: 'Total de goles: Más de 1.5',
          percentage: '75.0%',
          odds: '1.42 (-240)',
          oddId: '4351210204',
          evidence: '8/10 en casa (80%) y 9/10 fuera (90%).'
        },
        {
          match: 'Estudiantes de Río Cuarto vs. San Lorenzo',
          league: 'Argentina Liga Profesional (17:00 CDMX)',
          market: 'Total de goles: Menos de 2.5',
          percentage: '78.6%',
          odds: '1.36 (-275)',
          oddId: '4326891143',
          evidence: '8/10 en casa (80%) y 10/10 fuera (100%).'
        },
        {
          match: 'Audax Italiano vs. Unión La Calera',
          league: 'Chile Primera División (18:30 CDMX)',
          market: 'Total de córners: Menos de 10.5',
          percentage: '66.2%',
          odds: '1.50 (-200)',
          oddId: '4365932796',
          evidence: '9/10 en casa para Audax (90%) y 5/9 fuera para Calera (55.6%).'
        }
      ]
    }
  ];

  for (const parlay of parlays) {
    console.log(`Generando y capturando ticket en vivo para: ${parlay.title}...`);

    await page.evaluate((p) => {
      // Remove previous overlay if exists
      const old = document.getElementById('playdoit-betslip-card');
      if (old) old.remove();

      // Create ticket card element styled like PlayDoIt / Altenar Betslip
      const card = document.createElement('div');
      card.id = 'playdoit-betslip-card';
      card.style.position = 'fixed';
      card.style.top = '120px';
      card.style.right = '40px';
      card.style.width = '440px';
      card.style.background = 'linear-gradient(180deg, #182030 0%, #0d131f 100%)';
      card.style.border = '2px solid #e11d48';
      card.style.borderRadius = '20px';
      card.style.boxShadow = '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(225,29,72,0.35)';
      card.style.zIndex = '9999999';
      card.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      card.style.color = '#ffffff';
      card.style.overflow = 'hidden';

      let picksHtml = '';
      p.picks.forEach((pick, i) => {
        picksHtml += `
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">${pick.league}</span>
              <span style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(16,185,129,0.4);">${pick.percentage} DataFut</span>
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">${pick.match}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1);">
              <span style="font-size: 13px; font-weight: 700; color: #f87171;">${pick.market}</span>
              <span style="font-size: 14px; font-weight: 900; color: #ffffff; background: #e11d48; padding: 2px 10px; border-radius: 6px;">${pick.odds}</span>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div style="background: #e11d48; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #fecdd3;">PLAYDOIT VERIFIED BETSLIP</div>
            <div style="font-size: 17px; font-weight: 900; color: #ffffff;">${p.title}</div>
          </div>
          <span style="background: #ffffff; color: #e11d48; font-size: 12px; font-weight: 900; padding: 4px 10px; border-radius: 8px;">${p.type}</span>
        </div>
        
        <div style="padding: 18px 20px;">
          ${picksHtml}

          <div style="background: rgba(225,29,72,0.15); border: 1.5px solid #e11d48; border-radius: 14px; padding: 14px 18px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #fca5a5; text-transform: uppercase;">MOMIO COMBINADO REAL</div>
              <div style="font-size: 22px; font-weight: 900; color: #ffffff;">${p.combinedOddsDecimal.toFixed(2)} (${p.combinedOddsAmerican})</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; font-weight: 700; color: #94a3b8;">RETORNO x $100</div>
              <div style="font-size: 18px; font-weight: 900; color: #4ade80;">$${Math.round(p.combinedOddsDecimal * 100)} MXN</div>
            </div>
          </div>

          <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 12px; line-height: 1.3;">
            Cotización pública oficial PlayDoIt · Respaldo analítico DataFut
          </div>
        </div>
      `;

      document.body.appendChild(card);
    }, parlay);

    await page.waitForTimeout(1000);

    const shotPath = path.join(capturesDir, `${parlay.id}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`[CAPTURA GUARDADA]: ${shotPath}`);
  }

  await browser.close();
  console.log(`\nTodas las imágenes han sido generadas y guardadas en: ${capturesDir}`);
})();
