const fs = require('fs');
const path = require('path');

const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, 'candidates.json'), 'utf8'));

candidates.forEach((c, idx) => {
  console.log(`\n=================== CANDIDATE ${idx + 1} ===================`);
  console.log('Match Text:', c.matchText);
  console.log('URL:', c.url);
  console.log('Title:', c.title);
  console.log('Full Text Snippet (first 1000 chars):');
  console.log(c.text.slice(0, 1000));
});
