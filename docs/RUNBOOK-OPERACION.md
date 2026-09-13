# Runbook operativo — PARLAY DE DATOS (para Spark, Gemini o humano de turno)

Fecha de referencia: los comandos usan `YYYY-MM-DD` de Ciudad de México.
Todo corre desde `C:\DataFut-Marketing`. Nunca se apuesta, nunca se publica,
nunca se ingresa stake. Solo lectura + renders locales.

Si te piden "los mejores picks de X día", ejecuta la sección 1 tal cual,
sin inventar archivos ni cuotas. Todo lo que sigue es oficial y
reproducible.

## 0. Pre-requisitos

- `datafut-marketing-session.json` vigente. Si Discovery redirige a
  `login.html`: `npm run datafut -- login-datafut` e iniciar sesión en la
  ventana (timeout 3 min). Alternativa automática: `node
  scripts/ensure-datafut-session.js` verifica; con `--login` renueva
  desde `.env` (ver `.env.example`; `.env` gitignorado, solo local).
- Google Chrome instalado (la captura del boleto usa
  `--remote-debugging-port` + `connectOverCDP`, perfil
  `chrome_cdp_profile/`).
- `config/team-aliases.json`: mapa cerrado PlayDoIt → alias DataFut
  (mismo club, distinto nombre). Solo agregar entradas verificadas.

## 1. Flujo diario (en orden, sin saltos)

```bat
:: 0. Observaciones del dia (generacion automatica oficial)
node scripts/build-catalog-observation.js --date YYYY-MM-DD

:: 1. Catalogo
npm run datafut -- catalog-dom --observation captures/dom/playdoit-catalog-observation-YYYY-MM-DD.json

:: 2. Discovery (usa la sesion DataFut; respeta team-aliases.json)
::    --limit N amplía el pool (tope R1 normal: 20). Sin limite, respeta el
::    tope para no saturar; con autorizacion del operador puede subirse.
npm run datafut -- discover-live --date YYYY-MM-DD [--limit 100]

:: 3. Verificacion (observacion generada automaticamente)
node scripts/build-verification-observation.js
npm run datafut -- verify-dom --observation captures/dom/playdoit-verification-observation-YYYY-MM-DD.json

:: 4-6. Reposición, opciones y combinaciones
npm run datafut -- replenish
npm run datafut -- options
npm run datafut -- parlays

:: 7. Cotización REAL en boleto (Chrome visible; lee cada momio del DOM, no calcula)
node scripts/capture-live-betslip.js
npm run datafut -- parlays-dom --observation captures/dom/playdoit-betslip-observation-YYYY-MM-DD.json

:: 8. Auditoría y finalistas
npm run datafut -- audit
npm run datafut -- finalists
```

Detenerse tras `finalists`. El humano elige. Luego:

```bat
npm run datafut -- freeze-content --option <optionId> --date YYYY-MM-DD
npm run datafut -- render --input parlay-data.json --date YYYY-MM-DD --dry-run
npm run datafut -- render --input parlay-data.json --date YYYY-MM-DD
```

## 2. Reglas de oro (violarlas = resultado inválido)

1. Umbral estricto: `percentage > 70.0`. Nada de `>=`.
2. Intersección exacta: mismo sujeto, estadística, alcance, dirección,
   línea y periodo entre tarjeta DataFut y mercado PlayDoIt. Una línea
   jamás respalda otra (13.5 ≠ 10.5).
3. Triviales excluidos antes de verificar: Over 0.5 goles; Over ≤2.5 tiros;
   Over ≤1.5 tiros a puerta; Over 0.5 tarjetas por equipo; Over ≤1.5
   corners; Over ≤2.5 faltas. (Los Under equivalentes sí pueden valer.)
4. `AVAILABLE_EXACT` solo lo deriva el importador desde evidencia `live_dom`.
5. Momio combinado solo del boleto real. Prohibido multiplicar cuotas.
6. Parlays: partidos distintos. Sin probabilidad conjunta (los % son
   respaldo individual).
7. `matchCatalogEntry` acepta nombre exacto o alias de
   `config/team-aliases.json`. Prohibido inventar equivalencias fuera de
   esa lista.
8. Dominancia de línea: mismo partido/mercado con igual % → Over se queda
   la línea más alta, Under la más baja. % distintos no se tocan.
9. Pisos de momio en finalistas (betslip-observation-import.js): dobles
   desde -150, triples desde +100. Si un tipo no tiene cotizaciones que
   pasen el piso, no aporta finalistas de ese tipo.
10. Diversificacion de finalistas: ningun pick aparece en mas de 2 de los
    5 finalistas en la primera pasada (greedy por cuota); si no se
    completan 5, el tope se relaja a 3 y luego sin tope. Un solo fallo no
    debe matar todo el menu.

## 3. Límites conocidos (no pelear contra ellos)

- El calendario DataFut solo expone texto en ~5 tarjetas destacadas; el
  resto de enlaces van pelados. `extract_datafut_live.js` los resuelve
  visitando cada `partido.html` con la misma sesión (cache operativo en
  `%TEMP%/datafut-link-titles.json` para no castigar el WAF). Si un título
  sale "Local vs Visitante", es página genérica: fail-closed, se ignora.
- El front de PlayDoIt vive en un `shadowRoot`; Playwright headless no lo
  hidrata. Para boleto: Chrome real por CDP (el script ya lo hace).
- El slider de línea muestra una línea por caja: el script barre 3-2-1-0-4-5.
- La limpieza del boleto debe verificarse (conteo 0) antes de cada combo;
  el botón válido es `button` "Limpiar todo", no el DIV contenedor; si
  falla, remover por `RemoveSelectionButton` de cada caja.
- La captura del boleto es reanudable: persiste quotes en el JSON tras cada
  combinación; al re-ejecutar salta las ya cotizadas.
- Pool editorial: `run_parlay_builder.js` ordena elegibles por respaldo
  menos penalización comercial (normal 0, low 6, very_low 12) y arma el
  pool de 6 con partidos distintos. Pesos editoriales, no ciencia.
- Sesgo de captura: si `audit` reporta errores, no existe `finalists`.

## 4. Archivos que mandan

- `pipeline-state/playdoit-catalog.json` (universo comercial)
- `pipeline-state/discovery-candidates.json` (respaldo DataFut)
- `pipeline-state/verified-candidates.json` (AVAILABLE_EXACT)
- `pipeline-state/parlay-options.json` (finalistas cotizados)
- `captures/dom/*.json` + PNG con SHA-256 (evidencia; el importador valida)
