self.addEventListener('install', function(event){
	console.log('Install');
});

self.addEventListener('activate', function(event){
	console.log('Activate');
});

var cacheName = 'busroutersg-v1';
// caches.delete('busroutersg-v1'); // Delete the old one
var successResponses = /^0|([123]\d\d)|(40[14567])|410$/;

function fetchAndCache(request){
	return fetch(request.clone()).then(function(response){
		if (request.method == 'GET' && response && successResponses.test(response.status) && (response.type == 'basic' && !/\.json$/.test(request.url) || /\.(js|png|ttf|woff|woff2)$/i.test(request.url) || /fonts\.googleapis\.com/i.test(request.url))){
			console.log('Cache', request.url);
			caches.open(cacheName).then(function(cache){
				cache.put(request, response);
			});
		}
		return response.clone();
	});
};

function cacheOnly(request){
	return caches.open(cacheName).then(function(cache){
		return cache.match(request);
	});
};

// Fastest strategy from https://github.com/GoogleChrome/sw-toolbox
self.addEventListener('fetch', function(event){
	var request = event.request;
	var url = request.url;
	event.respondWith(new Promise(function(resolve, reject){
		var rejected = false;
		var reasons = [];

		var maybeReject = function(reason){
			reasons.push(reason.toString());
			if (rejected){
				reject(new Error('Both cache and network failed: "' + reasons.join('", "') + '"'));
			} else {
				rejected = true;
			}
		};

		var maybeResolve = function(result){
			if (result instanceof Response){
				resolve(result);
			} else {
				maybeReject('No result returned');
			}
		};

		fetchAndCache(request.clone()).then(maybeResolve, maybeReject);
		cacheOnly(request).then(maybeResolve, maybeReject);
	}));
});
