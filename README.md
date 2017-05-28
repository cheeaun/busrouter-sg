[BusRouter SG](https://busrouter.sg/)
===

[![Screenshot of Singapore Bus Routes Explorer](screenshots/screenshot-1.png)](https://busrouter.sg/)

Previously known as Singapore Bus Routes Explorer, abbreviated as 'SBRE'. I know, the name sucks. This app basically shows all routes on the map for all bus services in Singapore, inspired by [this tweet](https://twitter.com/mengwong/status/155511398653362177).

Also available as [an iPad app](https://itunes.apple.com/us/app/sgbusrouter/id650227641?ls=1&mt=8), created by [Eddy Yanto](http://eddyyanto.com/).

Complete Feature Set
---

- Show **full route** with all bus stops for every bus service.
- Show **all** bus stops when zoomed in.
- Show all routes that **pass through** one bus stop.
- Show bus **arrival times** for a bus stop.

Technical stuff
---

All data such as routes, bus stops and services are *taken* from <http://mytransport.sg/>, which means they are copyrighted by the [Land Transport Authority](http://www.lta.gov.sg/).

Here's how to get the data, assuming that you have [`node`](https://nodejs.org/en/), [`yarn`](yarnpkg.com/), [`grunt`](http://gruntjs.com/) and checked out this repo:

```
yarn
yarn fetchBusServices
yarn fetchBusStopsRoutes
yarn fixBadRoutes
yarn mapServicesStops
yarn populateServicesName
yarn busStopsGeoJSONKML
```

The data you'll get are:

- [`bus-services.json`](https://busrouter.sg/data/2/bus-services.json) - Lists all bus services with the bus numbers, `routes` (number of routes where 2 means two routes, usually in opposite direction) and the bus operator.
- [`bus-stops.json`](https://busrouter.sg/data/2/bus-stops.json) - Lists all bus stops with coordinates and names.
	- `bus-stops.geojson` - GeoJSON format
	- `bus-stops.kml` - KML format
- [`bus-stops-services.json`](https://busrouter.sg/data/2/bus-stops-services.json) - List all bus stops with the bus numbers/services that stops there.
- `bus-services/{number}.json` - List two routes with all (polyline) coordinates and bus stops for each route. If the bus service doesn't have a second route, the second route data will be empty. E.g. <https://busrouter.sg/data/2/bus-services/2.json>.

Few more `grunt` goodies:

- `grunt connect` - starts a local server
- `grunt uglify` - concat/minify the JS files
- `grunt svg_sprite` - generate the SVG sprite
- `grunt inline` - inline the JS and CSS files into the HTML
- `grunt s3` - uploads data to a S3 bucket
- `grunt stats` - get the stats for total number of bus stops and services

The icon is from [The Noun Project](http://thenounproject.com/noun/bus/#icon-No97). The color scheme and markers are *inspired* by [Gothere.sg](http://gothere.sg/).

License
---

[Data provided by LTA](http://www.mytransport.sg/content/mytransport/home/dataMall/termOfUse.html) and partially by [StreetDirectory](http://www.streetdirectory.com/).

Everything else: [MIT](http://cheeaun.mit-license.org/)

Feedback
---

If you have any feedback, tweet me at [@cheeaun](http://twitter.com/cheeaun).
