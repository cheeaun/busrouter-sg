const fs = require('fs');
const circle = require('@turf/circle').default;

const stops = JSON.parse(fs.readFileSync('data/2/bus-stops.geojson'));
const levels = JSON.parse(fs.readFileSync('3d/data/levels.json'));

console.log(`Total stops: ${stops.features.length}`);
let maxRoutesCount = 0;

stops.features = stops.features.map(f => {
  const { number } = f.properties;
  const { routesCount } = levels[number];
  f.properties.routesCount = routesCount;
  if (routesCount > maxRoutesCount) maxRoutesCount = routesCount;
  f.id = number;
  return f;
});

console.log(`Max routes count: ${maxRoutesCount}`);

let geojsonFile = '3d/data/stops-2d.geojson';
fs.writeFileSync(geojsonFile, JSON.stringify(stops));
console.log(`File generated: ${geojsonFile}`);

stops.features = stops.features.map(f => {
  const { number } = f.properties;
  f.properties.level = levels[number].level;
  delete f.properties.routesCount;
  return circle(f, .012, { steps: 4 });
});

geojsonFile = '3d/data/stops.geojson';
fs.writeFileSync(geojsonFile, JSON.stringify(stops));
console.log(`File generated: ${geojsonFile}`);