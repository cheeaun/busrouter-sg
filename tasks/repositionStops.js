const fs = require('fs');
const distance = require('@turf/distance').default;

const stops = JSON.parse(fs.readFileSync('data/3/stops.json'));
const stopsOneMap = JSON.parse(fs.readFileSync('data/3/stops.onemap.json'));
const stopsOSM = JSON.parse(fs.readFileSync('data/3/stops.osm.json'));

const allStops = Object.keys(stops);
const totalStops = allStops.length;

const stopNames2No = {};
allStops.forEach(s => stopNames2No[stops[s].name.toLowerCase()] = s);

const stopsOSMMapping = {};
const { elements } = stopsOSM;
elements.forEach(stop => {
  const { tags: { asset_ref: no, name = '' } } = stop;
  const stopNo = no || stopNames2No[name.trim().toLowerCase()];
  if (!stopNo) return;
  if (!stopsOSMMapping[stopNo]) stopsOSMMapping[stopNo] = [];
  stopsOSMMapping[stopNo].push(stop);
});

console.log('Showing duplicate stops from OSM data:');
for (no in stopsOSMMapping){
  const results = stopsOSMMapping[no];
  if (results.length > 1) console.log(`😅  ${no}: ${results.length} stops`);
}

let finalCount = 0;
const changedStops = [];

allStops.forEach(s => {
  const stop = stops[s];

  const stopFeature = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      properties: {},
      coordinates: [stop.lng, stop.lat],
    }
  };

  const OSMStops = stopsOSMMapping[s];
  let OSMdistances = [];
  if (OSMStops){
    OSMStops.forEach(OSMStop => {
      const dist = distance(stopFeature, {
        type: 'Feature',
        geometry: {
          type: 'Point',
          properties: {},
          coordinates: [OSMStop.lon, OSMStop.lat],
        }
      });
      OSMdistances.push({
        distance: dist*1000,
        coordinates: [OSMStop.lon, OSMStop.lat],
      });
    })
    OSMdistances.sort((a, b) => a.distance - b.distance);
  }

  const OneMapStop = stopsOneMap[s];
  let OneMapDistance = {};
  if (OneMapStop && OneMapStop[0]){
    const dist = distance(stopFeature, {
      type: 'Feature',
      geometry: {
        type: 'Point',
        properties: {},
        coordinates: [OneMapStop[0], OneMapStop[1]],
      }
    });
    OneMapDistance = {
      distance: dist*1000,
      coordinates: [OneMapStop[0], OneMapStop[1]],
    };
  }

  const shortestOSMDistance = OSMdistances[0] || { distance: Infinity };
  if (shortestOSMDistance.distance || OneMapDistance.distance){
    let shortestDistance;
    if (OneMapDistance.distance <= 0){
      shortestDistance = shortestOSMDistance;
    } else if (shortestOSMDistance.distance <= 0){
      shortestDistance = OneMapDistance;
    } else if (shortestOSMDistance.distance > OneMapDistance.distance){
      shortestDistance = OneMapDistance;
    } else if (OneMapDistance.distance > shortestOSMDistance.distance){
      shortestDistance = shortestOSMDistance;
    }
    if (!shortestDistance || !isFinite(shortestDistance.distance)) return;
    const maxDistance = 80*5; // 5-min walk distance, meters
    if (shortestDistance.distance >= 1 && shortestDistance.distance <= maxDistance){
      console.log(`${++finalCount}\) Reposition distance for stop ${s}: ${shortestDistance.distance.toFixed(3)} m`);
      stops[s].lng = shortestDistance.coordinates[0];
      stops[s].lat = shortestDistance.coordinates[1];
      changedStops.push(s);
    } else if (shortestDistance.distance > maxDistance){
      console.log(`😱  Stop ${s} is too far: ${shortestDistance.distance.toFixed(3)} m`);
    } else {
      // console.log(`Ignored: ${s} - ${shortestOSMDistance.distance} || ${OneMapDistance.distance}`);
    }
  }
});


// elements.forEach(stop => {
//   const { lat, lon: lng, tags: { asset_ref: no, name = '', location } } = stop;
//   const stopNo = no || stopNames2No[name.trim().toLowerCase()];
//   if (stopNo && stops[stopNo]){
//     stops[stopNo].lat = lat;
//     stops[stopNo].lng = lng;
//     if (name) stops[stopNo].name = name;
//     if (location) stops[stopNo].location = location;
//     changedStops.push(stopNo);
//   }
// });

console.log(`Total stop with changed coordinates: ${changedStops.length}/${totalStops}`);

// const unchangedStops = allStops.filter(s => !changedStops.includes(s));
// console.log(`Stop with unchanged coordinates (${unchangedStops.length}): ${unchangedStops.join(' ')}`);

const filePath = 'data/3/stops2.json';
fs.writeFileSync(filePath, JSON.stringify(stops, null, '\t'));
console.log(`Generated ${filePath}`);