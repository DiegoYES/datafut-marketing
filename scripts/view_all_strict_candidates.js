const fs = require('fs');
const path = require('path');

const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, 'strict_verified_all_21.json'), 'utf8'));

console.log(`=== TODOS LOS ${candidates.length} CANDIDATOS VERIFICADOS AL 100% ===\n`);

// Deduplicate
const uniqueMap = new Map();
candidates.forEach(c => {
  const key = `${c.match}|${c.datafutTitle}|${c.playdoitMarket}|${c.playdoitSelection}`;
  if (!uniqueMap.has(key)) uniqueMap.set(key, c);
});

const list = Array.from(uniqueMap.values());
list.forEach((c, idx) => {
  console.log(`[${idx+1}] Partido: ${c.match} (${c.time} | ${c.league})`);
  console.log(`    - Mercado DataFut: "${c.datafutTitle}" (% DataFut: ${c.percentage}% | Muestra: ${c.sample})`);
  console.log(`    - Mercado PlayDoIt: "${c.playdoitMarket} -> ${c.playdoitSelection}"`);
  console.log(`    - Alcance: ${c.scope === 'match' ? 'PARTIDO COMPLETO (Ambos equipos)' : c.scope === 'team_home' ? `SOLO ${c.match.split(' vs ')[0]} (Local)` : `SOLO ${c.match.split(' vs ')[1]} (Visitante)`}`);
  console.log(`    - Cuota PlayDoIt: ${c.price}`);
  console.log(`    - Evidencia: ${c.evidence}\n`);
});
