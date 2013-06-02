'use strict';

var needle = require('needle');

module.exports = function(grunt){

	grunt.registerTask('fixBadRoutes', 'Fix bad route lines', function(){
		var data = grunt.file.readJSON('data/2/bad-routes.json');
		var routesList = [];
		var _ = grunt.util._;

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

			return function(done){
				needle.get('http://www.streetdirectory.com/asia_travel/mappage/ajax_new/get_bus_service_route.php?no=' + service.toLowerCase() + '&d=' + route + '&longlat=1', function(err, res, body){
					var line = body[route];
					var coords = [];

					var points = line.split(',');
					for (var i=0, l=points.length; i<l; i+=2){
						var lng = points[i];
						var lat = points[i+1];
						coords.push(lat + ',' + lng);
					}

					var serviceFile = 'data/2/bus-services/' + service + '.json';
					var serviceData = grunt.file.readJSON(serviceFile);
					serviceData[route].route = coords;
					grunt.file.write(serviceFile, JSON.stringify(serviceData));
					grunt.log.writeln('File "' + serviceFile + '" modified with route ' + route + ' data.');

					done();
				});
			};
		});

		var finish = this.async();
		grunt.util.async.series(newRoutes, finish);
	});

};