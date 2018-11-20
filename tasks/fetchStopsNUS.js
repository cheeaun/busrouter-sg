const fs = require("fs");
const got = require("got");

(async () => {
  const { body } = await got(
    "http://nextbus.comfortdelgro.com.sg/testMethod.asmx/GetBusStops?output=json"
  );
  const parsedBody = JSON.parse(body.replace(/<[^>]*>/g, ""));
  const stops = parsedBody.BusStopsResult.busstops.reduce((acc, busStop) => {
    return {
      ...acc,
      [busStop.name]: {
        BusStopCode: busStop.name,
        RoadName: busStop.caption,
        Description: busStop.caption,
        Latitude: busStop.latitude,
        Longitude: busStop.longitude
      }
    };
  }, {});

  console.log(`Total stops: ${Object.keys(stops).length}`);

  const filePath = "data/3/stops.nus.json";
  fs.writeFileSync(filePath, JSON.stringify(stops, null, "\t"));
  console.log(`Generated ${filePath}`);
})();
