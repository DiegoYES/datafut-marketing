const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const doc = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'captures', 'dom', 'playdoit-team-universe-2026-09-10.json'), 'utf8'
));
assert.equal(doc.schemaVersion, 1);
assert.equal(doc.source, 'live_api');
assert.ok(doc.observedAt);
assert.ok(Array.isArray(doc.teams.Pumas) && doc.teams.Pumas.length >= 1);
const pumas = doc.teams.Pumas[0];
assert.match(pumas.eventId, /^\d+$/);
assert.match(pumas.startTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-06:00$/);
assert.equal(typeof pumas.league, 'string');
assert.ok(pumas.league.length > 0, 'la competicion es el nombre que PlayDoIt usa');
// Normalizacion sin diacriticos: base del matching por equipo.
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
assert.equal(norm('São Bernardo'), 'sao bernardo');
assert.ok(norm('Norrköping IF').includes('norrkoping'));
assert.ok(norm('Pumas UNAM vs. Club Leon').includes('pumas'));

console.log('team-universe.test.js: OK (universo por equipo con competicion PlayDoIt).');
