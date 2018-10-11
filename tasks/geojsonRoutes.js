const fs = require('fs');
const { encode } = require('../utils/specialID');

const services = JSON.parse(fs.readFileSync('data/3/services.json'));

const features = [];

services.forEach(service => {
  const { no } = service;
  const routes = JSON.parse(fs.readFileSync(`data/3/route-lines/${no}.json`));
  routes.forEach((route, i) => {
    features.push({
      type: 'Feature',
      id: encode(`${i+1}${no}`),
      properties: {
        number: no,
      },
      geometry: {
        type: 'LineString',
        coordinates: route,
      },
    });
  });
});

const filePath = 'data/3/routes.geojson';
fs.writeFileSync(filePath, JSON.stringify({
  type: 'FeatureCollection',
  features,
}, null, '\t'));
console.log(`Generated ${filePath}`);