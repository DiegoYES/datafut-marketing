# Contratos de captura DOM de PlayDoIt

Estos contratos son el puente obligatorio entre una navegacion de Chrome y los archivos oficiales de `pipeline-state`.

No escribir directamente en `pipeline-state`. Guardar la observacion bajo `captures/dom/` y ejecutar el importador oficial. El importador deriva los estados; el modelo nunca escribe `AVAILABLE_EXACT` ni un momio oficial por su cuenta.

## Catalog

Comando:

```text
npm run datafut -- catalog-dom --observation captures/dom/<catalog>.json
```

Raiz minima:

```json
{
  "schemaVersion": 1,
  "captureType": "playdoit_catalog",
  "source": "live_dom",
  "observedAt": "ISO-8601",
  "targetDate": "YYYY-MM-DD",
  "navigationMode": "chrome_extension",
  "events": []
}
```

Cada evento contiene `observedAt`, `url`, `eventId`, `homeTeam`, `awayTeam`, `eventText`, `league`, `visible: true`, `rawText`, `selectors`, `screenshot` y `markets`.

Cada mercado contiene el titulo literal `marketText`, el texto completo de su propio contenedor en `rawText` y `selections[]`. Cada seleccion conserva `selectionText` y `oddsText` leidos dentro de ese mismo contenedor.

Solo incluir mercados con direccion y linea reconocibles. Expandir los mercados estadisticos cerrados antes de leerlos. `marketCoverage` debe ser `PARTIAL` salvo que se haya comprobado toda la oferta relevante del evento.

La captura debe ser un PNG real dentro del proyecto y declarar su SHA-256. Renombrar JPEG como `.png` no es valido.

`catalog-preview` puede servir como plan de navegacion, pero siempre produce `live_api NOT_VERIFIED` y nunca sustituye este contrato.

## Verification

Comando:

```text
npm run datafut -- verify-dom --observation captures/dom/<verification>.json
```

Raiz minima:

```json
{
  "schemaVersion": 1,
  "captureType": "playdoit_verification",
  "source": "live_dom",
  "observedAt": "ISO-8601",
  "navigationMode": "chrome_extension",
  "catalogGeneratedAt": "valor exacto del Catalog actual",
  "discoveryGeneratedAt": "valor exacto de Discovery actual",
  "candidateObservations": []
}
```

Cada candidato observado contiene:

- `candidateId`, `observedAt`, `url`, `homeTeam`, `awayTeam`;
- `eventText`, `marketText`, `selectionText`, `oddsText` literales;
- `visible: true`, `rawText` del contenedor exacto y `screenshot`;
- `betslip` con los mismos cuatro textos, `rawText`, `selectionCount: 1`, `observedAt`, `cleanupEmpty: true` y `cleanupObservedAt`.

Secuencia de navegador:

1. abrir el evento exacto;
2. localizar el titulo exacto del mercado;
3. acotar al contenedor de ese titulo;
4. localizar la seleccion solo como descendiente del contenedor;
5. leer la cuota;
6. agregar temporalmente la seleccion;
7. comprobar evento, mercado, seleccion y cuota en una unica fila del boleto;
8. capturar evidencia;
9. retirar la seleccion y comprobar boleto vacio.

Si falta cualquier dato, omitir la observacion del candidato. El importador generara `NOT_VERIFIED`; no completar campos por inferencia.

## Cotizacion de parlays

Primero ejecutar `npm run datafut -- parlays`. Aunque termina bloqueado para
publicacion, genera `pipeline-state/parlay-quote-request.json` con las
combinaciones y textos exactos que deben capturarse.

Comando:

```text
npm run datafut -- parlays-dom --observation captures/dom/<betslip-quotes>.json
```

Automatización oficial: Para evitar bloqueos de Cloudflare WAF (403) y leer el DOM de Altenar, lanzar Google Chrome (`chrome.exe`) con `--remote-debugging-port=9222`, conectar vía CDP (`chromium.connectOverCDP`) e interactuar con los elementos dentro del open `shadowHost.shadowRoot`. Se puede ejecutar `node scripts/capture-live-betslip.js` para automatizar la cotización completa.

Raiz minima:

```json
{
  "schemaVersion": 1,
  "captureType": "playdoit_betslip_quotes",
  "source": "live_dom",
  "navigationMode": "chrome_extension",
  "observedAt": "ISO-8601",
  "verificationGeneratedAt": "valor exacto de Verification",
  "quotes": []
}
```

Cada quote conserva `candidateIds` (exactamente 2 o 3), `observedAt`, `url`, `visible: true`, `combinedOddsText`, `rawText`, `selectionRows`, `screenshot` y `cleanup`.

Cada fila declara `candidateId`, `matchText`, `marketText`, `selectionText`, `oddsText` y `rawText`. Los cuatro textos deben coincidir exactamente con Verification. `cleanup` contiene `empty: true` y `observedAt` posterior a la lectura.

Nunca ingresar stake, iniciar sesion en PlayDoIt, confirmar apuesta ni calcular manualmente el momio oficial.

## DataFut autenticado

`discover-live` requiere `datafut-marketing-session.json` vigente. Si DataFut redirige a `login.html`, detenerse y renovar la sesion; una extraccion de cero partidos causada por sesion expirada no es un resultado valido.

Cuando la sesion vigente existe solamente en Chrome, capturar las tarjetas y
sus dialogos en una observacion con `captureType: "datafut_discovery"`, `source:
"authenticated_chrome_dom"`, la fecha y `catalogGeneratedAt` actuales. Cada
tarjeta conserva titulo, porcentaje, muestra, texto completo, exactamente dos
tasas `con suavizado`, captura PNG y SHA-256. Ejecutar:

`npm run datafut -- discover-dom --observation <archivo.json>`

El importador recalcula el promedio antes de crear `datafutCardId`. Las tarjetas
rojas se descartan y `tarjetas registradas` no se equipara a tarjetas amarillas
si PlayDoIt no ofrece literalmente el mismo tipo.
