// cleanup-flow-evidence.js
// Libera disco de evidencia pasada del flujo SIN romper auditoria.
// - NUNCA toca: pipeline-state/, *.json, *publish*, reel.mp4, cover.png,
//   parlay-audio/, piper-voices/, sesiones (.env, *-session.json).
// - Borra: PNGs de catalogo/verificacion/cotizacion de fechas viejas,
//   intermediarios de render (source.webm, music.wav) y caches del perfil Chrome.
// Uso: node scripts/cleanup-flow-evidence.js [--keep 2026-10-17,2026-10-16] [--apply]
// Sin --apply solo reporta (dry-run).
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
const keepArg = process.argv[process.argv.indexOf('--keep') + 1] || '';
const KEEP = new Set(keepArg.split(',').map((s) => s.trim()).filter(Boolean));
const APPLY = process.argv.includes('--apply');

let freed = 0;
let count = 0;
function rm(file, why) {
  let size = 0;
  try { size = fs.statSync(file).size; } catch { return; }
  if (APPLY) {
    try { fs.rmSync(file, { recursive: true, force: true }); } catch (e) { console.log(`  !! no se pudo borrar ${file}: ${e.message}`); return; }
  }
  freed += size;
  count += 1;
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 1) captures/dom: PNGs fechados fuera de KEEP (los JSON jamas se tocan).
const domDir = path.join(projectDir, 'captures', 'dom');
if (fs.existsSync(domDir)) {
  for (const f of walk(domDir)) {
    const base = path.basename(f);
    if (!/\.png$/i.test(base)) continue;
    if (/publish/i.test(base)) continue;
    const m = base.match(/20\d{2}-\d{2}-\d{2}/);
    if (m && !KEEP.has(m[0])) rm(f, 'png-fecha-vieja');
  }
}

// 2) renders: intermediarios siempre; paquetes viejos se podan a entregables.
const rendersDir = path.join(projectDir, 'renders');
if (fs.existsSync(rendersDir)) {
  for (const e of fs.readdirSync(rendersDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const pkg = path.join(rendersDir, e.name);
    const dm = e.name.match(/^(20\d{2}-\d{2}-\d{2})/);
    const isOld = dm && !KEEP.has(dm[1]);
    for (const f of walk(pkg)) {
      const base = path.basename(f).toLowerCase();
      if (base === 'source.webm' || base === 'music.wav' || base.endsWith('.wav')) { rm(f, 'intermediario-render'); continue; }
      if (isOld && !/reel\.mp4$|cover\.png$|\.json$|\.txt$|\.srt$/.test(base)) rm(f, 'paquete-viejo');
    }
  }
}

// 3) chrome_cdp_profile: solo caches (cookies/sesion intactas).
const profDir = path.join(projectDir, 'chrome_cdp_profile');
if (fs.existsSync(profDir)) {
  const cacheRe = /(^|[\\/])(cache|code cache|shadercache|gpucache|crash reports?)($|[\\/])/i;
  for (const f of walk(profDir)) {
    if (cacheRe.test(f) || /\.(log|tmp|old)$/i.test(f)) rm(f, 'cache-chrome');
  }
}

console.log(`${APPLY ? 'BORRADO' : 'DRY-RUN'}: ${count} archivo(s), ${(freed / 1048576).toFixed(1)} MB${APPLY ? '' : ' (usa --apply para ejecutar)'}`);
console.log(`Fechas conservadas: ${[...KEEP].join(', ') || '(ninguna)'}`);
