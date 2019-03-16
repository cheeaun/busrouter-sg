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

(async() => {

for (let i=0, l=stopSets.length; i<l; i++){
  let res;
  const stopNumbers = stopSets[i].join(',');
  try {
    console.log(`↗️  ${stopNumbers}`);
    res = await got('https://developers.onemap.sg/publicapi/busexp/getbusStopsInfo', {
      json: true,
      query: {
        busStopNo: stopNumbers,
        token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjMsInVzZXJfaWQiOjMsImVtYWlsIjoicHVibGljQXBpUm9sZUBzbGEuZ292LnNnIiwiZm9yZXZlciI6ZmFsc2UsImlzcyI6Imh0dHA6XC9cL29tMi5kZmUub25lbWFwLnNnXC9hcGlcL3YyXC91c2VyXC9zZXNzaW9uIiwiaWF0IjoxNTUyNDUwNjE0LCJleHAiOjE1NTI4ODI2MTQsIm5iZiI6MTU1MjQ1MDYxNCwianRpIjoiN2IwMWJmY2NiMTYzMjQzNmU3ZDhhNTljNjJlMzYxOTEifQ.D6qyjmM-vI-j4wsIK6i6T8u8-4p3bnYt97zdvuRmtWU'
      },
    });
  } catch (e){
    console.error(e);
  }

  res.body.BusStopInfo.forEach(s => {
    stopsData[s.bus_stop] = [s.longitude, s.latitude];
  });
}

const filePath = 'data/3/stops.onemap.json';
fs.writeFileSync(filePath, JSON.stringify(stopsData, null, '\t'));
console.log(`Generated ${filePath}`);

})();