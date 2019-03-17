const fs = require('fs');
const got = require('got');
const { decode } = require('@mapbox/polyline');
const args = process.argv.splice(process.execArgv.length + 2);

const serviceStops = JSON.parse(fs.readFileSync('data/3/serviceStops.json'));

(async() => {

let runCount = 1;
for (let service in serviceStops){
  if (
    fs.existsSync(`data/3/routes/mytransportsg/${service}.json`) ||
    // fs.existsSync(`data/3/routes/towertransitsg/${service}.json`) ||
    (args[0] !== '--override' && fs.existsSync(`data/3/routes/onemapsg/${service}.json`))){
    continue;
  }

  console.log(`${runCount++})  🚌  ${service}`);
  const routes = serviceStops[service];
  const serviceRoutes = [];

  for (let i=0, l=routes.length; i<l; i++){
    const route = routes[i];
    let routeLine;
    const direction = i+1;
    try {
      const url = 'https://developers.onemap.sg/publicapi/busexp/getOneBusRoute';
      console.log(`↗️  ${url}`);
      const { body } = await got(url, {
        json: true,
        query: {
          busNo: service,
          direction,
          token: process.env.oneMapToken,
        },
      });
      let routeLine = [];
      const sequences = body[`BUS_DIRECTION_${direction == 1 ? 'ONE' : 'TWO'}`];
      if (!sequences) continue;
      sequences.forEach(sequence => {
        routeLine = routeLine.concat(decode(sequence.GEOMETRIES).map(c => c.reverse()));
      });
      serviceRoutes.push(routeLine);
    } catch (e) {
      console.error(e);
      if (e.statusCode != 404){
        throw e;
      }
    }
  }

  if (serviceRoutes.length == routes.length){
    const filePath = `data/3/routes/onemapsg/${service}.json`;
    fs.writeFileSync(filePath, JSON.stringify(serviceRoutes, null, '\t'));
    console.log(`Generated ${filePath}`);
  }
}

})();