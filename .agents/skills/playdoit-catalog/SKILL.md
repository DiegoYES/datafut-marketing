# PlayDoIt Catalog

## RESPONSABILIDAD ÚNICA

Explorar el sportsbook público de PlayDoIt y construir un catálogo comercial actual de:

- partidos disponibles;
- mercados disponibles;
- líneas disponibles;
- sujetos disponibles;
- periodos disponibles;
- cuotas visibles cuando corresponda.

Esta skill NO utiliza DataFut.

Esta skill NO calcula respaldos estadísticos.

Esta skill NO decide picks.

Esta skill NO genera Parlays.

Esta skill NO renderiza contenido.

Su única función es responder:

"¿Qué existe realmente en PlayDoIt en este momento?"

---

# FUENTE

Utilizar exclusivamente el sportsbook público de PlayDoIt.

NO iniciar sesión.

NO usar credenciales.

NO crear cuenta.

NO apostar.

---

# OUTPUT OFICIAL

Guardar:

C:\DataFut-Marketing\pipeline-state\playdoit-catalog.json

Este archivo forma parte oficial de la arquitectura modular.

---

# OBJETIVO

Antes de Discovery, construir el universo comercial real disponible para el periodo solicitado.

Ejemplo:

si el usuario solicita partidos de hoy después de las 15:00 CDMX:

catalogar únicamente partidos relevantes dentro de dicho periodo.

---

# ACCESO

Intentar inicialmente navegación normal.

Si el sportsbook no carga correctamente en headless:

usar navegador visible / headed.

Puede utilizarse:

C:\DataFut-Marketing\playdoit-public-state.json

únicamente como estado público de navegación.

---

# CLOUDFLARE Y PROTECCIONES

NO intentar:

- bypass;
- stealth;
- spoofing;
- evasión de fingerprint;
- técnicas para circunvenir protecciones.

Si no puede cargarse el sportsbook:

catalogStatus = NOT_VERIFIED.

No inventar catálogo.

---

# EVIDENCIA REAL

Todo mercado registrado debe proceder de información leída durante ESTA ejecución.

Registrar:

evidenceSource = live_dom

navigationMode

generatedAt.

Si el dato no fue observado durante la navegación actual:

NO incluirlo como mercado confirmado.

---

# NIVEL DE CATÁLOGO

El catálogo debe llegar hasta donde sea necesario para ayudar a Discovery.

Por cada partido, intentar identificar:

- partido;
- liga;
- hora;
- mercado;
- sujeto;
- estadística;
- alcance;
- dirección;
- líneas visibles;
- periodo.

Cuando exista cuota individual visible:

puede registrarse.

---

# PARTIDOS

No asumir que un partido está disponible únicamente porque su liga aparece.

Debe localizarse el encuentro concreto.

Cada partido debe quedar identificado mediante:

homeTeam

awayTeam

league

startTime cuando esté disponible.

---

# MERCADOS

Explorar cuando existan:

- goles;
- team totals;
- ambos marcan;
- corners totales;
- corners por equipo;
- tiros;
- tiros por equipo;
- tiros a puerta;
- tiros a puerta por equipo;
- faltas;
- faltas por equipo;
- tarjetas;
- tarjetas por equipo;
- primer tiempo;
- segundo tiempo;
- otros mercados estadísticos utilizables.

No asumir que todas las ligas ofrecen las mismas familias.

---

# REGLA CRÍTICA

La ausencia de un mercado en una liga o partido NO debe inferirse por experiencia previa.

Debe observarse la oferta actual.

Ejemplo:

Serie B Brasil puede tener ciertos mercados en un partido y no tenerlos en otro.

Catalogar partido por partido.

---

# LÍNEAS

Cuando un mercado tenga varias líneas:

registrar las líneas realmente disponibles.

Ejemplo:

Total corners:

8.5
9.5
10.5
11.5

No reducirlo a:

"corners disponibles".

Discovery necesita conocer las líneas concretas.

---

# SUJETO Y ALCANCE

Distinguir:

Botafogo corners

de:

Total corners del partido.

Distinguir:

LDU tiros

de:

Total tiros del partido.

Nunca fusionar ambos en una sola familia genérica.

---

# ESTRUCTURA OUTPUT

playdoit-catalog.json:

{
  "generatedAt": "2026-08-20T...",
  "navigationMode": "headed",
  "evidenceSource": "live_dom",
  "catalogStatus": "VERIFIED",
  "matches": [
    {
      "matchId": "PD-001",
      "homeTeam": "LDU Quito",
      "awayTeam": "Mirassol",
      "league": "Copa Libertadores",
      "startTime": "...",
      "markets": [
        {
          "marketText": "Total Tiros LDU Quito",
          "subject": "LDU Quito",
          "statistic": "shots",
          "scope": "team",
          "period": "full_time",
          "directions": [
            {
              "direction": "over",
              "lines": [
                {
                  "line": 13.5,
                  "oddsText": "-110"
                },
                {
                  "line": 14.5,
                  "oddsText": "+105"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

---

# CATALOGO ≠ VERIFICACIÓN FINAL

La existencia en playdoit-catalog.json NO convierte automáticamente un candidato DataFut en AVAILABLE_EXACT.

El catálogo sirve para:

REDUCIR EL UNIVERSO DE BÚSQUEDA.

Después:

playdoit-verification debe volver a comprobar el candidato exacto.

---

# NO DECIDIR PICKS

Esta skill no debe decir:

"el mejor mercado es..."

"conviene..."

"recomiendo..."

Solo reporta disponibilidad comercial.

---

# NO BETSLIP DE PARLAYS

No formar Parlays.

No cotizar combinaciones.

Eso corresponde a:

datafut-parlay-builder.

---

# FALLAS PARCIALES

Si un partido carga pero algún bloque de mercados no puede verificarse:

no inventarlo.

Puede registrar:

marketCoverage = PARTIAL.

Discovery debe trabajar únicamente con mercados confirmados.

---

# REGLA FINAL

PLAYDOIT-CATALOG RESPONDE:

QUÉ EXISTE.

NO:

QUÉ CONVIENE.

NO:

QUÉ RESPALDA DATAFUT.

NO:

QUÉ PARLAY DEBE HACERSE.

CATÁLOGO
→ DISCOVERY
→ VERIFICATION.