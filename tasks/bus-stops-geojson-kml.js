'use strict';
var tokml = require('tokml');

module.exports = function(grunt){

	grunt.registerTask('busStopsGeoJSONKML', 'Bus stops GeoJSON', function(){
		var stopsData = grunt.file.readJSON('data/2/bus-stops.json');
    var geojson = {
      type: 'FeatureCollection',
      features: []
    };

    stopsData.forEach(function(stop){
      geojson.features.push({
        type: 'Feature',
        properties: {
          number: stop.no,
          name: stop.name
        },
        geometry: {
          type: 'Point',
          coordinates: [ parseFloat(stop.lng, 10), parseFloat(stop.lat, 10) ]
        }
      });
    });

    var geojsonFile = 'data/2/bus-stops.geojson';
    grunt.file.write(geojsonFile, JSON.stringify(geojson));
    grunt.log.writeln('File "' + geojsonFile + '" generated.');

		var kml = tokml(geojson, {
			name: 'number',
			description: 'name'
		});
		var kmlFile = 'data/2/bus-stops.kml';
    grunt.file.write(kmlFile, kml);
    grunt.log.writeln('File "' + kmlFile + '" generated.');
	});

};
