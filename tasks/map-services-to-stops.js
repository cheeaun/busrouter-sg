'use strict';

module.exports = function(grunt){

	grunt.registerTask('mapServicesStops', 'Map bus services to each bus stop', function(){
		var data = {};

		var servicesData = grunt.file.readJSON('data/2/bus-services.json');
		servicesData.services.forEach(function(service){
			var no = service.no;
			var serviceData = grunt.file.readJSON('data/2/bus-services/' + no + '.json');
			serviceData[1].stops.forEach(function(stop){
				if (!data[stop]) data[stop] = [];
				if (data[stop].indexOf(no) < 0) data[stop].push(no);
			});
			if (serviceData[2] && serviceData[2].stops && serviceData[2].stops.length){
				serviceData[2].stops.forEach(function(stop){
					if (!data[stop]) data[stop] = [];
					if (data[stop].indexOf(no) < 0) data[stop].push(no);
				});
			}
		});

		var file = 'data/2/bus-stops-services.json';
		grunt.file.write(file, JSON.stringify(data));
		grunt.log.writeln('File "' + file + '" generated.');
	});

};