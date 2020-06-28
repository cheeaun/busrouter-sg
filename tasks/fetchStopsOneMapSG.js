const fs = require('fs');
const got = require('got');

const stops = JSON.parse(fs.readFileSync('data/3/stops.json'));
const numbers = Object.keys(stops);

const chunkArr = (arr, size) => {
  const sets = [];
  const chunks = arr.length / size;
  for (var i = 0, j = 0; i < chunks; i++, j += size) {
    sets[i] = arr.slice(j, j + size);
  }
  return sets;
};

console.log(`Number of stops: ${numbers.length}`);

const stopSets = chunkArr(numbers, 200);
const stopsData = {};

(async () => {
  const token = (
    await got('https://developers.onemap.sg/publicapi/publicsessionid', {
      responseType: 'json',
    })
  ).body.access_token;

  for (let i = 0, l = stopSets.length; i < l; i++) {
    let res;
    const stopNumbers = stopSets[i].join(',');
    try {
      console.log(`↗️  ${stopNumbers}`);
      res = await got(
        'https://developers.onemap.sg/publicapi/busexp/getbusStopsInfo',
        {
          responseType: 'json',
          searchParams: {
            busStopNo: stopNumbers,
            token,
          },
        },
      );
    } catch (e) {
      console.error(e);
    }

    if (res.body.error) {
      console.error(res.body.error);
      console.log('Token', token);
      return;
    }

    res.body.BusStopInfo.forEach((s) => {
      stopsData[s.bus_stop] = [s.longitude, s.latitude];
    });
  }

  const filePath = 'data/3/stops.onemap.json';
  fs.writeFileSync(filePath, JSON.stringify(stopsData, null, '\t'));
  console.log(`Generated ${filePath}`);
})();
