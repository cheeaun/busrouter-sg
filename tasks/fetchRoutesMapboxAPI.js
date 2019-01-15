const fs = require('fs');
const got = require('got');
const args = process.argv.splice(process.execArgv.length + 2);

const stops = JSON.parse(fs.readFileSync('data/3/stops2.json'));
const serviceStops = JSON.parse(fs.readFileSync('data/3/serviceStops.json'));

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const TOKEN = 'pk.eyJ1IjoiY2hlZWF1biIsImEiOiIwMTkyNjRiOWUzOTMyZThkYTE3YjMyMWFiZGU2OTZlNiJ9.XsOEKtyctGiNGNsmVhetYg';

const fetchRoute = async (coords) => {
  let res;
  try {
    if (coords.length == 2){
      res = await got('https://api.mapbox.com/directions/v5/mapbox/driving/' + coords.join(';'), {
        json: true,
        query: {
          access_token: TOKEN,
          geometries: 'geojson',
          overview: 'full',
        },
      });
      const { body } = res;
      return body.routes[0].geometry.coordinates;
    }

    res = await got('https://api.mapbox.com/matching/v5/mapbox/driving/' + coords.join(';'), {
      json: true,
      query: {
        access_token: TOKEN,
        geometries: 'geojson',
        overview: 'full',
        // radiuses: coords.map(_ => 10).join(';'),
        approaches: coords.map(_ => 'curb').join(';'),
      },
    });
    const { body } = res;
    return body.matchings[0].geometry.coordinates;
  } catch (e){
    console.error(e, res.req.path);
    throw e;
  }
};

const genRoute = async (busNo, stopNumbers) => {
  let body;
  let coords = stopNumbers.map(n => [stops[n].lng, stops[n].lat]);
  const returnTrip = stopNumbers[0] == stopNumbers[stopNumbers.length-1];
  console.log(`🚌  ${busNo} = ${stopNumbers.length} stops  ${returnTrip ? '↩️' : '🔄'}`);
  if (coords.length > 100 || returnTrip){
    // Assuming coords will never be > 200
    // Else will have to slice multiple max-100-item array chunks then loop etc
    const half = Math.ceil(coords.length/2);
    const coords1 = coords.slice(0, half);
    const coords2 = coords.slice(half - 1);
    const coordinates1 = await fetchRoute(coords1);
    await delay(1000); // wait 1 sec
    const coordinates2 = await fetchRoute(coords2);
    fs.writeFileSync('test1.json', JSON.stringify(coordinates1));
    fs.writeFileSync('test2.json', JSON.stringify(coordinates2));
    return [...coordinates1, ...coordinates2]; // merge
  } else {
    return await fetchRoute(coords);
  }
};

(async() => {

let runCount = 1;
for (let service in serviceStops){
  if (
    fs.existsSync(`data/3/routes/mytransportsg/${service}.json`) ||
    // fs.existsSync(`data/3/routes/towertransitsg/${service}.json`) ||
    fs.existsSync(`data/3/routes/onemapsg/${service}.json`) ||
    (args[0] !== '--override' && fs.existsSync(`data/3/routes/mapbox/${service}.json`))){
    continue;
  }

  console.log(`${runCount++})  🚌  ${service}`);
  const routes = serviceStops[service];
  const serviceRoutes = [];

  for (let i=0, l=routes.length; i<l; i++){
    const route = routes[i];
    let routeLine;
    try {
      routeLine = await genRoute(service, route);
    } catch (e) {
      console.error(e);
      throw e;
    }
    serviceRoutes.push(routeLine);
    await delay(1000); // wait 1 sec, max 60 req/min
  }

  const filePath = `data/3/routes/mapbox/${service}.json`;
  fs.writeFileSync(filePath, JSON.stringify(serviceRoutes, null, '\t'));
  console.log(`Generated ${filePath}`);
}

})();