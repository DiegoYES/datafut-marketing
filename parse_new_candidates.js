const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'candidates.json'), 'utf8'));

data.forEach((item, idx) => {
  console.log(`\n==================================================`);
  console.log(`CANDIDATE ${idx + 1}: ${item.title}`);
  console.log(`Match text: ${item.matchText}`);
  console.log(`URL: ${item.url}`);
  console.log(`--- CARDS FOUND ---`);
  console.log(item.cards);
  console.log(`--- FULL TEXT SNIPPET ---`);
  console.log(item.text.slice(0, 1500));
});
