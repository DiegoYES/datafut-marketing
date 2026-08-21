const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'renders');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));

console.log('--- ALL GENERATED MP4 REELS ---');
files.forEach((f, idx) => {
  const sizeMb = (fs.statSync(path.join(dir, f)).size / (1024 * 1024)).toFixed(2);
  console.log(`${idx + 1}. ${f} (${sizeMb} MB)`);
});
