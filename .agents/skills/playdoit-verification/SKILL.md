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

# NAVEGACIÓN

Intentar headless.

Si no funciona:

headed.

Puede utilizar:

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

# FILTRO 65%

Verification puede conservar el porcentaje DataFut como metadata.

No decide el respaldo.

Si por error recibe:

percentage <65%

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