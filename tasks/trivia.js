const fs = require('fs');
const cheapRuler = require('cheap-ruler');

const trivias = [];

const stops = JSON.parse(fs.readFileSync('data/3/stops2.json'));
const serviceStops = JSON.parse(fs.readFileSync('data/3/serviceStops.json'));
const services = JSON.parse(fs.readFileSync('data/3/services.json'));

// --------------------

const stopsKeys = Object.keys(stops);
trivias.push(`There are ${stopsKeys.length.toLocaleString()} bus stops in Singapore.`);

// --------------------

trivias.push(`There are ${services.length} bus services in Singapore.`);

// --------------------

let lastCount = 0;
let serviceWithMostStops;
Object.keys(serviceStops).forEach(service => {
  const count = new Set(serviceStops[service].flat()).size;
  if (count > lastCount){
    lastCount = count;
    serviceWithMostStops = service;
  }
});
trivias.push(`Bus service with most number of stops is ${serviceWithMostStops}. It passes through ${lastCount} stops.`);

// --------------------

const stopsData = new Map();
Object.keys(serviceStops).forEach(service => {
  const stops = new Set(serviceStops[service].flat());
  stops.forEach(s => {
    if (!stopsData.has(s)) stopsData.set(s, new Set());
    stopsData.get(s).add(service);
  });
});

lastCount = 0;
let stopWithMostServices;
stopsData.forEach((v, k) => {
  const count = v.size;
  if (count > lastCount){
    lastCount = count;
    stopWithMostServices = k;
  }
});
trivias.push(`Bus stop with most number of services is ${stopWithMostServices} (${stops[stopWithMostServices].name}). It serves ${lastCount} bus services.`);

// --------------------

const ruler = cheapRuler(1.3);
let lastLongest = 0;
let lastShortest = Infinity;
let serviceWithLongestRoute;
let serviceWithShortestRoute;
Object.keys(serviceStops).forEach(service => {
  serviceStops[service].forEach(route => {
    const coords = route.map(r => [stops[r].lng, stops[r].lat]);
    const length = ruler.lineDistance(coords);
    if (length > lastLongest){
      lastLongest = length;
      serviceWithLongestRoute = service;
    }
    if (length < lastShortest){
      lastShortest = length;
      serviceWithShortestRoute = service;
    }
  });
});
trivias.push(`Bus service with the longest route is ${serviceWithLongestRoute}, at a distance of approximately ${Math.ceil(lastLongest)} kilometers.`);
trivias.push(`Bus service with the shortest route is ${serviceWithShortestRoute}, at a distance of approximately ${lastShortest.toFixed(1)} kilometers.`);

// --------------------

console.log(trivias);