# Protocolo de validacion cruzada

Este documento sirve para revisar cambios posteriores con Gemini u otro modelo sin perder las garantias del proyecto.

## Comandos obligatorios

Ejecutar desde `C:\DataFut-Marketing`:

```powershell
npm test
npm run datafut -- status
npm run datafut -- audit
npm run datafut -- render --input parlay-data.json --date YYYY-MM-DD --dry-run
```

`npm test` debe terminar con codigo 0.

`audit` debe terminar con codigo distinto de 0 mientras existan resultados heredados sin evidencia DOM. No se debe cambiar la auditoria para hacer pasar esos archivos antiguos.

## Reglas que ningun modelo puede relajar

- `live_api` y `captured_dump` no equivalen a `live_dom`.
- Multiplicar cuotas individuales no equivale a leer el momio del betslip.
- Una captura con un overlay creado por el proyecto no es evidencia del boleto nativo.
- No marcar `publishable=true` sin evidencia valida para cada candidato y finalista.
- No actualizar `validation/golden-renders.json` automaticamente.
- No usar selectores amplios como `[class*="odd"]` o `[class*="betslip"]` como prueba oficial.
- No ingresar stake, iniciar una apuesta ni pulsar botones de confirmacion.

## Calibracion pendiente del navegador

`config/playdoit-dom.json` debe permanecer en `UNVERIFIED_SELECTORS` hasta completar una inspeccion visible real.

Para cada selector propuesto se debe comprobar:

1. que identifica un elemento visible;
2. que es unico dentro del evento o betslip esperado;
3. que el texto crudo contiene partido, mercado, seleccion y cuota esperados;
4. que el betslip contiene exactamente 2 o 3 filas;
5. que el momio combinado se lee de un nodo distinto de las cuotas individuales;
6. que existe captura del estado y SHA-256;
7. que el betslip queda vacio al finalizar.

Solo entonces puede cambiarse el estado a `VERIFIED_LIVE_DOM` y añadirse `verification` con fecha, navegador y hash de captura.

## Revision de cambios

Comparar siempre contra los commits locales:

- `af56543`: baseline original protegido.
- `0fa1abc`: CLI y reglas de procedencia.

Revisar `git diff` antes de aceptar cambios. Ninguna modificacion debe incluir sesiones, cookies, audio, renders o estados locales ignorados.
