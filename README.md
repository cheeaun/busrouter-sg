Singapore Bus Routes Explorer
=============================

[![Available in the Chrome Web Store](https://developer.chrome.com/webstore/images/ChromeWebStore_BadgeWBorder_v2_206x58.png)](https://chrome.google.com/webstore/detail/singapore-bus-routes-expl/kmoebclbglclobmahimdaniikogclifn) [![Get it in the Firefox Marketplace](https://marketplace.cdn.mozilla.net/media/img/mkt/badges/firefox-marketplace_badge-orange_172_60.png)](https://marketplace.firefox.com/app/singapore-bus-routes-explor/)

Abbreviated as **SBRE**. I know, the name sucks. This app basically shows all routes on the map for all bus services in Singapore, inspired by [this tweet](https://twitter.com/mengwong/status/155511398653362177).

Also available as [an iPad app](https://itunes.apple.com/us/app/sgbusrouter/id650227641?ls=1&mt=8), created by [Eddy Yanto](http://eddyyanto.com/).

Technical stuff
---

All data such as routes, bus stops and services are *taken* from <http://mytransport.sg/>, which means they are copyrighted by the [Land Transport Authority](http://www.lta.gov.sg/).

Here's how to get the data, assuming that you have `node`, [grunt](http://gruntjs.com/) and checked out this repo:

	npm install
	grunt fetchBusServices
	grunt fetchBusStopsRoutes
	grunt fixBadRoutes
	grunt mapServicesStops
	grunt populateServicesName

The data you'll get are:

- [`bus-services.json`](http://cheeaun.github.com/busrouter-sg/data/2/bus-services.json) - Lists all bus services with the bus numbers, `routes` (number of routes where 2 means two routes, usually in opposite direction) and the bus operator.
- [`bus-stops.json`](http://cheeaun.github.com/busrouter-sg/data/2/bus-stops.json) - Lists all bus stops with coordinates and names.
- [`bus-stops-services.json`](http://cheeaun.github.com/busrouter-sg/data/2/bus-stops-services.json) - List all bus stops with the bus numbers/services that stops there.
- `bus-services/{number}.json` - List two routes with all (polyline) coordinates and bus stops for each route. If the bus service doesn't have a second route, the second route data will be empty. E.g. <http://cheeaun.github.com/busrouter-sg/data/2/bus-services/2.json>.

Few more `grunt` goodies:

- `grunt connect` - starts a local server
- `grunt uglify` - concat/minify the JS files
- `grunt s3` - uploads data to a S3 bucket

The icon is from [The Noun Project](http://thenounproject.com/noun/bus/#icon-No97). The map is powered by [Google Maps JavaScript API](http://code.google.com/apis/maps/documentation/javascript/). The color scheme and markers are *inspired* by [Gothere.sg](http://gothere.sg/). Tested to work great on **modern** web browsers.

If you have any feedback, tweet me at [@cheeaun](http://twitter.com/cheeaun).
