Singapore Bus Routes Explorer
=============================

Abbreviated as **SBRE**. I know, the name sucks. This app basically shows all routes on the map for all bus services in Singapore, inspired by [this tweet](https://twitter.com/mengwong/status/155511398653362177).

All data such as routes, bus stops and services are *taken* from <http://publictransport.sg/>, which means they are copyrighted by the [Land Transport Authority](http://www.lta.gov.sg/).

Here's how to get the data, assuming that you have `node` and checked out this repo:

	npm install async jquery request scraper
	cd data
	./get-bus-services.js
	./get-bus-routes-stops.js

Then, load `index.html` in the browser. The map is powered by [Gothere Maps API](http://gothere.sg/api). Even the color scheme is inspired by Gothere. Tested to work great on latest Firefox and Chrome browsers.

If you have any feedback, tweet me at [@cheeaun](http://twitter.com/cheeaun).