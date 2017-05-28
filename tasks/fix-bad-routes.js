const fs = require('fs');
const needle = require('needle');
const _ = require('lodash');
const async = require('async');

const data = JSON.parse(fs.readFileSync('data/2/bad-routes.json', { encoding: 'utf8' }));
var routesList = [];

_.forEach(data, function(routes, service){
	_.forEach(routes, function(lineCount, route){
		routesList.push({
			service: service,
			route: route
		});
	});
});

var newRoutes = routesList.map(function(r){
	var service = r.service;
	var route = r.route;

	const unmodifiedRoutes = [];

	return function(done){
		const url = 'http://www.streetdirectory.com/asia_travel/mappage/ajax_new/get_bus_service_route.php?no=' + service.toLowerCase() + '&d=' + route + '&longlat=1';
		console.log('➡️ ', url);
		needle.get(url, function(err, res, body){
			if (err) throw err;
			if (!body){
				unmodifiedRoutes.push(service);
				return;
			}
			var line = body[route];
			var coords = [];

			var points = line.split(',');
			for (var i=0, l=points.length; i<l; i+=2){
				var lng = points[i];
				var lat = points[i+1];
				coords.push(lat + ',' + lng);
			}

			var serviceFile = 'data/2/bus-services/' + service + '.json';
			var serviceData = JSON.parse(fs.readFileSync(serviceFile, { encoding: 'utf8' }));
			serviceData[route].route = coords;
			fs.writeFileSync(serviceFile, JSON.stringify(serviceData));
			console.log('File "' + serviceFile + '" modified with route ' + route + ' data.');

			done();
		});
	};
});

async.series(newRoutes, () => {
	console.log('DONE');
	console.log('These routes are NOT fixed: ' + unmodifiedRoutes.join(', '));
});
