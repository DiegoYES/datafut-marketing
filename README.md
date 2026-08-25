# DataFut Marketing

Pipeline local para descubrir, verificar y convertir selecciones de DataFut en contenido vertical para redes sociales.

## Estado actual

El renderer estable de **PARLAY DE DATOS** permanece en la raiz del proyecto. Esta primera etapa de estabilizacion no mueve ni reescribe sus componentes:

- `parlay-data.json`: entrada editorial de 2 o 3 picks.
- `generate-parlay-voice-dynamic.py`: genera voz y subtitulos en `parlay-audio/`.
- `parlay-video-template.html`: composicion visual.
- `render-parlay-video.js`: captura la composicion y crea el paquete final en `renders/`.

Los scripts de descubrimiento, verificacion y diagnostico existentes siguen en `scripts/`. Hasta completar su consolidacion, ninguno debe considerarse el unico orquestador oficial.

## Requisitos

- Node.js 22 o compatible.
- Python 3.13 o compatible.
- Dependencias de Node instaladas con `npm install`.
- Dependencias de Python usadas por el generador de voz, incluyendo `edge-tts`.

FFmpeg no necesita estar instalado globalmente: el renderer utiliza `ffmpeg-static`.

## Comandos seguros

Consultar las etapas canónicas y el estado local:

```powershell
npm run datafut -- status
```

Auditar si las verificaciones y cotizaciones poseen procedencia suficiente para publicar:

```powershell
npm run datafut -- audit
```

Generar una vista previa comercial desde la API pública, claramente no publicable:

```powershell
npm run datafut -- catalog-preview
```

La vista previa queda `NOT_VERIFIED` y no habilita Discovery. Un catálogo oficial necesita observación DOM real; cambiar manualmente la etiqueta a `live_dom` no sirve porque el auditor también exige semántica derivada, ausencia de duplicados y una captura PNG auténtica.

Ejecutar las pruebas de contrato que también deberá respetar cualquier cambio hecho con Gemini:

```powershell
npm run test:contracts
```

Extraer DataFut con la sesión local y descubrir únicamente intersecciones exactas con el catálogo DOM actual:

```powershell
npm run datafut -- discover-live --date 2026-08-21
```

Este comando deduplica partidos por su identificador de DataFut, ignora encuentros fuera del catálogo y exige coincidencia de estadística, alcance, dirección, línea y periodo. Sólo conserva porcentajes estrictamente mayores de 70% y descarta antes de Verification los overs triviales de goles, tiros, tiros a puerta, córners, tarjetas y faltas. Guarda datos intermedios en `scripts/datafut-live-raw.json` y candidatos no publicables en `pipeline-state/discovery-candidates.json`.

Cada candidato queda ligado por SHA-256 a una tarjeta DataFut exacta. El validador reproduce el porcentaje final promediando las dos tasas `con suavizado` de esa tarjeta y bloquea cruces entre mercados totales, locales y visitantes. Un porcentaje parcial encontrado dentro de la explicación nunca puede sustituir el porcentaje final mostrado junto al título.

La semántica de PlayDoIt también se deriva del texto literal observado. Por ejemplo, `Total de tarjetas U. de Concepción — Más de 3.5` siempre se clasifica como mercado de equipo y nunca puede validar `Más de 3.5 tarjetas totales del partido`, aunque línea y cuota coincidan.

Discovery rechaza archivos sueltos o de otra ronda: la extracción autenticada, el catálogo y los candidatos deben compartir fecha y `catalogGeneratedAt`. Los scripts `scratch_*` son diagnósticos y nunca constituyen una fuente oficial del pipeline.

Después de verificar los candidatos en el DOM visible de PlayDoIt, separa las opciones editoriales:

```powershell
npm run datafut -- options
```

Mientras no exista el adaptador DOM real, `npm run datafut -- verify` falla de forma cerrada y genera cero elegibles. Del mismo modo, `npm run datafut -- parlays` conserva cálculos únicamente en `parlay-options-estimated.json` y deja `parlay-options.json` sin finalistas publicables.

El resultado queda en `pipeline-state/format-options.json`: cada candidato exacto puede presentarse como pick individual; los parlays normales sólo combinan partidos distintos; y los mercados del mismo partido quedan como posibles combinadas hasta comprobar compatibilidad y cuota real en el Bet Builder. El comando no elige, apuesta ni publica.

