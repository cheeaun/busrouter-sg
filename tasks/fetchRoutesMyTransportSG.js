const fs = require('fs');
const got = require('got');
const args = process.argv.splice(process.execArgv.length + 2);

const serviceStops = JSON.parse(fs.readFileSync('data/3/serviceStops.json'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let runCount = 1;
  for (let service in serviceStops) {
    try {
      if (args[0] === '--override') throw 'OverrideException';
      fs.accessSync(`data/3/routes/mytransportsg/${service}.json`);
    } catch (e) {
      console.log(`${runCount++})  🚌  ${service}`);
      const routes = serviceStops[service];
      const serviceRoutes = [];

      for (let i = 0, l = routes.length; i < l; i++) {
        const route = routes[i];
        let routeLine;
        try {
          const url = `https://www.mytransport.sg/kml/busroutes/${service.toUpperCase()}-${
            i + 1
          }.kml`;
          console.log(`↗️  ${url}`);
          const { body } = await got(url);
          const coordsStrings = body.match(
            /<coordinates>[^<>]+<\/coordinates>/gi,
          );
          if (coordsStrings.length > 1) {
            console.error(`There's more than one line for service ${service}.`);
          } else {
            routeLine = coordsStrings[0]
              .replace(/^<coordinates>/, '')
              .replace(/<\/coordinates>$/, '')
              .trim()
              .split(/\s+/)
              .map((lnglat) => lnglat.split(',').map(Number));
            if (routeLine) serviceRoutes.push(routeLine);
          }
        } catch (e) {
          console.error(e);
          if (e.statusCode != 404) {
            throw e;
          }
        }
      }

      if (serviceRoutes.length == routes.length) {
        const filePath = `data/3/routes/mytransportsg/${service}.json`;
        fs.writeFileSync(filePath, JSON.stringify(serviceRoutes, null, '\t'));
        console.log(`Generated ${filePath}`);
      }

      await delay(1000);
    }
  }
})();
