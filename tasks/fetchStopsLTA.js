require('dotenv').config();
const fs = require('fs');
const got = require('got');

(async () => {
  const stops = {};
  let index = 0;
  let value;
  do {
    console.log(`↗️  ${index}`);
    const { body } = await got(
      'http://datamall2.mytransport.sg/ltaodataservice/BusStops',
      {
        responseType: 'json',
        headers: {
          AccountKey: process.env.ltaAccountKey,
        },
        searchParams: {
          $skip: index * 500,
        },
      },
    );
    value = body.value;
    value.forEach((v) => {
      const { BusStopCode } = v;
      stops[BusStopCode] = v;
    });

    console.log(`Fetch count: ${value.length}`);
    index++;
  } while (value.length > 0);

  console.log(`Total stops: ${Object.keys(stops).length}`);

  const filePath = 'data/3/stops.lta.json';
  fs.writeFileSync(filePath, JSON.stringify(stops, null, '\t'));
  console.log(`Generated ${filePath}`);
})();
