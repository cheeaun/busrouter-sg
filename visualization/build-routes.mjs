import fs from 'fs';
import simplify from '@turf/simplify';
import CheapRuler from 'cheap-ruler';
const ruler = new CheapRuler(1.3);

const stopsResponse = await fetch('https://data.busrouter.sg/v1/stops.min.json');
const stopsMin = await stopsResponse.json();
const stops = {};
Object.entries(stopsMin).forEach(([number, data]) => {
  stops[number] = {
    lng: data[0],
    lat: data[1],
    name: data[2],
  };
});
const stopsArr = Object.keys(stops).map((s) => ({
  no: s,
  ...stops[s],
}));
const routesResponse = await fetch('https://data.busrouter.sg/v1/routes.min.geojson');
const routesGeoJSON = await routesResponse.json();
const { features: routes } = routesGeoJSON;
const serviceStopsResponse = await fetch('https://data.busrouter.sg/v1/services.min.json');
const serviceStops = await serviceStopsResponse.json();

// Sort routes by length - shortest to furthest
const sortedRoutes = routes.sort(
  (a, b) =>
    ruler.lineDistance(a.geometry.coordinates) -
    ruler.lineDistance(b.geometry.coordinates),
);

// Services, sorted by route length
const sortedServices = sortedRoutes
  .map((r) => r.properties.number)
  .filter((el, pos, arr) => {
    return arr.indexOf(el) == pos;
  });
let mostHighestLevel = 0;
const newRoutes = [];

sortedServices.forEach((service) => {
  const _stops = serviceStops[service].routes;
  const allStops = [...new Set([..._stops[0], ...(_stops[1] || [])])];
  // const highestLevel = allStops.reduce((acc, s) => Math.max(stops[s].level || 0, acc), 0);
  // const level = highestLevel + 1;
  let level = null;
  for (let l = 1; !level; l++) {
    const hasLevel = allStops.some((s) =>
      stops[s].occupiedLevels ? stops[s].occupiedLevels.has(l) : false,
    );
    if (!hasLevel) level = l;
  }
  allStops.forEach((s) => {
    // stops[s].level = level;
    if (stops[s].occupiedLevels) {
      stops[s].occupiedLevels.add(level);
    } else {
      stops[s].occupiedLevels = new Set([level]);
    }
  });
  const serviceRoutes = routes.filter((r) => r.properties.number === service);
  serviceRoutes.forEach((serviceRoute) => {
    const simplifiedServiceRoute = simplify(serviceRoute, {
      tolerance: 0.0005,
      highQuality: true,
      mutate: true,
    });
    newRoutes.push({
      level,
      number: serviceRoute.properties.number,
      path: simplifiedServiceRoute.geometry.coordinates.map((c) =>
        c.concat((level - 1) * 100),
      ),
    });
  });
  console.log(`${service} - level ${level}`);
  if (level > mostHighestLevel) mostHighestLevel = level;
});

console.log(`Highest level: ${mostHighestLevel}`);

const routesFile = 'visualization/data/routes.json';
fs.writeFileSync(routesFile, JSON.stringify(newRoutes, null, ' '));
console.log(`File generated: ${routesFile}`);

const stopLevels = {};
stopsArr.map((s) => {
  const { occupiedLevels } = stops[s.no];
  const highestLevel = Math.max(...occupiedLevels);
  stopLevels[s.no] = highestLevel;
});

const levelsFile = 'visualization/data/levels.json';
fs.writeFileSync(levelsFile, JSON.stringify(stopLevels, null, ' '));
console.log(`File generated: ${levelsFile}`);
