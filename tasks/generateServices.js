const fs = require('fs');
const toTitleCase = require('../utils/titleCase');

const serviceStops = JSON.parse(fs.readFileSync('data/3/serviceStops.json'));
const stops2 = JSON.parse(fs.readFileSync('data/3/stops2.json'));

const fullServiceStops = {};

for (let service in serviceStops){
  console.log(service);
  const routes = serviceStops[service];
  let name = '';
  if (routes.length == 1){
    const route = routes[0];
    const [firstStop, ...rest] = route;
    const lastStop = rest.pop();
    if (firstStop == lastStop){
      const midStop = rest[Math.floor((rest.length - 1) / 2)];
      name = `${toTitleCase(stops2[firstStop].name)} ⟲ ${toTitleCase(stops2[midStop].name)}`;
    } else {
      name = `${toTitleCase(stops2[firstStop].name)} → ${toTitleCase(stops2[lastStop].name)}`;
    }
  } else {
    // If A -> B, B -> A, becomes "A <-> B"
    // If A -> B, B -> C, becomes "A / C <-> B" (Special slash)
    const [route1, route2] = routes;
    const firstStops = route1[0] == route2[route2.length-1] ? [route1[0]] : [route1[0], route2[route2.length-1]];
    const lastStops = route2[0] == route1[route1.length-1] ? [route1[route1.length-1]] : [route1[route1.length-1], route2[0]];
    const firstStopsName = toTitleCase(firstStops.map(s => stops2[s].name).join(' / '));
    const lastStopsName = toTitleCase(lastStops.map(s => stops2[s].name).join(' / '));
    if (firstStopsName == lastStopsName){
      name = firstStopsName;
    } else {
      name = `${firstStopsName} ⇄ ${lastStopsName}`;
    }
  }
  fullServiceStops[service] = {
    name,
    routes,
  };
  // fullServiceStops[service] = routes.map(stops => {
  //   const [firstStop, ...restStops] = stops;
  //   const lastStop = stops.pop();
  //   const firstStopName = stops2[firstStop].name;
  //   const lastStopName = stops2[lastStop].name;
  //   const name = firstStopName.toLowerCase() == lastStopName.toLowerCase() ? firstStopName : `${toTitleCase(firstStopName)} ⇢ ${toTitleCase(lastStopName)}`;
  //   return {
  //     name,
  //     stops,
  //   };
  // });
}

const filePath = 'data/3/services.final.json';
fs.writeFileSync(filePath, JSON.stringify(fullServiceStops, null, '\t'));
console.log(`Generated ${filePath}`);