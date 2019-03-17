require('dotenv').config();
const fs = require('fs');
const got = require('got');

let index = 0;
const stopServiceRoutes = {};

(async () => {
  do {
    console.log(`↗️  ${index}`);
    const { body } = await got('http://datamall2.mytransport.sg/ltaodataservice/BusRoutes', {
      json: true,
      headers: {
        AccountKey: process.env.ltaAccountKey,
      },
      query: {
        '$skip': index*500,
      },
    });
    value = body.value;
    value.forEach(v => {
      const {
        ServiceNo,
        BusStopCode,
        WD_FirstBus,
        WD_LastBus,
        SAT_FirstBus,
        SAT_LastBus,
        SUN_FirstBus,
        SUN_LastBus,
      } = v;

      if (!stopServiceRoutes[BusStopCode]) {
        stopServiceRoutes[BusStopCode] = {};
      }
      stopServiceRoutes[BusStopCode][ServiceNo] = {
        weekday: [WD_FirstBus, WD_LastBus],
        saturday: [SAT_FirstBus, SAT_LastBus],
        sunday: [SUN_FirstBus, SUN_LastBus],
      };
    });

    index++;
  } while (value.length > 0);

  console.log(`Total stops: ${Object.keys(stopServiceRoutes).length}`);

  const filePath = 'data/3/routes.lta.json';
  fs.writeFileSync(filePath, JSON.stringify(stopServiceRoutes, null, '\t'));
  console.log(`Generated ${filePath}`);
})();

