const fs = require('fs');
const got = require('got');
const cheerio = require('cheerio');

const services = JSON.parse(fs.readFileSync('data/3/services.json'));

const serviceStops = {};
const stops = {};

(async() => {

for (let i=0, l=services.length; i<l; i++){
  const service = services[i];

  const url = `https://www.mytransport.sg/content/mytransport/ajax_lib/map_ajaxlib.getBusRouteByServiceId.${service.no}.html`;
  console.log(`↗️  ${url}`)
  const { body } = await got(url);
  const $ = cheerio.load(body);

  const routeStops = [];

  $('.bus_stop_code').each((j, element) => {
    const el = $(element);
    const nameEl = el.next();
    if (!nameEl.hasClass('bus_stop_name')) return;
    const onclick = el.attr('onclick');
    if (!onclick) return;
    let [lng, lat, seq, code, dir] = (onclick.match(/\(([^()]+)\)/i) || [,''])[1].split(',').map(s => s.trim());
    lng = parseFloat(lng, 10);
    lat = parseFloat(lat, 10);
    if (parseInt(lng, 10) == 0 && parseInt(lat, 10) == 0) return;
    seq = parseInt(seq, 10); // Starts from 1
    dir = dir-1; // 1 starts from 0
    const name = nameEl.text().trim();
    if (!routeStops[dir]) routeStops[dir] = [];
    routeStops[dir][seq-1] = code;
    stops[code] = {
      lat,
      lng,
      name
    };
  });

  serviceStops[service.no] = routeStops.map(rs => rs.filter(Boolean));
}

let filePath = 'data/3/serviceStops.json';
fs.writeFileSync(filePath, JSON.stringify(serviceStops, null, '\t'));
console.log(`Generated ${filePath}`);

filePath = 'data/3/stops.json';
fs.writeFileSync(filePath, JSON.stringify(stops, null, '\t'));
console.log(`Generated ${filePath}`);

})();
