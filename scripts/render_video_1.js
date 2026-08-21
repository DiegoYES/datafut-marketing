const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, '..');
const parlayDataPath = path.join(projectDir, 'parlay-data.json');

const opcion1 = {
  format: "parlay-de-datos",
  date: "2026-08-21",
  title: "PARLAY DE DATOS 📊",
  subtitle: "Momio +104 en Playdoit · Control Sudamericano",
  musicPreset: "energy",
  picks: [
    {
      league: "ARGENTINA LIGA PROFESIONAL 🇦🇷",
      homeTeam: "Estudiantes Río Cuarto",
      awayTeam: "San Lorenzo",
      market: "MENOS DE 2.5 GOLES TOTALES",
      percentage: 78.6,
      sampleText: "Muestra de 10 local / 10 visitante",
      evidence: [
        {
          label: "Estudiantes en casa",
          value: "80.0%",
          detail: "partidos con menos de 3 goles de local"
        },
        {
          label: "San Lorenzo de visita",
          value: "100%",
          detail: "partidos con menos de 3 goles fuera"
        }
      ]
    },
    {
      league: "CHILE PRIMERA DIVISIÓN 🇨🇱",
      homeTeam: "Audax Italiano",
      awayTeam: "Unión La Calera",
      market: "MENOS DE 10.5 CÓRNERS TOTALES",
      percentage: 66.2,
      sampleText: "Muestra de 9 local / 9 visitante",
      evidence: [
        {
          label: "Audax en casa",
          value: "90.0%",
          detail: "partidos con menos de 11 córners"
        },
        {
          label: "La Calera fuera",
          value: "55.6%",
          detail: "partidos con menos de 11 córners"
        }
      ]
    }
  ],
  ctaTitle: "¿LE ENTRAS AL MOMIO +104? 🔥",
  ctaText: "Consulta el análisis completo en data-fut.com",
  probabilityNotice: "Los porcentajes corresponden al respaldo individual de cada mercado. No representan la probabilidad conjunta de la combinada.",
  disclaimer: "Estimaciones basadas en datos históricos. No garantizan resultados."
};

console.log('>>> RENDERIZANDO VIDEO PARA OPCIÓN 1 (CONTROL SUDAMERICANO)...');
fs.writeFileSync(parlayDataPath, JSON.stringify(opcion1, null, 2));
execSync('py generate-parlay-voice-dynamic.py', { cwd: projectDir, stdio: 'inherit' });
execSync('node render-parlay-video.js', { cwd: projectDir, stdio: 'inherit' });

console.log('\n¡VIDEO 1 RENDERIZADO CON ÉXITO!');
