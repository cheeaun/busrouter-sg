const fs = require('fs');
const toTitleCase = require('../utils/titleCase');
const { round } = require('@turf/helpers');

const stops = JSON.parse(fs.readFileSync('data/3/stops3.json'));

const stops3 = {};

for (number in stops) {
  const { lat, lng, name, left } = stops[number];
  stops3[number] = [
    round(lng, 5),
    round(lat, 5),
    toTitleCase(name),
    left ? 1 : 0,
  ];
}

const filePath = 'data/3/stops.final.json';
fs.writeFileSync(filePath, JSON.stringify(stops3, null, '\t'));
console.log(`Generated ${filePath}`);
