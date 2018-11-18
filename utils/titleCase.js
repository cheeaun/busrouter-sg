const fs = require('fs');
const ABBRS = JSON.parse(fs.readFileSync('data/3/abbrs.json'));
// Special use-case to for abbreviations used in Singapore

module.exports = function(str){
  return str.replace(/\w\S*/g, (s) => {
    if (ABBRS.includes(s)){
      return s;
    }
    return s.charAt(0).toUpperCase() + s.substr(1).toLowerCase()
  });
}