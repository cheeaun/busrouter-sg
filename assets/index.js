'use strict';

var ajax = require('ajax');
var parallel = require('array-parallel');
var debounce = require('debounce');
var keyname = require('keyname');
var Route66 = require('route66');
var routes = new Route66();

var addEvent = google.maps.event.addDomListener;
var $ = function(id){
	return document.getElementById(id);
};

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
	ajax.getJSON('data/2/bus-stops-services.json', function(body){
		done(null, body);
	});
});

flow.push(function(done){
	addEvent(window, 'load', function(){
		google.maps.visualRefresh = true;

		var map = new google.maps.Map($('map'), {
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

var searchbox = {
	init: function(options){
		var $el = this.$el = options.$el;
		var $datalist = this.$datalist = options.$datalist;
		var $clear = this.$clear = options.$clear;
		this.data = options.data;

		var that = this;
		addEvent($el, 'input', debounce(this.triggerSearch.bind(this), 100));
		addEvent($el, 'focus', this.triggerSearch.bind(this));
		addEvent($el, 'click', this.triggerSearch.bind(this));
		addEvent($el, 'keyup', function(e){
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
				case 'esc':
					that.clearSearch();
					break;
			}
		});

		addEvent($clear, 'click', function(e){
			e.preventDefault();
			that.clearSearch();
		});

		addEvent($el, 'blur', function(){
			that.hideDatalist();
		});
	},

	clearSearch: function(){
		var $el = this.$el;
		$el.value = '';
		$el.focus();

		this.hideDatalist();
	},

	triggerSearch: function(){
		var $el = this.$el;
		var $datalist = this.$datalist;
		var busStops = this.data.busStops;
		var busServices = this.data.busServices;

		var value = $el.value.trim();
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

			$el.classList.add('is-valued');
			$datalist.innerHTML = html;
			this.showDatalist();
		} else {
			$el.classList.remove('is-valued');
			this.hideDatalist();
		}

	},

	focus: function(){
		this.$el.focus();
	},

	blur: function(){
		this.$el.blur();
	},

	showDatalist: function(){
		this.$datalist.classList.add('is-visible');
	},

	hideDatalist: function(){
		this.$datalist.classList.remove('is-visible');
	},

	setValueIfEmpty: function(value){
		var $el = this.$el;
		if ($el.value) return;
		$el.value = value;
	}

};

var currentRoute = 'home';

parallel(flow, function(error, results){
	var busStops = results[0];
	var busServices = results[1];
	var busStopsServices = results[2];
	var map = results[3];

	var markerImage = {
		circle: {
			url: 'assets/images/red-circle.png',
			scaledSize: new google.maps.Size(30/2, 32/2)
		},
		dot: 'assets/red-pin-dot.png',
		a: 'assets/red-pin-a.png',
		b: 'assets/red-pin-b.png'
	};

	var infowindow = new google.maps.InfoWindow({
		maxWidth: 280
	});

	var markersMap = {};
	var markers = busStops.map(function(stop){
		var marker = new google.maps.Marker({
			position: new google.maps.LatLng(stop.lat, stop.lng),
			map: map,
			visible: false,
			title: stop.no + ' ' + stop.name,
			icon: markerImage.circle
		});

		var services = busStopsServices[stop.no];

		addEvent(marker, 'click', function(){
			var html = '<div class="infowindow">'
				+ '<h1><span class="label label-stop">' + stop.no + '</span>' + stop.name + '</h1><p>'
			services.forEach(function(service){
				html += '<a href="#/services/' + service + '" class="label label-service" title="Bus service ' + service + '">' + service + '</a> ';
			});
			html += '</p></div>';
			infowindow.setContent(html);
			infowindow.open(map, marker);

			var zIndex = marker.getZIndex();
			marker.setZIndex(!zIndex ? google.maps.Marker.MAX_ZINDEX : zIndex+1);
		});

		markersMap[stop.no] = marker;

		return marker;
	});

	searchbox.init({
		$el: $('search'),
		$datalist: $('search-datalist'),
		$clear: $('search-clear'),
		data: {
			busStops: busStops,
			busServices: busServices
		}
	});

	// Hide searchbox datalist when interacting with map
	addEvent(map, 'click', function(){
		searchbox.blur();
	});
	addEvent(map, 'dragstart', function(){
		searchbox.blur();
	});

	// Plot all the bus stops on map
	var visibleMarkers = [];
	addEvent(map, 'idle', debounce(function(){
		if (currentRoute != 'home' && currentRoute != 'stop') return;

		var zoom = map.getZoom();
		if (zoom >= 15){
			var bounds = map.getBounds();

			visibleMarkers = markers.filter(function(marker){
				var visible = bounds.contains(marker.getPosition());
				if ((visible && !marker.getVisible()) || (!visible && marker.getVisible())){
					marker.setVisible(visible);
				}
				return visible;
			});
		} else {
			visibleMarkers.forEach(function(marker){
				marker.setVisible(false);
			});
			visibleMarkers = [];
			infowindow.close();
		}
	}, 300));

	routes.path('/', function(){
		currentRoute = 'home';

		var bounds = new google.maps.LatLngBounds(new google.maps.LatLng(1.1663980,103.60557550), new google.maps.LatLng(1.47088090,104.08568050));
		map.fitBounds(bounds);

		var maxX = bounds.getNorthEast().lng();
		var maxY = bounds.getNorthEast().lat();
		var minX = bounds.getSouthWest().lng();
		var minY = bounds.getSouthWest().lat();
		var panBackToBounds = function(){
			var c = map.getCenter();
			var x = c.lng();
			var y = c.lat();

			if (x < minX) x = minX;
			if (x > maxX) x = maxX;
			if (y < minY) y = minY;
			if (y > maxY) y = maxY;

			map.panTo(new google.maps.LatLng(y, x));
		};
		addEvent(map, 'dragend', panBackToBounds);
		addEvent(map, 'zoom_changed', panBackToBounds);

		searchbox.focus();
	});

	routes.path('/services/:no', function(no){
		currentRoute = 'service';

		ajax.getJSON('data/2/bus-services/' + no + '.json', function(body){
			if (!body) return;
		});
	});

	routes.path('/stops/:no', function(no){
		currentRoute = 'stop';

		var marker = markersMap[no];
		if (!marker) return;
		var zoom = map.getZoom();
		if (zoom < 15) map.setZoom(15);
		map.panTo(marker.getPosition());
		google.maps.event.trigger(marker, 'click');

		searchbox.setValueIfEmpty(no);
	});

	routes._match(location.hash.slice(1) || '/');
});