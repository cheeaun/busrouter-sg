const fs = require('fs');
const _ = require('lodash');
const needle = require('needle');
const request = require('request');
const cheerio = require('cheerio');
const async = require('async');

var badlines = {}; // Store the bad route lines, report 'em
var nolines = []; // Store the services with NO routes (KML files)
var stops = {}; // Store ALL the bus stops

const data = JSON.parse(fs.readFileSync('data/2/bus-services.json'));
var services = data.services.map(function(s){
	var service = s.no;
	var routes = s.routes;
	return function(allDone){
		async.parallel([
			function(done){
				console.log('https://www.mytransport.sg/content/mytransport/ajax_lib/map_ajaxlib.getBusRouteByServiceId.' + service + '.html');
				needle.get('https://www.mytransport.sg/content/mytransport/ajax_lib/map_ajaxlib.getBusRouteByServiceId.' + service + '.html', function(err, res, body){
					var $ = cheerio.load(body);

					var routeStops = { 1: [], 2: [] };

					$('.bus_stop_code').each(function(){
						var el = $(this);
						var nameEl = el.next();
						if (!nameEl.hasClass('bus_stop_name')) return;
						var onclick = el.attr('onclick');
						if (!onclick) return;
						var args = (onclick.match(/\(([^()]+)\)/i) || [,''])[1].split(',');
						var lng = args[0].trim();
						var lat = args[1].trim();
						if (parseInt(lng, 10) == 0 && parseInt(lat, 10) == 0) return;
						var seq = parseInt(args[2].trim(), 10); // Starts from 1
						var code = args[3].trim();
						var direction = args[4].trim();
						var name = nameEl.text().trim();
						routeStops[direction][seq-1] = code;
						stops[code] = {
							lat: lat,
							lng: lng,
							name: name
						};
					});

					routeStops[1] = _.compact(routeStops[1]);
					routeStops[2] = _.compact(routeStops[2]);

					done(null, routeStops);
				});
			},
			function(done){
				console.log('https://www.mytransport.sg/kml/busroutes/' + service + '-1.kml');
				request('https://www.mytransport.sg/kml/busroutes/' + service + '-1.kml', function(err, res, body){
					if (err) throw err;
					if (res.statusCode != 200){
						// throw new Error('Status code: ' + res.statusCode);
						console.error('Status code for ' + service + '/1: ' + res.statusCode);
						nolines.push(service);
						done(); // EMPTY ROUTE?!!
						return;
					}

					var coords = [];
					var coordsStrings = body.match(/<coordinates>[^<>]+<\/coordinates>/g);
					if (coordsStrings.length > 1){
						// There are more than one lines for this route
						// Just give up
						coords = null;
						if (!badlines[service]) badlines[service] = {};
						badlines[service][1] = coordsStrings.length;
					} else {
						coords = coordsStrings[0].replace(/^<coordinates>/, '').replace(/<\/coordinates>$/, '').trim().split(/\s+/).map(function(lnglat){
							// It's lnglat, here we convert them to latlng
							var lnglat = lnglat.split(',');
							return lnglat[1] + ',' + lnglat[0];
						});
					}
					done(null, coords);
				});
			},
			function(done){
				if (routes != 2){
					done(null, []);
					return;
				}
				console.log('https://www.mytransport.sg/kml/busroutes/' + service + '-2.kml');
				request('https://www.mytransport.sg/kml/busroutes/' + service + '-2.kml', function(err, res, body){
					if (err) throw err;
					if (res.statusCode != 200){
						console.error('Status code for ' + service + '/2: ' + res.statusCode);
						done(); // Return empty
						return;
					}

					var coords = [];
					var coordsStrings = body.match(/<coordinates>[^<>]+<\/coordinates>/g);
					if (coordsStrings.length > 1){
						// There are more than one lines for this route
						// Just give up
						coords = null;
						if (!badlines[service]) badlines[service] = {};
						badlines[service][2] = coordsStrings.length;
					} else {
						coords = coordsStrings[0].replace(/^<coordinates>/, '').replace(/<\/coordinates>$/, '').trim().split(/\s+/).map(function(lnglat){
							// It's lnglat, here we convert them to latlng
							var lnglat = lnglat.split(',');
							return lnglat[1] + ',' + lnglat[0];
						});
					}
					done(null, coords);
				});
			}
		], function(err, results){
			var routeStops = results[0];
			var route1Coords = results[1];
			var route2Coords = results[2];

			var data = {
				1: {
					route: route1Coords,
					stops: routeStops[1]
				},
				2: {
					route: route2Coords || route1Coords,
					// Fallback to Route 1, assuming the bus goes back using same route
					stops: routeStops[2]
				}
			}

			var serviceFile = 'data/2/bus-services/' + service + '.json';
			fs.writeFileSync(serviceFile, JSON.stringify(data));
			console.log('File "' + serviceFile + '" generated.');

			allDone();
		});
	}
});

