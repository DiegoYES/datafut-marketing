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
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('Navegando a PlayDoIt...');
  await page.goto('https://www.playdoit.mx/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Close banner if present
  try {
    const promo = await page.$('.cookie-banner button, [class*="close"]');
    if (promo) await promo.click();
  } catch(e) {}

  const parlays = [
    {
      id: 'opcion_1_doble_goles_boleto',
      title: 'BOLETO 2',
      picksCount: 2,
      tab: 'Parlay',
      combinedAmerican: '+104',
      totalStake: '10.00',
      totalPayout: '20.40',
      picks: [
        {
          teamA: 'Bohemians Dublín',
          teamB: 'Derry City FC',
          market: 'Total',
          selection: 'Más de 1.5',
          price: '-275'
        },
        {
          teamA: 'Jaguares de Córdoba',
          teamB: 'Boyacá Chicó FC',
          market: 'Total',
          selection: 'Más de 1.5',
          price: '-240'
        }
      ]
    },
    {
      id: 'opcion_2_doble_argentina_boleto',
      title: 'BOLETO 2',
      picksCount: 2,
      tab: 'Parlay',
      combinedAmerican: '+104',
      totalStake: '10.00',
      totalPayout: '20.40',
      picks: [
        {
          teamA: 'Aldosivi',
          teamB: 'Unión de Santa Fe',
          market: 'Total de tarjetas',
          selection: 'Menos de 6.5',
          price: '-200'
        },
        {
          teamA: 'Estudiantes Río Cuarto',
          teamB: 'San Lorenzo',
          market: 'Total',
          selection: 'Menos de 2.5',
          price: '-275'
        }
      ]
    },
    {
      id: 'opcion_3_triple_sudamericano_boleto',
      title: 'BOLETO 3',
      picksCount: 3,
      tab: 'Parlay',
      combinedAmerican: '+190',
      totalStake: '10.00',
      totalPayout: '29.00',
      picks: [
        {
          teamA: 'Jaguares de Córdoba',
          teamB: 'Boyacá Chicó FC',
          market: 'Total',
          selection: 'Más de 1.5',
          price: '-240'
        },
        {
          teamA: 'Estudiantes Río Cuarto',
          teamB: 'San Lorenzo',
          market: 'Total',
          selection: 'Menos de 2.5',
          price: '-275'
        },
        {
          teamA: 'Audax Italiano',
          teamB: 'Unión La Calera',
          market: 'Total Tiros De Esquina',
          selection: 'Menos de 10.5',
          price: '-200'
        }
      ]
    }
  ];

  for (const parlay of parlays) {
    console.log(`Generando Boleto nativo para ${parlay.id}...`);

    await page.evaluate((p) => {
      const old = document.getElementById('native-playdoit-boleto-box');
      if (old) old.remove();

      let itemsHtml = '';
      p.picks.forEach(pick => {
        itemsHtml += `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; position: relative;">
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
      boletoEl.style.width = '400px';
      boletoEl.style.background = '#f8fafc';
      boletoEl.style.borderRadius = '12px';
      boletoEl.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
      boletoEl.style.zIndex = '9999999';
      boletoEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      boletoEl.style.overflow = 'hidden';
      boletoEl.style.border = '1px solid #cbd5e1';

      boletoEl.innerHTML = `
        <!-- Header -->
        <div style="background: #e11d48; color: #ffffff; padding: 10px 16px; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>BOLETO</span>
            <span style="background: #ffffff; color: #e11d48; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">${p.picksCount}</span>
          </div>
          <span style="font-size: 16px; cursor: pointer;">_</span>
        </div>

        <!-- Tabs -->
        <div style="display: flex; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-size: 12px; font-weight: 700; color: #64748b;">
          <div style="flex: 1; text-align: center; padding: 8px 0; cursor: pointer;">Derecha</div>
          <div style="flex: 1; text-align: center; padding: 8px 0; color: #e11d48; border-bottom: 2px solid #e11d48; background: #ffffff; cursor: pointer;">Parlay</div>
          <div style="flex: 1; text-align: center; padding: 8px 0; cursor: pointer;">Sistema</div>
        </div>

        <!-- Selections -->
        <div style="padding: 12px 14px; max-height: 280px; overflow-y: auto;">
          ${itemsHtml}
          
          <div style="text-align: center; font-size: 11px; font-weight: 600; color: #64748b; padding: 4px 0; cursor: pointer;">
            Limpiar todo 🗑️
          </div>
        </div>

        <!-- Summary & Payout -->
        <div style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: #1e293b;">Parlay</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: #64748b;">1 x</span>
              <input type="text" value="${p.totalStake}" style="width: 55px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; font-weight: 700; text-align: right;" readonly />
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span style="color: #64748b;">Momios</span>
            <span style="font-weight: 800; color: #0f172a;">${p.combinedAmerican}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span style="color: #64748b;">Apuesta total</span>
            <span style="font-weight: 800; color: #0f172a;">${p.totalStake}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
            <span style="color: #0f172a;">Ganancia Total</span>
            <span style="color: #10b981; font-size: 14px;">${p.totalPayout}</span>
          </div>

          <button style="width: 100%; margin-top: 10px; background: #e11d48; color: #ffffff; border: none; padding: 10px 0; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer;">
            Inicia sesión para realizar apuestas
          </button>
        </div>
      `;

      document.body.appendChild(boletoEl);
    }, parlay);

    await page.waitForTimeout(1500);

    const shotPath = path.join(capturesDir, `${parlay.id}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`[CAPTURA GUARDADA]: ${shotPath}`);
  }

  await browser.close();
  console.log('\nTodas las imágenes del boleto nativo listas.');
})();
