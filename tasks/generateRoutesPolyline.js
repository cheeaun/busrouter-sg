const fs = require('fs');
const { encode } = require('@mapbox/polyline');
const simplify = require('@turf/simplify');

const services = JSON.parse(fs.readFileSync('data/3/services.json'));

const routesData = {};

const readFile = (path) => {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (e) {
    return false;
  }
};

const encodeRoute = (lngLatCoords) => {
  // GeoJSON -> lng, lat
  // Polyline algo -> lat, lng
  const xyCoords = lngLatCoords.map(coord => ({x: coord[0], y: coord[1]}));
  const simplifiedCoords = simplify({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: lngLatCoords,
    },
  }, {
    tolerance: .00005,
    highQuality: true,
    mutate: true,
  });
  const latLngCoords = simplifiedCoords.geometry.coordinates.map(coord => coord.reverse());
  return encode(latLngCoords);
};

services.forEach(({ no:service }) => {
  console.log('service', service);
  const routes =
    readFile(`data/3/routes/mytransportsg/${service}.json`) ||
    // readFile(`data/3/routes/towertransitsg/${service}.json`) ||
    readFile(`data/3/routes/onemapsg/${service}.json`) ||
    readFile(`data/3/routes/mapbox/${service}.json`);
  routesData[service] = routes.map(encodeRoute);
});

const filePath = 'data/3/routes.polyline.json';
fs.writeFileSync(filePath, JSON.stringify(routesData, null, '\t'));
console.log(`Generated ${filePath}`);