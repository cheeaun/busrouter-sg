const fs = require('fs');
const services = JSON.parse(fs.readFileSync('data/3/services.json'));

const readFile = (path) => {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (e) {
    return false;
  }
};

const features = [];

services.forEach(service => {
  const { no } = service;
  const routes =
    readFile(`data/3/routes/mytransportsg/${no}.json`) ||
    readFile(`data/3/routes/towertransitsg/${no}.json`) ||
    readFile(`data/3/routes/onemapsg/${no}.json`) ||
    readFile(`data/3/routes/mapbox/${no}.json`);
  routes.forEach((route, i) => {
    features.push({
      type: 'Feature',
      properties: {
        number: no,
        route: i,
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