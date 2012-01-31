#!/usr/bin/env node

var fs = require('fs');

var json = fs.readFileSync('bus-services.json', 'ascii');
if (!json) console.log('bus-services.json not found');

var stops = {};

var data = JSON.parse(json);
for (var type in data){
	var services = data[type];
	services.forEach(function(service){
		var no = service.no;
		var json = fs.readFileSync('bus-services/' + no + '.json', 'ascii');
		var d = JSON.parse(json);
		var stops1 = d[1].stops;
		stops1.forEach(function(stop){
			if (stops[stop]){
				if (stops[stop].indexOf(no) == -1) stops[stop].push(no);
			} else {
				stops[stop] = [no];
			}
		});
		if (d[2] && d[2].stops && d[2].stops.length){
			var stops2 = d[2].stops;
			stops2.forEach(function(stop){
				if (stops[stop]){
					if (stops[stop].indexOf(no) == -1) stops[stop].push(no);
				} else {
					stops[stop] = [no];
				}
			});
		}
	});
}

fs.writeFile('bus-stops-services.json', JSON.stringify(stops), function(){
	console.log('bus-stops-services.json created.');
});
