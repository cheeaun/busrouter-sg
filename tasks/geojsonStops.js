const fs = require('fs');

const stops = JSON.parse(fs.readFileSync('data/3/stops2.json'));
const serviceStops = JSON.parse(fs.readFileSync('data/3/serviceStops.json'));

const stopServices = {};

for (service in serviceStops) {
  const routes = serviceStops[service];
  console.log(service, routes);
  const stops = [...new Set([...routes[0], ...(routes[1] || [])])]; // Flatten and dedupe
  stops.forEach((s) => {
    if (!stopServices[s]) return (stopServices[s] = [service]);
    if (stopServices[s].includes(s)) return;
    stopServices[s].push(service);
  });
}

const features = [];

for (number in stops) {
  const { lat, lng, ...props } = stops[number];
  features.push({
    type: 'Feature',
    id: number,
    properties: {
      number,
      services: stopServices[number],
      ...props,
    },
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
  });
}

const filePath = 'data/3/stops.geojson';
fs.writeFileSync(
  filePath,
  JSON.stringify(
    {
      type: 'FeatureCollection',
      features,
    },
    null,
    '\t',
  ),
);
console.log(`Generated ${filePath}`);
