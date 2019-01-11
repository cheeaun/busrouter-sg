const fs = require('fs');

const routes = JSON.parse(fs.readFileSync('data/3/routes.lta.json'));
const services = JSON.parse(fs.readFileSync('data/3/services.json'));
const stops = JSON.parse(fs.readFileSync('data/3/stops3.json'));

const servicesList = services.map(s => s.no);
const stopsList = Object.keys(stops);

const firstLastData = {};

for (let stop in routes) {
  // Exclude stops that are not in list
  if (!stopsList.includes(stop)) continue;

  const services = routes[stop];
  if (!firstLastData[stop]) firstLastData[stop] = [];
  for (let service in services) {
    // Exclude services that are not in list
    if (!servicesList.includes(service)) continue;

    const { weekday, saturday, sunday } = services[service];
    const times = [
      ...weekday,
      ...saturday,
      ...sunday,
    ];

    const timesStr = times.map(t => /\d+/.test(t) ? t : '-').join(' ');
    firstLastData[stop].push(`${service} ${timesStr}`);
  }
}

const filePath = `data/3/firstlast.final.json`;
fs.writeFileSync(filePath, JSON.stringify(firstLastData, null, '\t'));
console.log(`Generated ${filePath}`);

/*
const groups = {};
Object.keys(firstLastData).forEach(stop => {
  const segment = stop.slice(0, 2);
  if (!groups[segment]) groups[segment] = {};
  groups[segment][stop] = firstLastData[stop];
});

Object.keys(groups).forEach(segment => {
  const filePath = `data/3/first-last/${segment}.final.json`;
  fs.writeFileSync(filePath, JSON.stringify(groups[segment], null, '\t'));
  console.log(`Generated ${filePath}`);
});
*/