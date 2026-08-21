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

La interfaz recomendada permite indicar archivo y fecha, y ofrece un ensayo sin efectos:

```powershell
npm run datafut -- render --input parlay-data.json --date 2026-08-21 --dry-run
npm run datafut -- render --input parlay-data.json --date 2026-08-21
```

El ultimo comando valida los datos, genera la narracion y finalmente renderiza el video. Nunca publica contenido ni realiza apuestas.

## Reglas editoriales protegidas

- Cada pick debe tener un respaldo DataFut minimo de 65%.
- Los porcentajes son individuales; no representan la probabilidad conjunta del parlay.
- Un parlay debe contener 2 o 3 picks y exactamente 2 evidencias por pick.
- La seleccion final sigue requiriendo decision humana y revalidacion en PlayDoIt.
- El pipeline no debe confirmar apuestas, ingresar stake ni utilizar fondos.

## Datos locales y seguridad

Los archivos de sesion, cookies, estados del navegador, renders, capturas, audio y datos intermedios estan excluidos de Git. No copies esos archivos a otra ubicacion versionada.

Los archivos actuales pueden contener texto UTF-8 previamente corrompido, por ejemplo `RÃ­o`. Los validadores lo reportan como advertencia para poder corregirlo de forma controlada sin bloquear el renderer existente.

## Proxima etapa

Una vez congelado y validado el resultado actual, el trabajo pendiente es consolidar los multiples scripts fechados en un solo orquestador configurable y archivar los experimentos sin borrarlos.

El manifiesto de migracion esta en `config/pipeline-manifest.json`. Las etapas de verificacion y builder permanecen bloqueadas hasta que observen directamente el DOM y lean el momio mostrado por el betslip; los scripts basados en API, dumps o multiplicacion quedan marcados como no publicables.
