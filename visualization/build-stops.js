const fs = require('fs');
const circle = require('@turf/circle').default;
const { round } = require('@turf/helpers');
const toTitleCase = require('../utils/titleCase');

const stops = JSON.parse(fs.readFileSync('data/3/stops.geojson'));
const levels = JSON.parse(fs.readFileSync('visualization/data/levels.json'));

console.log(`Total stops: ${stops.features.length}`);

const data = stops.features.map(f => {
  f.geometry.coordinates.forEach(c => round(c, 5));
  const feature = circle(f, .015, { steps: 3 });
  return {
    ...f.properties,
    name: toTitleCase(f.properties.name),
    level: levels[f.properties.number],
    contour: feature.geometry.coordinates,
  }
});

const stopsFile = 'visualization/data/stops.3d.json';
fs.writeFileSync(stopsFile, JSON.stringify(data, null, ' '));
console.log(`File generated: ${stopsFile}`);