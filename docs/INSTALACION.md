# Instalación y primera corrida — DataFut Marketing (guía para humanos)

Para replicar el flujo diario (picks → parlays → video → publicación).
Al modelo de IA solo dile: *"sigue `docs/RUNBOOK-OPERACION.md` al pie de la letra"*;
esta guía es lo que el modelo NO puede adivinar: tu máquina y tus sesiones.

## 1. Requisitos (una vez por máquina)

- Windows 10/11 con Git.
- **Node.js 22 LTS** (`node --version` debe dar v22.x).
- **Google Chrome** instalado (la cotización del boleto lo usa por CDP).
- OpenCode + un modelo agente (Muse Spark u otro).
- ffmpeg NO se instala aparte: viene con `npm install` (paquete `ffmpeg-static`).

## 2. Clonar e instalar

```bat
git clone https://github.com/DiegoYES/datafut-marketing.git
cd datafut-marketing
npm install
npx playwright install chromium
```

## 3. Sesiones (una vez por persona, NUNCA se commitean)

- DataFut: `npm run datafut -- login-datafut` e inicia sesión en la ventana
  (timeout 3 min). Guarda `datafut-marketing-session.json` local.
- PlayDoIt: no requiere login; los builders y la captura funcionan públicos.
- Verifica que `git status` NO liste esos JSON (están en `.gitignore`).

## 4. Verificar que todo funciona

```bat
npm run validate:skills
npm run test:betslip-import
```

## 5. Primera corrida (con el modelo, fecha de mañana, Ciudad de México)

Pídele al modelo textual: *"Ejecuta el pipeline para YYYY-MM-DD siguiendo
docs/RUNBOOK-OPERACION.md sección 1, solo comandos oficiales"*.
El modelo se detiene tras `finalists`; el humano elige; luego
`freeze-content` + `render` (+ `publish` si tu cuenta tiene permiso).

## 6. Reglas de convivencia (importantes si operan varios a la vez)

- **429 de DataFut**: si dos raspan fuerte al mismo tiempo, el sitio limita.
  Turnos para discovery/capturas o fechas distintas.
- **Un Chrome CDP por carpeta**: la captura usa puerto 9222 y perfil
  `chrome_cdp_profile/`. Dos carpetas = dos perfiles/puertos distintos.
- **Nunca se apuesta ni se publica en casas**: solo lectura + renders +
  publicación editorial en data-fut.com con orden explícita.
- **No commitear**: sesiones (`*.json` de sesión), `captures/`, `renders/`,
  `pipeline-state/`, scripts scratch. Solo código oficial + skills + docs.
- Publicar en data-fut.com requiere permiso de publicación en tu cuenta
  (lo otorga el admin); el video solo necesita el freeze.
