const fs = require('fs');
const KDBush = require('kdbush');
const geokdbush = require('geokdbush');
const CheapRuler = require('cheap-ruler');
const ruler = new CheapRuler(1.3);

const stops = JSON.parse(fs.readFileSync('data/3/stops2.json'));
const stopsArr = Object.keys(stops).map((no) => ({ no, ...stops[no] }));

const index = new KDBush(
  stopsArr,
  (p) => p.lng,
  (p) => p.lat,
);

const maxDistance = 100; // meters
const bearingSnap = 7; // degrees, follows Mapbox's bearingSnap
const processedStops = [];

const stopPairs = stopsArr
  .map((stop) => {
    const nearest = geokdbush.around(
      index,
      stop.lng,
      stop.lat,
      1,
      maxDistance / 1000,
      (s) => s.no !== stop.no,
    );
    if (nearest && nearest.length) {
      const stop2 = nearest[0];
      const distance = ruler.distance(
        [stop.lng, stop.lat],
        [stop2.lng, stop2.lat],
      );
      const bearing = ruler.bearing(
        [stop.lng, stop.lat],
        [stop2.lng, stop2.lat],
      );
      return [stop.no, stop2.no, distance, bearing];
    }
  })
  .filter(Boolean) // Remove empty pairs
  .sort((a, b) => a[2] - b[2]) // Sort by shortest distance
  .filter((pair) => {
    const [stop, stop2, distance, bearing] = pair;
    // Remove pairs that are already taken by other "shorter" pairs
    if (processedStops.includes(stop) || processedStops.includes(stop2))
      return false;
    // Remove pairs with too little bearing difference
    if (
      (bearing < bearingSnap && bearing > -bearingSnap) ||
      bearing > 180 - bearingSnap ||
      bearing < bearingSnap - 180
    )
      return false;
    processedStops.push(stop, stop2);
    return true;
  })
  .map((p) => {
    const [stop, stop2, distance, bearing] = p;
    const isLeft = bearing > 0;
    if (isLeft) {
      stops[stop].left = true;
    } else {
      stops[stop2].left = true;
    }
    return p;
  });

stopPairs.forEach((p, i) => console.log(i, ...p));

const filePath = 'data/3/stops3.json';
fs.writeFileSync(filePath, JSON.stringify(stops, null, '\t'));
console.log(`Generated ${filePath}`);
