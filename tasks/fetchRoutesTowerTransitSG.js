const fs = require('fs');
const got = require('got');

const stops = JSON.parse(fs.readFileSync('data/3/stops2.json'));
const serviceStops = JSON.parse(fs.readFileSync('data/3/serviceStops.json'));

(async() => {

const { body } = await got('https://towertransit.sg/our-routes/');
const services = [];
let matches;
const re = /[^."<>/]\.pdf"\s+target="_blank">([^<>\s]+)<\/a>/ig;
while ((matches = re.exec(body)) !== null){
  if (matches[1]) services.push(matches[1]);
}

let runCount = 1;
for (let i=0, l=services.length; i<l; i++){
  const service = services[i];
  try {
    try {
      fs.accessSync(`data/3/routes/mytransportsg/${service}.json`);
    } catch (e){
      fs.accessSync(`data/3/routes/towertransitsg/${service}.json`);
    }
  } catch (e) {
    console.log(`${runCount++})  🚌  ${service}`);
    const routes = serviceStops[service];
    if (!routes) continue;
    const serviceRoutes = [];

    for (let i=0, l=routes.length; i<l; i++){
      const route = routes[i];
      let routeLine;
      try {
        const url = `https://towertransit.sg/wp-content/themes/tower-transit/assets/data/bus-services/${service}.json`;
        console.log(`↗️  ${url}`);
        const { body } = await got(url, { json: true });
        routeLine = body[1].route.map(coords => coords.split(',').map(Number));
        serviceRoutes.push(routeLine);
      } catch (e) {
        console.error(e);
        if (e.statusCode != 404){
          throw e;
        }
      }
    }

    if (serviceRoutes.length == routes.length){
      const filePath = `data/3/routes/towertransitsg/${service}.json`;
      fs.writeFileSync(filePath, JSON.stringify(serviceRoutes, null, '\t'));
      console.log(`Generated ${filePath}`);
    }
  }
}

})();