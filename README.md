Singapore Bus Routes Explorer
=============================

[![Available in the Chrome Web Store](https://developers.google.com/chrome/web-store/images/branding/ChromeWebStore_BadgeWBorder_v2_496x150.png)](https://chrome.google.com/webstore/detail/kmoebclbglclobmahimdaniikogclifn)

Abbreviated as **SBRE**. I know, the name sucks. This app basically shows all routes on the map for all bus services in Singapore, inspired by [this tweet](https://twitter.com/mengwong/status/155511398653362177).

All data such as routes, bus stops and services are *taken* from <http://publictransport.sg/>, which means they are copyrighted by the [Land Transport Authority](http://www.lta.gov.sg/).

Here's how to get the data, assuming that you have `node` and checked out this repo:

	npm install async jquery request scraper
	cd data
	./get-bus-services.js
	./get-bus-services-providers.js
	./get-bus-routes-stops.js
	./get-bus-stops-services.js

The data you'll get are:

- [`bus-services.json`](http://cheeaun.github.com/busrouter-sg/data/bus-services.json) - Lists all bus services with the bus numbers, `dir` (number of routes where 2 means two routes, usually in opposite direction) and the bus operator.
- [`bus-stops.json`](http://cheeaun.github.com/busrouter-sg/data/bus-stops.json) - Lists all bus stops with coordinates and names.
- [`bus-stops-services.json`](http://cheeaun.github.com/busrouter-sg/data/bus-stops-services.json) - List all bus stops with the bus numbers/services that stops there.
- `bus-services/{number}.json` - List two routes with all (polyline) coordinates and bus stops for each route. If the bus service doesn't have a second route, the second route data will be empty. E.g. [http://cheeaun.github.com/busrouter-sg/data/bus-services/2.json]().

The icon is from [The Noun Project](http://thenounproject.com/noun/bus/#icon-No97). The map is powered by [Google Maps JavaScript API](http://code.google.com/apis/maps/documentation/javascript/). The color scheme and markers are *inspired* by [Gothere.sg](http://gothere.sg/). Tested to work great on **modern** web browsers.

If you have any feedback, tweet me at [@cheeaun](http://twitter.com/cheeaun).