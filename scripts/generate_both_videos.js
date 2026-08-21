const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = path.join(__dirname, '..');
const combinadaDataPath = path.join(projectDir, 'combinada-data.json');

const opcion1Data = {
  format: "combinada-de-datos",
  date: "2026-08-21",
  title: "DOBLE DE DATOS 📊",
  subtitle: "Momio +104 en Playdoit · Respaldado por estadísticas",
  musicPreset: "energy",
  selections: [
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
          label: "San Lorenzo fuera",
          value: "100%",
          detail: "partidos con menos de 3 goles de visita"
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
          label: "Audax de local",
          value: "90.0%",
          detail: "partidos con menos de 11 córners en casa"
        },
        {
          label: "La Calera de visita",
          value: "55.6%",
          detail: "partidos con menos de 11 córners fuera"
        }
      ]
    }
  ],
  ctaTitle: "¿LE ENTRAS AL MOMIO +104? 🔥",
  ctaText: "Consulta el análisis completo en data-fut.com",
  probabilityNotice: "Los porcentajes corresponden al respaldo individual de cada mercado. No representan la probabilidad conjunta de la combinada.",
  disclaimer: "Estimaciones basadas en datos históricos. No garantizan resultados."
};

const opcion2Data = {
  format: "combinada-de-datos",
  date: "2026-08-21",
  title: "DOBLE DE DATOS 📊",
  subtitle: "Momio +100 en Playdoit · Respaldado por estadísticas",
  musicPreset: "energy",
  selections: [
    {
      league: "CHILE PRIMERA DIVISIÓN 🇨🇱",
      homeTeam: "Audax Italiano",
      awayTeam: "Unión La Calera",
      market: "MÁS DE 1.5 GOLES TOTALES",
      percentage: 66.5,
      sampleText: "Muestra de 9 local / 9 visitante",
      evidence: [
        {
          label: "Audax de local",
          value: "80.0%",
          detail: "partidos con 2 o más goles en casa"
        },
        {
          label: "La Calera de visita",
          value: "66.7%",
          detail: "partidos con 2 o más goles fuera"
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
          detail: "partidos con menos de 4 goles de local"
        },
        {
          label: "Utah Royals fuera",
          value: "70.0%",
          detail: "partidos con menos de 4 goles de visita"
        }
      ]
    }
  ],
  ctaTitle: "¿LE ENTRAS AL MOMIO +100? 🔥",
  ctaText: "Consulta el análisis completo en data-fut.com",
  probabilityNotice: "Los porcentajes corresponden al respaldo individual de cada mercado. No representan la probabilidad conjunta de la combinada.",
  disclaimer: "Estimaciones basadas en datos históricos. No garantizan resultados."
};

console.log('=== GENERANDO VIDEO 1 (OPCIÓN 1: DOBLE CONTROL SUDAMERICANO) ===');
fs.writeFileSync(combinadaDataPath, JSON.stringify(opcion1Data, null, 2));

console.log('Generando locución con Edge TTS...');
execSync('py generate-combinada-voice.py', { cwd: projectDir, stdio: 'inherit' });

console.log('Renderizando video vertical...');
execSync('node render-combinada-video.js', { cwd: projectDir, stdio: 'inherit' });

console.log('\n=== GENERANDO VIDEO 2 (OPCIÓN 2: DOBLE GOLES NOCTURNOS) ===');
fs.writeFileSync(combinadaDataPath, JSON.stringify(opcion2Data, null, 2));

console.log('Generando locución con Edge TTS...');
execSync('py generate-combinada-voice.py', { cwd: projectDir, stdio: 'inherit' });

console.log('Renderizando video vertical...');
execSync('node render-combinada-video.js', { cwd: projectDir, stdio: 'inherit' });

console.log('\n¡AMBOS VIDEOS GENERADOS Y RENDERIZADOS CON ÉXITO!');
