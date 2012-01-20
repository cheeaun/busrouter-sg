#!/usr/bin/env node

var request = require('request');
var scraper = require('scraper');
var fs = require('fs');
var async = require('async');
var jQuery = require('jquery');

var json = fs.readFileSync('bus-services.json', 'ascii');
if (!json) console.log('bus-services.json not found');

try {
	fs.readdirSync('bus-services')
} catch (e){
	fs.mkdirSync('bus-services', '0777');
}

var data = JSON.parse(json);
var fns = [];
for (var type in data){
	var services = data[type];
	services.forEach(function(service){
		fns.push(function(done){
			var no = service.no;
			var dir = service.dir;
			async.parallel({
				bs: function(_done){
					request('http://publictransport.sg/content/publictransport/en/homepage/Ajax/map_ajaxlib.getBusRouteByServiceId.' + no + '.html', function(e, response, body){
						console.log('bs: ' + no)
						if (e) throw e;
						if (response.statusCode != 200) throw 'status code ' + response.statusCode;
						
						var $body = jQuery('<body>' + body + '</body>');
						var busStops = {1: [], 2: []};
						var stops = {};
						
						$body.find('.br_line').each(function(){
							var $line = jQuery(this);
							var $els = $line.nextUntil('.br_line');
							if (!$els.length) return;
							var $codes = $els.filter('.bus_stop_code');
							var codesLen = $codes.length;
							if (!codesLen) return;
							if (codesLen == 2){
								var text1 = $codes[0].textContent.trim();
								if (text1) busStops[1].push(text1);
								var text2 = $codes[1].textContent.trim();
								if (text2) busStops[2].push(text2);
							} else {
								var text = $codes[0].textContent.trim();
								if (text) busStops[1].push(text);
							}
							
							var $names = $els.filter('.bus_stop_name');
							$codes.each(function(i){
								var onclick = this.getAttribute('onclick');
								if (!onclick) return; // Some don't have onclick, skip
								stops[this.textContent.trim()] = {
									coords: onclick.match(/e\(([^()]+)\)/)[1],
									name: $names[i].textContent.trim()
								}
							});
						});
						/*
						var $codes = $body.find('.bus_stop_code:not(.header)');
						var $names = $body.find('.bus_stop_name:not(.header)');
						if (dir == 2){
							var $codes1 = $codes.filter(':odd');
							var $names1 = $names.filter(':odd');
							var $codes2 = $codes.filter(':even');
							var $names2 = $names.filter(':even');
							$codes1.each(function(){
								var text = this.textContent.trim();
								if (text) busStops[1].push(text);
							});
							$codes2.each(function(){
								var text = this.textContent.trim();
								if (text) busStops[2].push(text);
							});
						} else {
							$codes.each(function(){
								var text = this.textContent.trim();
								if (text) busStops[1].push(text);
							});
						}
						
						$codes.each(function(i){
							var onclick = this.getAttribute('onclick');
							if (!onclick) return; // Some don't have onclick, skip
							stops[this.textContent.trim()] = {
								coords: onclick.match(/e\(([^()]+)\)/)[1],
								name: $names[i].textContent.trim()
							}
						});
						*/
						_done(null, {
							busStops: busStops,
							stops: stops
						});
					});
				},
				route1: function(_done){
					request('http://publictransport.sg/kml/busroutes/' + no + '-1.kml', function(e, response, body){
						console.log('route1: ' + no)
						if (e) throw e;
						if (response.statusCode != 200) throw 'status code ' + response.statusCode;
						var coordsString = body.match(/<coordinates>([^<>]+)<\/coordinates>/)[1];
						var coords = coordsString.trim().split(/\s+/).map(function(coord){
							return coord.replace(/,0$/, ''); // Replace that last zero, not sure what is it.
						});
						_done(null, coords);
					});
				},
				route2: function(_done){
					if (dir != 2){
						_done(null, []);
					} else {
						request('http://publictransport.sg/kml/busroutes/' + no + '-2.kml', function(e, response, body){
							console.log('route2: ' + no)
							if (e) throw e;
							if (response.statusCode != 200) throw 'status code ' + response.statusCode;
							var coordsString = body.match(/<coordinates>([^<>]+)<\/coordinates>/)[1];
							var coords = coordsString.trim().split(/\s+/).map(function(coord){
								return coord.replace(/,0$/, ''); // Replace that last zero, not sure what is it.
							});
							_done(null, coords);
						});
					}
				}
			}, function(e, results){
				var route1 = results.route1;
				var route2 = results.route2;
				var bs = results.bs;
				var busStops = bs.busStops;
				var stops = bs.stops;
				var d = {
					1: {
						route: route1,
						stops: busStops[1]
					},
					2: {
						route: route2,
						stops: busStops[2]
					}
				};
				var file = 'bus-services/' + no + '.json';
				fs.writeFile(file, JSON.stringify(d), function(){
					console.log(file + ' created.');
					done(null, stops);
				});
			});
		});
	});
}
console.log(fns.length + ' bus services');

var busStopsData = {};
async.series(fns, function(e, results){
	for (var i=0, l=results.length; i<l; i++){
		var result = results[i];
		jQuery.extend(busStopsData, result);
	}
	fs.writeFile('bus-stops.json', JSON.stringify(busStopsData), function(){
		console.log('bus-stops.json created.');
	});
});