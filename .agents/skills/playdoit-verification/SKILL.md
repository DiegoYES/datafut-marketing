---
name: playdoit-verification
description: Reverify exact DataFut candidates against the current visible PlayDoIt DOM and record auditable evidence. Never substitute markets, build parlays, or bet.
---

# PlayDoIt Verification

## RESPONSABILIDAD ÚNICA

Confirmar EN VIVO que candidatos DataFut concretos siguen existiendo exactamente en PlayDoIt.

Catalog reduce el universo.

Verification confirma el candidato exacto.

---

# INPUTS

Leer:

C:\DataFut-Marketing\pipeline-state\playdoit-catalog.json

y:

C:\DataFut-Marketing\pipeline-state\discovery-candidates.json

---

# OUTPUT

Guardar:

C:\DataFut-Marketing\pipeline-state\verified-candidates.json

## COMANDO DOM OFICIAL

Capturar cada candidato siguiendo
[`../datafut-marketing/references/dom-capture-contracts.md`](../datafut-marketing/references/dom-capture-contracts.md)
y ejecutar:

`npm run datafut -- verify-dom --observation <archivo.json>`

El importador, no el modelo, deriva `AVAILABLE_EXACT`. El comando `verify` sin
observacion permanece como comprobacion fail-closed.

## AUTOMATIZACION OFICIAL

`node scripts/build-verification-observation.js` genera la observacion para
TODOS los candidatos de `discovery-candidates.json` (re-lectura en vivo de
cada linea exacta + PNG por evento) y luego se importa con `verify-dom`
como arriba. Los candidatos sin linea viva quedan fuera automaticamente
(LINE_MISMATCH / MARKET_MISMATCH).

---

# REGLA DE ORO

AVAILABLE_EXACT solo puede escribirse si el mercado exacto fue observado durante ESTA ejecución de Verification.

No basta con que aparezca en playdoit-catalog.json.

El catálogo puede haber cambiado.

---

# FUENTE

Sportsbook público de PlayDoIt.

Sin login.

Sin credenciales.

Sin apuesta.

---

# NAVEGACIÓN Y ARQUITECTURA PLAYDOIT

1. **Evitar headless convencional**: Cloudflare WAF bloquea Playwright en headless/emulado (Ray ID 403 / "Acceso bloqueado").
2. **Método oficial**: Lanzar Google Chrome del sistema (`chrome.exe`) con `--remote-debugging-port=9222` y conectar vía CDP (`chromium.connectOverCDP('http://localhost:9222')`). Esto mantiene `navigator.webdriver = false` y permite la navegación sin bloqueos.
3. **Shadow DOM de Altenar**: El sportsbook de PlayDoIt no está en el documento raíz; está montado dentro de un Shadow Root abierto (`shadowHost.shadowRoot`). Los selectores de mercado (`EventDetailsMarketBoxRoot`), líneas y cuotas deben consultarse dentro de `element.shadowRoot`.
4. Puede utilizar:
playdoit-public-state.json.

---

# EVIDENCIA

Para AVAILABLE_EXACT registrar:

evidenceSource = live_dom

verifiedAt

navigationMode

playdoit.matchText

playdoit.marketText

playdoit.selectionText

playdoit.oddsText

marketId cuando exista

oddId cuando exista.

Además copiar SIN MODIFICAR:

datafutCardId desde `discovery-candidates.json`.

Verification debe comprobar que `requested` coincide con la misma semántica
Discovery en sujeto, estadística, alcance, dirección, línea y periodo. También
debe conservar exactamente el mismo porcentaje. Si cambia cualquiera:

NOT_VERIFIED.

---

# MATCH EXACTO

Comparar:

partido.

---

# MERCADO EXACTO

Comparar:

sujeto;

estadística;

alcance;

dirección;

línea;

periodo.

Todo debe coincidir.

---

# ESTADOS

AVAILABLE_EXACT

LINE_MISMATCH

SCOPE_MISMATCH

MARKET_MISMATCH

PERIOD_MISMATCH

NOT_AVAILABLE

NOT_VERIFIED.

---

# CATÁLOGO NO GARANTIZA RESULTADO

Aunque Discovery haya utilizado una línea contenida en Catalog:

Verification debe volver a localizarla.

Si desapareció:

NOT_AVAILABLE.

Si cambió:

mismatch correspondiente.

---

# EJEMPLO

Catalog:

LDU +14.5 tiros.

Discovery:

LDU +14.5 tiros = 83.3%.

Verification actual:

solo existe LDU +15.5.

Resultado:

LINE_MISMATCH.

No AVAILABLE_EXACT.

---

# CUOTA

Leer cuota actual durante Verification.

La cuota puede diferir del Catalog.

Esto no invalida la selección siempre que:

mercado + línea + alcance + periodo

sigan iguales.

---

# REGLA ANTI-ALUCINACIÓN

Si no existe:

marketText

selectionText

oddsText

leído durante esta ejecución:

NO AVAILABLE_EXACT.

---

# OUTPUT EJEMPLO

{
  "verifiedAt": "...",
  "navigationMode": "headed",
  "results": [
    {
      "candidateId": "DF-001",
      "percentage": 83.3,
      "datafutCardId": "sha256...",
      "status": "AVAILABLE_EXACT",
      "evidenceSource": "live_dom",
      "playdoit": {
        "matchText": "...",
        "marketText": "...",
        "selectionText": "...",
        "oddsText": "-115",
        "marketId": "...",
        "oddId": "..."
      }
    }
  ]
}

---

# FILTRO >70%

Verification puede conservar el porcentaje DataFut como metadata.

No decide el respaldo.

Si por error recibe:

percentage <=70%

puede verificar comercialmente, pero debe marcar adicionalmente:

editorialEligible = false.

El orquestador no podrá utilizarlo.

---

# NO BUSCAR REEMPLAZOS

Si falla:

registrar estado.

No regresar a DataFut.

Eso corresponde al Orquestador.

---

# NO PARLAY

No formar combinaciones.

No leer momio conjunto.

Eso corresponde al Builder.

---

# FINAL

VERIFICATION responde:

"este candidato exacto existe AHORA".

No:

"este mercado debería existir".

No:

"este candidato conviene".