async.series(services, function(){
	var stopsArr = [];
	_.forEach(stops, function(v, k){
		if (parseInt(v.lat, 10) == 0 && parseInt(v.lng, 10) == 0) return;
		stopsArr.push({
			no: k,
			lat: v.lat,
			lng: v.lng,
			name: v.name
		});
	});

	var serviceFile = 'data/2/bus-stops.json';
	fs.writeFileSync(serviceFile, JSON.stringify(stopsArr));
	console.log('File "' + serviceFile + '" generated.');

	console.log('Bad route lines report:');
	_.forEach(badlines, function(line, service){
		var blank = '                  ';
		var linesOne = line[1] ? ('routes 1: ' + line[1] + ' lines') : blank;
		var linesTwo = line[2] ? ('routes 2: ' + line[2] + ' lines') : blank;

		// Spaces padding
		var noL = 4-('' + service).length;
		while (noL--){ service += ' '; }

		console.log('Bus service ' + service + '\t' + linesOne + '\t' + linesTwo);
	});

	console.log('Services with no routes?!: ' + nolines.join(', '));

	var badRoutesFile = 'data/2/bad-routes.json';
	fs.writeFileSync(badRoutesFile, JSON.stringify(badlines));
	console.log('File "' + badRoutesFile + '" generated.');
});
//
// module.exports = function(grunt){
//
// 	grunt.registerTask('fetchBusStopsRoutes', 'Fetch bus stops and routes from mytransport.sg', function(){
// 		var badlines = {}; // Store the bad route lines, report 'em
// 		var nolines = []; // Store the services with NO routes (KML files)
// 		var stops = {}; // Store ALL the bus stops
// 		var _ = grunt.util._;
//
// 		var data = grunt.file.readJSON('data/2/bus-services.json');
// 		var services = data.services.map(function(s){
// 			var service = s.no;
// 			var routes = s.routes;
// 			return function(allDone){
// 				grunt.util.async.parallel([
// 					function(done){
// 						console.log('https://www.mytransport.sg/content/mytransport/ajax_lib/map_ajaxlib.getBusRouteByServiceId.' + service + '.html');
// 						needle.get('https://www.mytransport.sg/content/mytransport/ajax_lib/map_ajaxlib.getBusRouteByServiceId.' + service + '.html', function(err, res, body){
// 							var $ = cheerio.load(body);
//
// 							var routeStops = { 1: [], 2: [] };
//
// 							$('.bus_stop_code').each(function(){
// 								var el = $(this);
// 								var nameEl = el.next();
// 								if (!nameEl.hasClass('bus_stop_name')) return;
// 								var onclick = el.attr('onclick');
// 								if (!onclick) return;
// 								var args = (onclick.match(/\(([^()]+)\)/i) || [,''])[1].split(',');
// 								var lng = args[0].trim();
// 								var lat = args[1].trim();
// 								if (parseInt(lng, 10) == 0 && parseInt(lat, 10) == 0) return;
// 								var seq = parseInt(args[2].trim(), 10); // Starts from 1
// 								var code = args[3].trim();
// 								var direction = args[4].trim();
// 								var name = nameEl.text().trim();
// 								routeStops[direction][seq-1] = code;
// 								stops[code] = {
// 									lat: lat,
// 									lng: lng,
// 									name: name
// 								};
// 							});
//
// 							routeStops[1] = _.compact(routeStops[1]);
// 							routeStops[2] = _.compact(routeStops[2]);
//
// 							done(null, routeStops);
// 						});
// 					},
// 					function(done){
// 						console.log('https://www.mytransport.sg/kml/busroutes/' + service + '-1.kml');
// 						request('https://www.mytransport.sg/kml/busroutes/' + service + '-1.kml', function(err, res, body){
// 							if (err) throw err;
// 							if (res.statusCode != 200){
// 								// throw new Error('Status code: ' + res.statusCode);
// 								console.error('Status code for ' + service + '/1: ' + res.statusCode);
// 								nolines.push(service);
// 								done(); // EMPTY ROUTE?!!
// 								return;
// 							}
//
// 							var coords = [];
// 							var coordsStrings = body.match(/<coordinates>[^<>]+<\/coordinates>/g);
// 							if (coordsStrings.length > 1){
// 								// There are more than one lines for this route
// 								// Just give up
// 								coords = null;
// 								if (!badlines[service]) badlines[service] = {};
// 								badlines[service][1] = coordsStrings.length;
// 							} else {
// 								coords = coordsStrings[0].replace(/^<coordinates>/, '').replace(/<\/coordinates>$/, '').trim().split(/\s+/).map(function(lnglat){
// 									// It's lnglat, here we convert them to latlng
// 									var lnglat = lnglat.split(',');
// 									return lnglat[1] + ',' + lnglat[0];
// 								});
// 							}
// 							done(null, coords);
// 						});
// 					},
// 					function(done){
// 						if (routes != 2){
// 							done(null, []);
// 							return;
// 						}
// 						console.log('https://www.mytransport.sg/kml/busroutes/' + service + '-2.kml');
// 						request('https://www.mytransport.sg/kml/busroutes/' + service + '-2.kml', function(err, res, body){
// 							if (err) throw err;
// 							if (res.statusCode != 200){
// 								console.error('Status code for ' + service + '/2: ' + res.statusCode);
// 								done(); // Return empty
// 								return;
// 							}
//
// 							var coords = [];
// 							var coordsStrings = body.match(/<coordinates>[^<>]+<\/coordinates>/g);
// 							if (coordsStrings.length > 1){
// 								// There are more than one lines for this route
// 								// Just give up
// 								coords = null;
// 								if (!badlines[service]) badlines[service] = {};
// 								badlines[service][2] = coordsStrings.length;
// 							} else {
// 								coords = coordsStrings[0].replace(/^<coordinates>/, '').replace(/<\/coordinates>$/, '').trim().split(/\s+/).map(function(lnglat){
// 									// It's lnglat, here we convert them to latlng
// 									var lnglat = lnglat.split(',');
// 									return lnglat[1] + ',' + lnglat[0];
// 								});
// 							}
// 							done(null, coords);
// 						});
// 					}
// 				], function(err, results){
// 					var routeStops = results[0];
// 					var route1Coords = results[1];
// 					var route2Coords = results[2];
//
// 					var data = {
// 						1: {
// 							route: route1Coords,
// 							stops: routeStops[1]
// 						},
// 						2: {
// 							route: route2Coords || route1Coords,
// 							// Fallback to Route 1, assuming the bus goes back using same route
// 							stops: routeStops[2]
// 						}
// 					}
//
// 					var serviceFile = 'data/2/bus-services/' + service + '.json';
// 					grunt.file.write(serviceFile, JSON.stringify(data));
// 					grunt.log.writeln('File "' + serviceFile + '" generated.');
//
// 					allDone();
// 				});
// 			}
// 		});
//
// 		var finish = this.async();
// 		grunt.util.async.series(services, function(){
// 			var stopsArr = [];
// 			_.forEach(stops, function(v, k){
// 				if (parseInt(v.lat, 10) == 0 && parseInt(v.lng, 10) == 0) return;
// 				stopsArr.push({
// 					no: k,
// 					lat: v.lat,
// 					lng: v.lng,
// 					name: v.name
// 				});
// 			});
//
// 			var serviceFile = 'data/2/bus-stops.json';
// 			grunt.file.write(serviceFile, JSON.stringify(stopsArr));
// 			grunt.log.writeln('File "' + serviceFile + '" generated.');
//
// 			grunt.log.writeln('Bad route lines report:');
// 			_.forEach(badlines, function(line, service){
// 				var blank = '                  ';
// 				var linesOne = line[1] ? ('routes 1: ' + line[1] + ' lines') : blank;
// 				var linesTwo = line[2] ? ('routes 2: ' + line[2] + ' lines') : blank;
//
// 				// Spaces padding
// 				var noL = 4-('' + service).length;
// 				while (noL--){ service += ' '; }
//
// 				grunt.log.writeln('Bus service ' + service + '\t' + linesOne + '\t' + linesTwo);
// 			});
//
// 			grunt.log.writeln('Services with no routes?!: ' + nolines.join(', '));
//
// 			var badRoutesFile = 'data/2/bad-routes.json';
// 			grunt.file.write(badRoutesFile, JSON.stringify(badlines));
// 			grunt.log.writeln('File "' + badRoutesFile + '" generated.');
//
// 			finish();
// 		});
// 	});
//
// };
