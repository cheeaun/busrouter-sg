const fs = require('fs');
const got = require('got');

Promise.all([
  got('https://landtransportguru.net/acronyms/'),
  got('https://en.m.wikipedia.org/wiki/List_of_Singapore_abbreviations'),
]).then(([res1, res2]) => {
  const matches1 = res1.body
    .match(/td[^<>]*>\s*[A-Z]{2,}\s*</g)
    .map((t) => t.match(/[A-Z]{2,}/)[0]);
  const matches2 = res2.body
    .match(/b[^<>]*>\s*[A-Z]{2,}\s*</g)
    .map((t) => t.match(/[A-Z]{2,}/)[0]);
  const abbrs = [...new Set([...matches1, ...matches2])].sort();

  const filePath = `data/3/abbrs.json`;
  fs.writeFileSync(filePath, JSON.stringify(abbrs, null, '\t'));
  console.log(`Generated ${filePath}`);
});
