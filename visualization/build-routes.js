const fs = require('fs');
const buffer = require('@turf/buffer');
const simplify = require('@turf/simplify');
const length = require('@turf/length').default;

const stops = JSON.parse(fs.readFileSync('data/2/bus-stops.json'));
const stopsMap = {};
stops.forEach(s => stopsMap[s.no] = [s.lat, s.lng]);
const { services } = JSON.parse(fs.readFileSync('data/2/bus-services.json'));

const features = [];
const stopsSlot = {};
stops.forEach(s => stopsSlot[s.no] = []);

let highestLevel = 0;

const servicesNo = {};
services.forEach(s => {
  servicesNo[s.no] = JSON.parse(fs.readFileSync(`data/2/bus-services/${s.no}.json`));
});

services.sort((a, b) => {
  const coordinatesA = [];
  const serviceA = servicesNo[a.no];
  if (serviceA[1].stops.length && serviceA[1].route){
    coordinatesA.push(serviceA[1].route.map(r => r.split(',').reverse().map(Number)));
  }
  if (serviceA[2].stops.length && serviceA[2].route){
    coordinatesA.push(serviceA[2].route.map(r => r.split(',').reverse().map(Number)));
  }
  const featureA = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: coordinatesA,
    },
  };

  const coordinatesB = [];
  const serviceB = servicesNo[b.no];
  if (serviceB[1].stops.length && serviceB[1].route){
    coordinatesB.push(serviceB[1].route.map(r => r.split(',').reverse().map(Number)));
  }
  if (serviceB[2].stops.length && serviceB[2].route){
    coordinatesB.push(serviceB[2].route.map(r => r.split(',').reverse().map(Number)));
  }
  const featureB = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: coordinatesB,
    },
  };

  return length(featureA) - length(featureB);
});

services.forEach(s => {
  const coordinates = [];
  const service = servicesNo[s.no];
  if (service[1].stops.length && service[1].route && service[1].route.length){
    coordinates.push(service[1].route.map(r => r.split(',').reverse().map(Number)));
  }
  if (service[2].stops.length && service[2].route && service[2].route.length){
    coordinates.push(service[2].route.map(r => r.split(',').reverse().map(Number)));
  }

  if (!coordinates.length) return;

  const stops = [...new Set([...service[1].stops, ...service[2].stops])];
  let slotTaken;
  let level = 0;
  do {
    slotTaken = stops.some(s => stopsSlot[s][level]);
    if (slotTaken){
      level++;
    } else {
      stops.forEach(s => {
        stopsSlot[s][level] = 1;
      });
    }
  } while (slotTaken);

  if (level > highestLevel) highestLevel = level;

  console.log(`Service ${s.no} occupies level ${level}`);

  let feature = {
    type: 'Feature',
    id: s.no,
    properties: {
      service: s.no,
      name: s.name,
      operator: s.operator,
      level,
    },
    geometry: {
      type: 'MultiLineString',
      coordinates,
    },
  };
  feature = simplify(feature, {
    tolerance: .0005,
    highQuality: true,
    mutate: true,
  });

  feature = buffer(feature , .018, { steps: 1 });
  feature.id = s.no; // buffer() accidentally removes the `id`

  features.push(feature);
});

console.log(`Highest level is ${highestLevel}`);

const geojson = {
  type: 'FeatureCollection',
  features,
};

const geojsonFile = '3d/data/routes.geojson';
fs.writeFileSync(geojsonFile, JSON.stringify(geojson));
console.log(`File generated: ${geojsonFile}`);

const stopLevels = {};
for (k in stopsSlot){
  const arr = stopsSlot[k];
  stopLevels[k] = {
    level: arr.length,
    routesCount: arr.filter(Boolean).length-1,
  };
}

const levelsFile = '3d/data/levels.json';
fs.writeFileSync(levelsFile, JSON.stringify(stopLevels, null, ' '));
console.log(`File generated: ${levelsFile}`);
