const fs = require('fs');
const length = require('@turf/length').default;

const stops = JSON.parse(fs.readFileSync('data/3/stops2.json'));
const serviceStops = JSON.parse(fs.readFileSync('data/3/serviceStops.json'));

let count = 0;

const coordsLen = (coords) => length({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: coords,
  },
});

const readFile = (path) => {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (e) {
    return false;
  }
};

for (service in serviceStops){
  const routes = serviceStops[service];
  const routesCoords =
    readFile(`data/3/routes/mytransportsg/${service}.json`) ||
    // readFile(`data/3/routes/towertransitsg/${service}.json`) ||
    readFile(`data/3/routes/onemapsg/${service}.json`) ||
    readFile(`data/3/routes/mapbox/${service}.json`);

  routes.forEach((route, i) => {
    const stopCoords = route.map(r => {
      const { lat, lng } = stops[r];
      return [lng, lat];
    });
    const stopsLen = coordsLen(stopCoords);
    const routeCoords = routesCoords[i];
    if (!routeCoords) console.log(service, i, routesCoords);
    const routeLen = coordsLen(routeCoords);

    if (routeLen <= stopsLen){
      console.log(`${++count}\) ${service} route ${i+1} is too short. ${routeLen.toFixed(3)} km <= ${stopsLen.toFixed(3)} km (-${(stopsLen-routeLen).toFixed(3)} km)`);

      let longestLen = 0;
      for (let i=0, l=stopCoords.length; i<l-1; i++){
        const len = coordsLen([stopCoords[i], stopCoords[i+1]]);
        if (len > longestLen) longestLen = len;
      }

      console.log(`    Longest between-stop distance: ${longestLen.toFixed(1)} km`);
    } else {
      let longestLen = 0;
      for (let i=0, l=routeCoords.length; i<l-1; i++){
        const len = coordsLen([routeCoords[i], routeCoords[i+1]]);
        if (len > longestLen) longestLen = len;
      }

      if (longestLen > 2){
        console.log(`${++count}\) ${service} route ${i+1} has too long straight line: ${longestLen.toFixed(1)} km`);
      }
    }
  });
}