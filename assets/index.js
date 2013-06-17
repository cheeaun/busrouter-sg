'use strict';

var ajax = require('ajax');
var parallel = require('array-parallel');
var debounce = require('debounce');
var keyname = require('keyname');
var Route66 = require('route66');
var routes = new Route66();

var addEvent = google.maps.event.addDomListener;
var flow = [];

flow.push(function(done){
	ajax.getJSON('data/2/bus-stops.json', function(body){
		done(null, body);
	});
});

flow.push(function(done){
	ajax.getJSON('data/2/bus-services.json', function(body){
		done(null, body);
	});
});

flow.push(function(done){
	addEvent(window, 'load', function(){
		google.maps.visualRefresh = true;

		var map = new google.maps.Map(document.getElementById('map'), {
			center: new google.maps.LatLng(1.3520830, 103.8198360),
			zoom: 11,
			mapTypeId: google.maps.MapTypeId.ROADMAP,
			disableDefaultUI: true,
			zoomControlOptions: {
				style: google.maps.ZoomControlStyle.SMALL,
				position: google.maps.ControlPosition.RIGHT_BOTTOM
			}
		});

		done(null, map);
	});
});

var app = {

};

parallel(flow, function(error, results){
	var busStops = results[0];
	var busServices = results[1];
	var map = results[2];

	var $search = document.getElementById('search');
	var $datalist = document.getElementById('datalist');

	var markerImage = {
		circle: 'assets/images/red-circle.png',
		dot: 'assets/red-pin-dot.png',
		a: 'assets/red-pin-a.png',
		b: 'assets/red-pin-b.png'
	};

	var triggerSearch = function(){
		var value = $search.value.trim();
		var html = '';

		if (value){
			var results = [];
			var exp = value.replace(/([-.*+?^${}()|[\]\/\\])/g, '\\$1').split('').reduce(function(a,b){ return a + '.*' + b; });
			var re = new RegExp(exp, 'i');
			var limit = 8;
			var count = 0;

			for (var i=0, l=busServices.services.length; count<limit && i<l; i++){
				var service = busServices.services[i];
				var no = service.no;
				var name = service.name;
				if (re.test(no + ' ' + name)){
					results.push({
						value: no,
						name: name,
						type: 'service',
						url: '#/services/' + no
					});
					count++;
				}
			}

			for (var i=0, l=busStops.length; count<limit && i<l; i++){
				var stop = busStops[i];
				var no = stop.no;
				var name = stop.name;
				if (re.test(no + ' ' + name)){
					results.push({
						value: no,
						name: name,
						type: 'stop',
						url: '#/stops/' + no
					});
					count++;
				}
			}

			results.forEach(function(result){
				var value = result.value;
				var name = result.name;
				var type = result.type;
				html += '<li><a href="' + result.url + '" class="' + type + '" data-value="' + value + '"><span class="label label-' + type + '">' + value + '</span> ' + name + '</a></li>';
			});
		}

		$datalist.innerHTML = html;
	};
	addEvent($search, 'input', debounce(triggerSearch, 100));
	addEvent($search, 'focus', triggerSearch);
	addEvent($search, 'keyup', function(e){
		var key = keyname(e.keyCode);
		var selected = $datalist.querySelector('.selected');
		switch (key){
			case 'down':
				if (!selected){
					var first = $datalist.querySelector('li:first-child');
					if (first) first.classList.add('selected');
				} else {
					var next = selected.nextSibling;
					if (next){
						next.classList.add('selected');
						selected.classList.remove('selected');
					}
				}
				break;
			case 'up':
				if (!selected){
					var last = $datalist.querySelector('li:last-child');
					if (last) last.classList.add('selected');
				} else {
					var prev = selected.previousSibling;
					if (prev){
						prev.classList.add('selected');
						selected.classList.remove('selected');
					}
				}
				break;
			case 'enter':
				if (!selected){
					var first = $datalist.querySelector('li:first-child');
					if (first) first.querySelector('a').click();
				} else {
					selected.querySelector('a').click();
				}
				break;
		}
	});

	var markers = busStops.map(function(stop){
		return new google.maps.Marker({
			position: new google.maps.LatLng(stop.lat, stop.lng),
			map: map,
			title: stop.no + ' ' + stop.name,
			visible: false,
			icon: {
				url: markerImage.circle,
				scaledSize: new google.maps.Size(18, 18)
			}
		});
	});

	addEvent(map, 'idle', function(){
		var zoom = map.getZoom();
		if (zoom >= 15){
			var bounds = map.getBounds();

			markers.forEach(function(marker){
				var visible = bounds.contains(marker.getPosition());
				marker.setVisible(visible);
			});
		} else {
			markers.forEach(function(marker){
				marker.setVisible(false);
			});
		}
	});

	routes.path('/', function(){
		var bounds = new google.maps.LatLngBounds(new google.maps.LatLng(1.1663980,103.60557550), new google.maps.LatLng(1.47088090,104.08568050));
		map.fitBounds(bounds);
	});

	routes.path('/services/:no', function(no){
		console.log(no)
	});

	routes.path('/stops/:no', function(no){
		console.log(no)
	});

	routes._match(location.hash.slice(1) || '/');
});