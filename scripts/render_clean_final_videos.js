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

const opcion2 = {
  format: "parlay-de-datos",
  date: "2026-08-21",
  title: "PARLAY DE DATOS 📊",
  subtitle: "Momio +100 en Playdoit · Goles Nocturnos",
  musicPreset: "energy",
  picks: [
    {
      league: "CHILE PRIMERA DIVISIÓN 🇨🇱",
      homeTeam: "Audax Italiano",
      awayTeam: "Unión La Calera",
      market: "MÁS DE 1.5 GOLES TOTALES",
      percentage: 66.5,
      sampleText: "Muestra de 9 local / 9 visitante",
      evidence: [
        {
          label: "Audax en casa",
          value: "80.0%",
          detail: "partidos con 2 o más goles"
        },
        {
          label: "La Calera fuera",
          value: "66.7%",
          detail: "partidos con 2 o más goles"
        }
      ]
    },
    {
      league: "EE.UU. NWSL FEMENIL 🇺🇸",
      homeTeam: "San Diego Wave",
      awayTeam: "Utah Royals",
      market: "MENOS DE 3.5 GOLES TOTALES",
      percentage: 71.4,
      sampleText: "Muestra de 10 local / 10 visitante",
      evidence: [
        {
          label: "San Diego en casa",
          value: "90.0%",
          detail: "partidos con menos de 4 goles"
        },
        {
          label: "Utah Royals fuera",
          value: "70.0%",
          detail: "partidos con menos de 4 goles"
        }
      ]
    }
  ],
  ctaTitle: "¿LE ENTRAS AL MOMIO +100? 🔥",
  ctaText: "Consulta el análisis completo en data-fut.com",
  probabilityNotice: "Los porcentajes corresponden al respaldo individual de cada mercado. No representan la probabilidad conjunta de la combinada.",
  disclaimer: "Estimaciones basadas en datos históricos. No garantizan resultados."
};

console.log('>>> [1/2] RENDERIZANDO VIDEO 1 (CONTROL SUDAMERICANO - MOMIO +104)...');
fs.writeFileSync(parlayDataPath, JSON.stringify(opcion1, null, 2));
execSync('py generate-parlay-voice-dynamic.py', { cwd: projectDir, stdio: 'inherit' });
execSync('node render-parlay-video.js', { cwd: projectDir, stdio: 'inherit' });

console.log('\n>>> [2/2] RENDERIZANDO VIDEO 2 (GOLES NOCTURNOS - MOMIO +100)...');
fs.writeFileSync(parlayDataPath, JSON.stringify(opcion2, null, 2));
execSync('py generate-parlay-voice-dynamic.py', { cwd: projectDir, stdio: 'inherit' });
execSync('node render-parlay-video.js', { cwd: projectDir, stdio: 'inherit' });

console.log('\n¡VIDEOS 1 Y 2 COMPLETADOS CON AUDIO PERFECTO SIN SOLAPAMIENTOS!');
