(function(){
	if (!window.addEventListener) return; // If the browser doesn't even support this, just give up.

	var dataVersion = '2'; // Versioning for all the bus data
	var currentDataVersion = lscache.get('busDataVersion');
	if (dataVersion != currentDataVersion && localStorage && localStorage.length && localStorage.removeItem){
		// Remove amplify's localStorage
		for (var i = localStorage.length-1; i >= 0 ; --i) {
			var key = localStorage.key(i);
			if (key.indexOf('__amplify__bus') === 0) {
				localStorage.removeItem(key);
			}
		}
		lscache.flush();
		lscache.set('busDataVersion', dataVersion);
	}

	var dataEndPoints = {
		busStops: 'bus-stops.json',
		busServices: 'bus-services.json',
		busService: 'bus-services/{{no}}.json',
		busStopsServices: 'bus-stops-services.json'
	};

	var getData = function(key, params, done){
		if (arguments.length == 2){
			done = params;
			params = {};
		}
		var data = lscache.get(key);
		if (data){
			done(null, data);
		} else {
			var xhr = new XMLHttpRequest();
			var endPoint = 'data/2/' + dataEndPoints[key.split('-')[0]];
			for (p in params) endPoint = endPoint.replace('{{' + p + '}}', params[p]);
			xhr.onload = function(){
				try{
					var data = JSON.parse(this.responseText);
					done(null, data);
					lscache.set(key, data, 24*60);
				} catch (e){
					done(e);
				}
			};
			xhr.onerror = xhr.onabort = done;
			xhr.open('get', endPoint, true);
			xhr.send();
		}
	};

	var isSmallScreen = window.innerWidth <= 640;

	var markerImage;

	var tasks = [
		function(callback){
			getData('busStops', callback);
		},
		function(callback){
			getData('busServices', callback);
		},
		function(callback){
			getData('busStopsServices', callback);
		},
		function(callback){
			queue()
				.defer(function(cb){
					var script = document.createElement('script');
					script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyDJii3LssFIl3cw4XzTxtWqSls57rayV5I&libraries=places&callback=loadMap';
					document.body.appendChild(script);
					window.loadMap = cb;
				})
				.await(initMap);

			function initMap(){
				var center = new google.maps.LatLng(1.3520830, 103.8198360);
				var map = new google.maps.Map(document.getElementById('map'), {
					mapTypeId: google.maps.MapTypeId.ROADMAP,
					disableDefaultUI: true,
					keyboardShortcuts: true,
					zoomControl: true,
					zoomControlOptions: {
						position: google.maps.ControlPosition.RIGHT_BOTTOM
					}
				});

				if (isSmallScreen){
					map.setOptions({
						overviewMapControl: false,
						zoomControl: false
					});

					google.maps.event.addListener(map, 'dragstart', function(){
						$('body').addClass('header-collapsed');
					});
				}

				var bounds = new google.maps.LatLngBounds(new google.maps.LatLng(1.25352193438281, 103.62192147229632), new google.maps.LatLng(1.50129709375363, 103.99983438993593));
				map.fitBounds(bounds);

				var sprite = {
					url: 'assets/images/bus-sprite.png',
					scaledSize: new google.maps.Size(156/2, 168/2)
				};
				markerImage = {
					location: {
						url: sprite.url,
						scaledSize: sprite.scaledSize,
						size: new google.maps.Size(36/2, 38/2),
						anchor: new google.maps.Point(36/4, 38/4),
						origin: new google.maps.Point(96/2, 0)
					},
					circle: {
						url: sprite.url,
						scaledSize: sprite.scaledSize,
						size: new google.maps.Size(36/2, 38/2),
						anchor: new google.maps.Point(36/4, 38/4),
						origin: new google.maps.Point(60/2, 0)
					},
					dot: {
						url: sprite.url,
						scaledSize: sprite.scaledSize,
						size: new google.maps.Size(52/2, 76/2),
						origin: new google.maps.Point(0, 92/2)
					},
					a: {
						url: sprite.url,
						scaledSize: sprite.scaledSize,
						size: new google.maps.Size(52/2, 76/2),
						origin: new google.maps.Point(52/2, 92/2)
					},
					b: {
						url: sprite.url,
						scaledSize: sprite.scaledSize,
						size: new google.maps.Size(52/2, 76/2),
						origin: new google.maps.Point(104/2, 92/2)
					}
				};

				if (navigator.geolocation){
					var geolocationControl = document.createElement('a');
					geolocationControl.id = 'geolocation-control';
					geolocationControl.href = '#';
					geolocationControl.innerHTML = '<svg class="icon icon-circle"><use xlink:href="#location-arrow"></use></svg>';
					map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(geolocationControl);

					var locationMarker = new google.maps.Marker({
						map: map,
						clickable: false,
						title: 'Current location',
						icon: markerImage.location,
						cursor: 'default',
						visible: false,
						zIndex: 9001
					});
					var locationCircle = new google.maps.Circle({
						map: map,
						clickable: false,
						fillColor: '#00b4d2',
						fillOpacity: 0.1,
						strokeWeight: 0,
						visible: false,
						zIndex: 9000
					});

					var watching = false, watch;
					var unwatch = function(){
						navigator.geolocation.clearWatch(watch);
						watching = false;
						locationCircle.setVisible(false);
						locationMarker.setVisible(false);
						$('#geolocation-control').removeClass('active');
					};

					$('#map').on('click', '#geolocation-control', function(e){
						e.preventDefault();
						if (watching){
							var pos = locationMarker.getPosition();
							if (map.getBounds().contains(pos)){
								unwatch();
							} else {
								map.panTo(pos);
							}
						} else {
							var panToLocation = false;
							watch = navigator.geolocation.watchPosition(function(position){
								watching = true;
								var coords = position.coords;
								var pos = new google.maps.LatLng(coords.latitude, coords.longitude);
								locationCircle.setCenter(pos);
								locationCircle.setRadius(coords.accuracy);
								locationCircle.setVisible(true);
								locationMarker.setPosition(pos);
								locationMarker.setVisible(true);
								if (!panToLocation && bounds.contains(pos)){
									map.panTo(pos);
									var zoom = map.getZoom();
									if (zoom < 15) map.setZoom(15);
									panToLocation = true;
								}
								$('#geolocation-control').addClass('active');
							}, function(e){
								unwatch();
								alert('Unable to get your location. Please try again.');
							}, {
								enableHighAccuracy: true,
								timeout: 60*1000, // 1 min timeout
								maximumAge: 5*1000 // 5-second cache
							})
						}
					});
				}

				var $boundsWarning = $('#bounds-warning');
				google.maps.event.addListener(map, 'bounds_changed', function(){
					var mapBounds = map.getBounds();
					if (mapBounds.intersects(bounds)){
						$boundsWarning.removeClass('visible');
					} else {
						$boundsWarning.addClass('visible');
					}
				});
				$('#back-sg').on('click', function(e){
					e.preventDefault();
					$boundsWarning.removeClass('visible');
					map.panTo(center);
					setTimeout(function(){
						map.fitBounds(bounds);
					}, 300);
				});

				var $form = $('#places-search-form');
				$form.on('submit', function(e){
					e.preventDefault();
				});

				var autocomplete = new google.maps.places.Autocomplete($form.find('input')[0], {
					bounds: bounds,
					componentRestrictions: {country: 'sg'}
				});
				google.maps.event.addListener(autocomplete, 'place_changed', function(){
					$('#search').addClass('hidden');
					var place = autocomplete.getPlace();
					if (!place.geometry) return;
					if (place.geometry.viewport) {
						map.fitBounds(place.geometry.viewport);
					} else {
						map.setCenter(place.geometry.location);
						map.setZoom(17);
					}
				});

				if (!lscache.get('busrouter-intro') && !/\w/i.test(location.hash)){
					$('#intro').removeClass('hidden');
				}

				callback(null, map);
			};
		}
	];

	// Moved outisde for re-use in 'compare'
	var populateBusServices = function (busServices, pathCompare) {
		var busServicesByType = {};
		var busServicesMap = {};

		busServices.services.forEach(function(service){
			var type = service.type;
			if (busServicesByType[type]){
				busServicesByType[type].push(service);
			} else {
				busServicesByType[type] = [service];
			}
			busServicesMap[service.no] = service;
		});

		var $busServices = $('#bus-services');
		var html = '<label class="search-field">'
				+ '<svg class="icon"><use xlink:href="#search-icon"></use></svg>'
				+ '<input placeholder="Bus service number e.g.: 133" required>'
				+ '<a href="#" class="close"><svg class="icon"><use xlink:href="#times"></use></svg></a>'
			+ '</label>';
		for (type in busServicesByType){
			var services = busServicesByType[type];
			html += '<h2>' + busServices.types[type] + '</h2><ul>';
			for (var i=0, l=services.length; i<l; i++){
				var service = services[i];
				var no = service.no;
				if (pathCompare) {
					html += '<li><a href="/#/compare/' + no + '/1' + pathCompare + '" id="service-' + no + '">' + no + ' <span>' + service.name + '</span></a></li>';
				} else {
					html += '<li><a href="#/services/' + no + '" id="service-' + no + '">' + no + ' <span>' + service.name + '</span></a></li>';
				}
			}
			html += '</ul>';
		}
		$busServices.html(html);

		var $busInput = $busServices.find('input');
		var $busLinks = $busServices.find('li a');
		var updateBusList = function(){
			var val = $busInput.val();
			$busLinks.each(function(link){
				var number = link.textContent.trim().toLowerCase();
				var hidden = number.indexOf(val.toLowerCase()) < 0;
				if (hidden){
					$(link).addClass('hidden');
				} else {
					$(link).removeClass('hidden');
				}
			});
		};
		$busInput.on('input', updateBusList);
		$busServices.find('.close').on('click', function(e){
			e.preventDefault();
			$busInput.val('');
			updateBusList();
			$busInput.focus();
		});
		
		return [busServicesMap, $busServices];
	};

	var tasksDone = function(error, results){
		if (error || !results || results.length != 4){
			alert('Oops, an error occured.');
			return;
		}

		var busStops = results[0];
		var busServices = results[1];
		var busStopsServices = results[2];
		var map = results[3];

		var busStopsMap = {};
		busStops.forEach(function(stop){
			busStopsMap[stop.no] = stop;
		});

		var p = populateBusServices(busServices);
		busServicesMap = p[0];
		$busServices = p[1];

		var markers = [];
		var markersCompare = [];
		var markersOld; // Temporary variable to hold initial layer in case user changes url manually amidst a comparison
		var polylines = {};
		var infowindow = new google.maps.InfoWindow({
			maxWidth: 260
		});
		var polyline = new google.maps.Polyline({
			clickable: false,
			strokeColor: '#f01b48',
			strokeWeight: 5,
			strokeOpacity: .5
		});
		var polylineCompare = new google.maps.Polyline({
			clickable: false,
			strokeColor: '#0f34b7',
			strokeWeight: 5,
			strokeOpacity: .5
		});
		var polylineOld; // Temporary variable to hold initial layer in case user changes url manually amidst a comparison

		var clearMap = function(){
			markers.forEach(function(marker){
				marker.setMap(null);
				google.maps.event.clearInstanceListeners(marker);
			});
			markers = [];
			markersCompare.forEach(function(marker){
				marker.setMap(null);
				google.maps.event.clearInstanceListeners(marker);
			});
			markersCompare = [];
			for (var stop in stopMarkers){
				var marker = stopMarkers[stop];
				marker.setMap(null);
				google.maps.event.clearInstanceListeners(marker);
			}
			stopMarkers = {};
			for (var service in polylines){
				var line = polylines[service];
				line.setMap(null);
				google.maps.event.clearInstanceListeners(line);
			}
			polylines = {};
			polyline.setMap(null);
			polylineCompare.setMap(null);
			infowindow.close();
		};

		google.maps.event.addListener(map, 'markerClick', function(data){
			var marker = data.marker;
			var stop = data.stop;
			var currentService = data.currentService;
			var hideShowRoutesLink = data.hideShowRoutesLink;
			var info = busStopsMap[stop];
			var name = info.name;
			var services = busStopsServices[stop];
			var html = '<div class="infowindow"><h1>' + name + '&nbsp;<span class="tag">' + stop + '</span></h1>';

			services.forEach(function(service){
				if (service == currentService){
					html += '<span class="infoservice">' + service + '</span> ';
				} else {
					html += '<a href="#/services/' + service + '" class="infoservice">' + service + '</a> ';
				}
			});

			html += '<div class="infofooter">';
			html += '<a href="bus-arrival/#' + stop + '" target="_blank" class="show-arrivals"><svg class="icon"><use xlink:href="#clock-o"></use></svg> Show bus arrival times here</a>';

			if (services.length > 1 && !hideShowRoutesLink){
				html += '<a href="#/stops/' + stop + '" class="show-routes"><svg class="icon"><use xlink:href="#code-fork"></use></svg> Show all routes passing here</a>';
			}
			html += '</div></div>';

			infowindow.setContent(html);
			infowindow.open(map, marker);
		});

		var stopMarkers = {};
		google.maps.event.addListener(map, 'idle', function(){
			if (currentRoute != 'home') return;
			var $busStops = $('#bus-stops');
			var zoom = map.getZoom();
			if (zoom >= 15){
				$('#bus-stops-section').removeClass('hidden');

				var bounds = map.getBounds();

				for (var no in stopMarkers){
					var m = stopMarkers[no];
					if (!bounds.contains(m.getPosition())){
						m.setMap(null);
						stopMarkers[no] = undefined;
						try { // Looks like iOS 6 choke on this
							delete stopMarkers[no];
						} catch (e) {}
					}
				}

				var busStopsOnMap = [];
				busStops.forEach(function(stop){
					var no = stop.no;
					if (!stopMarkers[no]){
						var position = new google.maps.LatLng(stop.lat, stop.lng);
						if (!bounds.contains(position)) return;

						var marker = new google.maps.Marker({
							position: position,
							map: map,
							title: stop.name,
							icon: markerImage.circle
						});

						google.maps.event.addListener(marker, 'click', function(){
							google.maps.event.trigger(map, 'markerClick', {
								marker: marker,
								stop: no
							});
						});

						stopMarkers[no] = marker;
					}

					busStopsOnMap.push({
						no: no,
						stop: stop
					});
				});

				if (busStopsOnMap.length){
					var html = '<ul>';
					busStopsOnMap.sort(function(a, b){
						var aName = a.stop.name;
						var bName = b.stop.name;
						if (aName < bName) return -1;
						if (aName > bName) return 1;
						return 0;
					});
					busStopsOnMap.forEach(function(b){
						var no = b.no;
						var name = b.stop.name;
						html += '<li><a class="stop" id="stop-' + no + '"><span class="tag">' + no + '</span> ' + name + '</a></li>';
					});
					html += '</ul>';
					$busStops.html(html);
				} else {
					$busStops.html('<p>Zoom in or pan around to see bus stops on the map.</p>');
				}
			} else {
				for (var no in stopMarkers) stopMarkers[no].setMap(null);
				stopMarkers = [];
				$busStops.html('<p>Zoom in or pan around to see bus stops on the map.</p>');
			}
		});

		$('#bus-stops').on('click', 'li a', function(e){
			e.preventDefault();
			var stop = $(this).find('.tag').text();
			var marker = stopMarkers[stop];
			var latlng = marker.getPosition();
			map.panTo(latlng);
			google.maps.event.trigger(marker, 'click');
		});
		$('#bus-stops-section').on('click', 'a.close', function(e){
			e.preventDefault();
			$('#bus-stops-section').addClass('hidden');
		});

		var $busRoutes = $('#bus-routes');
		var currentNo;

		var docTitle = document.title;
		var currentRoute = 'home';

		// Moved outisde for re-use in 'compare'
		var drawService = function (path, no, route, boundsOld) {
			var isComparison = !!boundsOld;

			var pathArray = path.split('/');

			pathArray[3] = route == 2 ? 1 : 2;
			var pathOther = pathArray.join('/');

			if (isComparison) {
				var noOld = pathArray[4];
				var routeOld = pathArray[5];

				polylineOld = polyline;
				polyline = polylineCompare;
				markersOld = markers;
				markers = markersCompare;

				currentRoute = 'compare';
				document.title = 'Bus service ' + no + ' and ' + noOld + ' - ' + docTitle;
			} else {
				if (polylineOld) {
					polyline = polylineOld
					polylineOld = undefined;
				}
				if (markersOld) {
					markers = markersOld;
					markersOld = undefined;
				}

				currentRoute = 'services';
				document.title = 'Bus service ' + no + ' - ' + docTitle;
				if (!route) route = 1;
			}

			// reset
			$busServices.find('a.selected').removeClass('selected');
			$('#service-' + no).addClass('selected');
			if (!isComparison) {
				clearMap();
			}

			$busServicesSection = $('#bus-services-section').addClass('loading');

			getData('busService-' + no, {no: no}, function(e, data){
				$busServicesSection.removeClass('loading');
				if (!data) return;

				var one = data[route];
				var routes = one.route;
				var stops = one.stops;
				var latlngs = [];
				var locations = [];

				if (routes && routes.length){
					for (var i=0, l=routes.length; i<l; i++){
						var coord = routes[i];
						var latlng = coord.split(',');
						var position = new google.maps.LatLng(parseFloat(latlng[0], 10), parseFloat(latlng[1], 10));
						latlngs.push(position);
					}
					polyline.setPath(latlngs);
					polyline.setMap(map);
				}

				var html = '<div class="tab-bar">';
				if (data[2] && data[2].route && data[2].route.length){
					html += '<a href="#' + (route == 1 ? path : pathOther) + '" class="tab ' + (route == 1 ? 'selected' : '') + '">Route 1</a>'
						+ '<a href="#' + (route == 2 ? path : pathOther) + '" class="tab ' + (route == 2 ? 'selected' : '') + '">Route 2</a>';
				}
				if (isComparison) { // Replace with new icons? Otherwise, either adjust style to make aside wider or display with two rows
					html += '<a href="">Home</a>';
				} else {
					html += '<a href="#/compare/' + no + '/' + route + '">Compare</a>';
				}
				var provider = busServicesMap[no].operator;
				if (provider){
					// Only SBS or SMRT, for now.
					var url = provider == 'sbs' ? 'http://www.sbstransit.com.sg/journeyplan/servicedetails.aspx?serviceno=' : 'http://www.transitlink.com.sg/eservice/eguide/service_route.php?service=';
					html += '<a href="' + url + no + '" target="_blank" class="details"><svg class="icon"><use xlink:href="#list-alt"></use></svg> Bus schedules</a>';
				}
				html += '</div>';
				html += '<ul>';

				var firstSameLast = false;
				var l = stops.length;
				bounds = new google.maps.LatLngBounds();

				stops.forEach(function(stop, i){
					var info = busStopsMap[stop];
					var name = info.name;
					var services = busStopsServices[stop];
					var icon = markerImage.circle;
					var last = l-1;
					var className = 'stop';

					if (i == 0){
						var lastStop = stops[last];
						var lastInfo = busStopsMap[lastStop];
						if (name == lastInfo.name){
							firstSameLast = true;
							icon = markerImage.dot;
							className = 'stop-dot';
						} else {
							icon = markerImage.a;
							className = 'stop-a';
						}
					} else if (i == last){
						if (firstSameLast){
							icon = markerImage.dot;
							className = 'stop-dot';
						} else {
							icon = markerImage.b;
							className = 'stop-b';
						}
					}
					if (i == last && firstSameLast){
						// Push the first marker as the last one. MINDBLOWN!
						markers.push(markers[0]);
					} else {
						var position = new google.maps.LatLng(info.lat, info.lng);
						var marker = new google.maps.Marker({
							position: position,
							map: map,
							icon: icon,
							title: name,
							animation: (i == 0 || i == last || isComparison) ? google.maps.Animation.DROP : null,
							zIndex: (i == 0 || i == last) ? 5 : 1
						});
						google.maps.event.addListener(marker, 'click', function(){
							google.maps.event.trigger(map, 'markerClick', {
								marker: marker,
								stop: stop,
								currentService: no
							});
							$busRoutes.find('li a.selected').removeClass('selected');
							$('.stop-' + stop + '[data-index="' + i + '"]').addClass('selected').focus();
						});
						markers.push(marker);

						bounds.extend(position);
					}

					html += '<li><a tabindex="0" href="#" class="' + className + ' stop-' + stop + '" data-index="' + i + '"><i></i><span class="tag">' + stop + '</span> ' + name + '</a></li>';
				});

				if (isComparison) {
					bounds.union(boundsOld);
				}

				$busRoutes.html(html + '</ul>');
				$busRoutes[0].scrollTop = 0;
				$('#bus-routes-section h1 b').text(no);
				if (isComparison) { // made back arrow return to 'compare' instead of 'home'
					document.getElementsByClassName('back')[0].href = '#/compare/' + noOld + '/' + routeOld;
					// $('.back').attr('href', '#/compare/' + noOld + '/' + routeOld); // does not work
				}
				$('section.extra').addClass('hidden');
				$('#bus-routes-section').removeClass('hidden');

				if (no != currentNo || !bounds.contains(map.getCenter())){
					currentNo = no;
					map.panTo(bounds.getCenter());
					setTimeout(function(){
						map.fitBounds(bounds);
					}, 400);
				}

				lscache.set('busService-' + no, data, 24*60);
			});

			return bounds;
		};

		ruto
			.config({
				notfound: function(){
					ruto.go('/');
				}
			})
			.add('/', function(){
				currentRoute = 'home';
				document.title = docTitle;
				$('section.extra').addClass('hidden');
				$('body').removeClass('header-collapsed');
				clearMap();
				setTimeout(function(){
					$busServices.find('a.selected').removeClass('selected');
				}, 400);
			})
			.add(/^\/services\/(\w+)\/?(\d)?$/i, function (path, no, route) {
				drawService(path, no, route);
			})
			.add(/^\/compare\/(\w+)\/(\d)$/i, function(path, no, route){ // url 'compare' must include route, even if it is '1'
				drawService(path, no, route); // redraw even if referer is 'services' becuase the user might have entered the url manually

				$('#bus-routes-section').addClass('hidden');
				var p = populateBusServices(busServices, path.slice('/compare'.length, Infinity));
				busServicesMap = p[0];
				$busServices = p[1];
			})
			.add(/^\/compare\/(\w+)\/(\d)\/(\w+)\/(\d)$/i, function(path, no, route, noOld, routeOld){
				boundsOld = drawService(path, noOld, routeOld); // redraw even if referer is 'compare' becuase the user might have entered the url manually
				drawService(path, no, route, boundsOld);
			})
			.add(/^\/stops\/(\w+)$/i, function(path, stop){
				currentRoute = 'stops';
				document.title = 'Bus stop ' + stop + ' - ' + docTitle;
				clearMap();

				$('#bus-stop-routes-section').removeClass('hidden').addClass('loading').find('h1 b').text(stop);

				var stopData = busStopsMap[stop];
				var position = new google.maps.LatLng(stopData.lat, stopData.lng);
				var marker = new google.maps.Marker({
					position: position,
					map: map,
					icon: markerImage.dot,
					title: stopData.name,
					animation: google.maps.Animation.DROP
				});

				google.maps.event.addListener(marker, 'click', function(){
					google.maps.event.trigger(map, 'markerClick', {
						marker: marker,
						stop: stop,
						hideShowRoutesLink: true
					});
				});
				markers.push(marker);

				var services = busStopsServices[stop];
				var servicesBounds = new google.maps.LatLngBounds();
				var html = '';

				var run = function(data, service){
					var d = data['1'];
					var stops = d.stops;

					// The stop could be in the second route instead and
					// could also be the last stop of the route, so choose the second route
					if (stops.indexOf(stop) == -1 || stops[stops.length-1] == stop){
						d = data['2'];
						stops = d.stops;
						if (stops.indexOf(stop) == -1){
							// Failsafe, if second route somehow doesn't have the stop for some reason
							d = data['1'];
							stops = d.stops;
						}
					}

					stops.forEach(function(stopNo){
						var stop = busStopsMap[stopNo];
						servicesBounds.extend(new google.maps.LatLng(stop.lat, stop.lng));
					});

					var routes = d.route;
					if (routes){
						var latlngs = [];
						var locations = [];

						for (var i=0, l=routes.length; i<l; i++){
							var coord = routes[i];
							var latlng = coord.split(',');
							var position = new google.maps.LatLng(parseFloat(latlng[0], 10), parseFloat(latlng[1], 10));
							latlngs.push(position);
						}
						var line = new google.maps.Polyline({
							strokeColor: '#f01b48',
							strokeWeight: 5,
							strokeOpacity: .4,
							path: latlngs,
							map: map
						});
						google.maps.event.addListener(line, 'mouseover', function(){
							$('#stop-service-' + service).trigger('mouseover').focus();
						});
						google.maps.event.addListener(line, 'mouseout', function(){
							$('#stop-service-' + service).trigger('mouseout').blur();
						});
						google.maps.event.addListener(line, 'click', function(){
							location.href = $('#stop-service-' + service).attr('href');
						});
						polylines[service] = line;

						html += '<li><a href="#/services/' + service + '" id="stop-service-' + service + '">'
							+ '<span class="tag">' + service + '</span> '+ busServicesMap[service].name
							+ '</a></li>';
					}
				};

				var q = queue();

				services.forEach(function(no){
					q.defer(function(callback){
						getData('busService-' + no, {no: no}, function(e, serviceData){
							run(serviceData, no);
							callback();
						});
					});
				});

				q.awaitAll(function(){
					map.fitBounds(servicesBounds);

					$('#bus-stop-routes-section').removeClass('loading');
					$('#bus-stop-routes').html('<ul>' + html + '</ul>');
				});
			})
			.init();

		$('#bus-routes').on('click', 'li a', function(e){
			e.preventDefault();
			var stopIndex = $(this).data('index');
			var marker = markers[stopIndex];
			if (!marker) return;
			var latlng = marker.getPosition();

			if (map.getZoom() < 15) map.setZoom(15);
			map.panTo(latlng);
			google.maps.event.trigger(marker, 'click');
			if (isSmallScreen) $('#header-sidebar').trigger('click');
		});

		$('#bus-stop-routes').on('mouseover touchstart', 'li a', function(){
			var serv = $(this).find('.tag').text();
			for (var service in polylines){
				var line = polylines[service];
				if (service == serv){
					line.setOptions({
						strokeOpacity: .8
					});
				} else {
					line.setOptions({
						strokeOpacity: .1
					});
				}
			}
		}).on('mouseout touchend touchcancel', 'li a', function(){
			for (var service in polylines){
				polylines[service].setOptions({
					strokeOpacity: .4
				});
			}
		});

		$(document).on('keyup', function(e){
			if (!(/services\/.+/i).test(location.hash)) return;
			if (e.target.tagName && e.target.tagName.toLowerCase() == 'input') return;
			var key = e.keyCode;
			switch (key){
				case 39:
				case 40:
					var $selected = $busRoutes.find('li a.selected');
					if (!$selected.length) return;
					$selected.removeClass('selected');
					var $nextLi = $selected.parent().next();
					if (!$nextLi.length) return;
					$nextLi.find('a').trigger('click');
					break;
				case 37:
				case 38:
					var $selected = $busRoutes.find('li a.selected');
					if (!$selected.length) return;
					$selected.removeClass('selected');
					var $prevLi = $selected.parent().prev();
					if (!$prevLi.length) return;
					$prevLi.find('a').trigger('click');
					break;
			}
		});

		$('#sidebar').on('click', function(e){
			var el = e.target;
			var tagName = el.tagName.toLowerCase();
			if (tagName == 'h1' || (tagName == 'b' && el.parentNode.tagName.toLowerCase() == 'h1')){
				e.preventDefault();
				$('body').toggleClass('sidebar-collapsed');
				setTimeout(function(){
					google.maps.event.trigger(map, 'resize');
				}, 300);
			}
		});
	};

	var q = queue();
	tasks.forEach(function(task){
		q.defer(task);
	});
	q.awaitAll(tasksDone);

	$('#logo').on('click', function(){
		$('body').toggleClass('header-collapsed');
	});
	$('#header-about').on('click', function(){
		$('#about').removeClass('hidden');
	});
	$('#header-search').on('click', function(){
		$('#search').removeClass('hidden');
		$('#places-search-form input').focus();
	});
	$('#intro .explore').on('click', function(){
		lscache.set('busrouter-intro', true);
		$('#intro').addClass('hidden');
	});
	$('#about .close').on('click', function(){
		$('#about').addClass('hidden');
	});
	$('#search .close').on('click', function(){
		$('#search').addClass('hidden');
	});

	$('#map').on('click', 'a.show-arrivals', function(e){
		e.preventDefault();
		var width = 320;
		var height = 480;
		var top = ((screen.availHeight || screen.height)-height)/2;
		var left = (screen.width-width)/2;
		window.open(this.href, 'busArrivals'+(new Date()), 'width=' + width + ',height=' + height + ',menubar=0,toolbar=0,top=' + top + ',left=' + left);
	});

	$('.share-buttons a').on('click', function(e){
		var el = e.target;
		if (el.href){
			e.preventDefault();
			var width = 500;
			var height = 300;
			var top = ((screen.availHeight || screen.height)-height)/2;
			var left = (screen.width-width)/2;
			window.open(el.href, 'window-' + Math.random(), 'width=' + width + ',height=' + height + ',menubar=0,toolbar=0,top=' + top + ',left=' + left);
		}
	});
})();
