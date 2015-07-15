var $arrivals = document.getElementById('arrivals');
var arrivalsTimeout;
var xhr = new XMLHttpRequest();
var showArrivals = function(id){
	if (document.hidden || document.visibilityState == 'hidden'){
		// Don't make any AJAX calls when page is not even visible
		arrivalsTimeout = setTimeout(function(){
			showArrivals(id);
		}, 2.5*1000); // 2.5 seconds
		return;
	}
	xhr.open('get', 'https://arrivelah.herokuapp.com/?id=' + id, true);
	xhr.onload = function(){
		$arrivals.classList.remove('fading');
		var result = JSON.parse(this.responseText);
		if (!result || result.error) return;
		$arrivals.innerHTML = result.services.sort(function(a, b){
			if (a.next.duration_ms == null) return 1;
			if (b.next.duration_ms == null) return -1;
			return a.next.duration_ms - b.next.duration_ms;
		}).map(function(service){
			return '<tr>'
					+ '<th>' + service.no + '</th>'
					+ '<td>' + timeDisplay(service.next.duration_ms) + '</td>'
					+ '<td>' + timeDisplay(service.subsequent.duration_ms) + '</td>'
				+ '</tr>';
		}).join('');
		arrivalsTimeout = setTimeout(function(){
			showArrivals(id);
		}, 15*1000); // 15 seconds
	};
	xhr.onerror = function(){ // Retry if error
		arrivalsTimeout = setTimeout(function(){
			showArrivals(id);
		}, 5*1000); // 5 seconds
	}
	xhr.send();
	$arrivals.classList.add('fading');
};

var timeDisplay = function(ms){
	if (ms == null) return '<span class="insignificant">Unavailable</span>';
	var mins = Math.ceil(ms/1000/60);
	if (mins <= 0) return 'Now';
	if (mins == 1) return mins + ' min';
	return mins + ' mins';
};

var rootEndPoints = {
	github: '../data/2/',
	s3: 'https://busrouter-sg.s3-ap-southeast-1.amazonaws.com/v2/'
};
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
		var useS3 = 'withCredentials' in xhr && typeof GZIP_ENABLED != 'undefined' && GZIP_ENABLED;
		var endPoint = rootEndPoints[useS3 ? 's3' : 'github'] + dataEndPoints[key.split('-')[0]];
		for (p in params) endPoint = endPoint.replace('{{' + p + '}}', params[p]);
		if (useS3) endPoint += '?' + (+new Date());
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

getData('busStops', function(error, stops){
	var stopsMap = stops.reduce(function(map, obj){
		map[obj.no] = obj;
		return map;
	}, {});

	window.onhashchange = function(){
		var hash = location.hash.slice(1);
		var stop = stopsMap[hash];
		clearTimeout(arrivalsTimeout);

		if (hash && stop){
			var coords = stop.lat + ',' + stop.lng;
			var name = hash + ' - ' + stop.name;
			document.title = 'Bus arrival times for ' + name;
			document.getElementById('bus-stop-name').innerHTML = name;
			document.getElementById('bus-stop-heading').style.backgroundImage = ''
				+ 'url(https://maps.googleapis.com/maps/api/staticmap?'
					+ [
						'key=AIzaSyDJii3LssFIl3cw4XzTxtWqSls57rayV5I',
						'center=' + coords,
						'zoom=16',
						'scale=2',
						'size=480x240',
						'maptype=roadmap',
						'format=png'
					].join('&')
				+ ')';
			showArrivals(hash);
		} else {
			alert('Invalid bus stop code.');
		}
	}
	window.onhashchange();
});