Si Verification descarta candidatos y todavía no hay hasta 6 elegibles, ejecutar la reposición:

```powershell
npm run datafut -- replenish
```

La reposición conserva los elegibles, recuerda cada mercado exacto ya evaluado y genera una nueva ronda de hasta 10 candidatos sin repetir descartes. El ciclo Discovery → Verification → Replenish se repite hasta reunir 6 elegibles, agotar candidatos, alcanzar 4 rondas o requerir un catálogo nuevo.

Los parlays pueden seguir siendo dobles o triples: el validador, la narración y la plantilla de video soportan ambos tamaños.

Validar la entrada sin generar archivos:

```powershell
npm run validate:data
```

Validar tecnicamente todos los paquetes presentes en `renders/`:

```powershell
npm run validate:renders
```

Ejecutar ambas validaciones:

```powershell
npm run validate
```

La validacion completa tambien compara los tres componentes estables y los dos reels actuales contra las huellas SHA-256 guardadas en `validation/golden-renders.json`. Una diferencia exige revision; no debe actualizarse la referencia automaticamente.

Generar un parlay despues de revisar `parlay-data.json`:

```powershell
npm run render:parlay
```

Para contenido nuevo no se edita `parlay-data.json` manualmente. Primero listar
las opciones certificadas y, despues de la eleccion humana, congelar exactamente
una opcion:

```text
npm run datafut -- finalists
npm run datafut -- freeze-content --option PAR-... --date YYYY-MM-DD
npm run validate:data
npm run render:parlay
```

`freeze-content` enlaza cada pick con `candidateId`, `datafutCardId`, el pool
elegible y la lectura DOM del boleto. Cualquier cambio manual de porcentaje,
mercado, equipos, muestra, tarjeta o momio invalida la certificacion y bloquea
voz y video. El comando genera `promo-data.json`, `parlay-data.json` o
`combinada-data.json` segun el tipo de opcion elegida.

La interfaz recomendada permite indicar archivo y fecha, y ofrece un ensayo sin efectos:

```powershell
npm run datafut -- render --input parlay-data.json --date 2026-08-21 --dry-run
npm run datafut -- render --input parlay-data.json --date 2026-08-21
```

El ultimo comando valida los datos, genera la narracion y finalmente renderiza el video. Nunca publica contenido ni realiza apuestas.

## Reglas editoriales protegidas

- Cada pick debe tener un respaldo DataFut estrictamente mayor de 70%; 70.0% no es elegible.
- Los porcentajes son individuales; no representan la probabilidad conjunta del parlay.
- Un parlay debe contener 2 o 3 picks y exactamente 2 evidencias por pick.
- La seleccion final sigue requiriendo decision humana y revalidacion en PlayDoIt.
- El pipeline no debe confirmar apuestas, ingresar stake ni utilizar fondos.

## Datos locales y seguridad

Los archivos de sesion, cookies, estados del navegador, renders, capturas, audio y datos intermedios estan excluidos de Git. No copies esos archivos a otra ubicacion versionada.

Los archivos actuales pueden contener texto UTF-8 previamente corrompido, por ejemplo `RÃ­o`. Los validadores lo reportan como advertencia para poder corregirlo de forma controlada sin bloquear el renderer existente.

## Proxima etapa

Catalog y Discovery ya están separados y enlazados por `catalogGeneratedAt`. El trabajo pendiente empieza en Verification: debe releer cada candidato en el DOM visible de PlayDoIt y declarar `discoveryGeneratedAt` antes de que Builder pueda consumirlo.

El manifiesto de migracion esta en `config/pipeline-manifest.json`. Las etapas de verificacion y builder permanecen bloqueadas hasta que observen directamente el DOM y lean el momio mostrado por el betslip; los scripts basados en API, dumps o multiplicacion quedan marcados como no publicables.

Los selectores reales se registraran en `config/playdoit-dom.json`. Su estado inicial es `UNVERIFIED_SELECTORS`: las pistas historicas no se aceptan como selectores oficiales hasta probarlas contra la interfaz visible. El contrato exigido para mercados y betslip vive en `scripts/lib/dom-evidence.js`.

La lista de comprobaciones para revisar cambios con Gemini u otro modelo esta en `docs/CROSS-MODEL-VALIDATION.md`.
