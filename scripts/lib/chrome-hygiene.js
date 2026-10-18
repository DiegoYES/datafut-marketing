// Higiene de Chrome para automatizaciones DataFut (Windows).
// Los scripts ya cierran su browser en todas las rutas manejadas, pero un
// hard-kill (timeout) deja huerfanos. Cada script llama a
// killStaleAutomationChrome() al arrancar para no acumular Chromes.
//
// Solo toca Chromes cuya linea de comando trae nuestros marcadores
// (perfil/proyecto o playwright). El Chrome personal del usuario (headed,
// su propio perfil) nunca coincide y no se toca.
const { execSync } = require('node:child_process');

function listChromeProcesses() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ForEach-Object { [pscustomobject]@{ pid = $_.ProcessId; cmd = $_.CommandLine } } | ConvertTo-Json -Compress -Depth 2`;
  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  try {
    const out = execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${b64}`, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000,
    });
    const txt = String(out || '').trim();
    if (!txt) return [];
    const parsed = JSON.parse(txt);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr
      .filter((p) => p && p.cmd)
      .map((p) => ({ pid: Number(p.pid), cmd: String(p.cmd) }));
  } catch {
    return [];
  }
}

function killStaleAutomationChrome(markers, label) {
  const killed = [];
  for (const p of listChromeProcesses()) {
    if (markers.some((mk) => p.cmd.includes(mk))) {
      try {
        execSync(`taskkill /F /PID ${p.pid}`, { stdio: 'ignore', timeout: 10000 });
        killed.push(p.pid);
      } catch {
        // Ya murio o sin permiso: se ignora.
      }
    }
  }
  if (killed.length > 0) console.log(`[higiene-chrome:${label}] huerfanos cerrados: ${killed.join(', ')}`);
  return killed;
}

module.exports = { killStaleAutomationChrome, listChromeProcesses };
