import fs from 'fs';
import circle from '@turf/circle';
import { round } from '@turf/helpers';

const response = await fetch('https://data.busrouter.sg/v1/stops.min.geojson');
const stops = await response.json();
const levels = JSON.parse(fs.readFileSync('visualization/data/levels.json'));

console.log(`Total stops: ${stops.features.length}`);

const data = stops.features.map((f) => {
  f.geometry.coordinates.forEach((c) => round(c, 5));
  const feature = circle(f, 0.015, { steps: 3 });
  return {
    ...f.properties,
    level: levels[f.properties.number],
    contour: feature.geometry.coordinates,
  };
});

const stopsFile = 'visualization/data/stops.3d.json';
fs.writeFileSync(stopsFile, JSON.stringify(data, null, ' '));
console.log(`File generated: ${stopsFile}`);
