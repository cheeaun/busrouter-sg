'use strict';
var _ = require('lodash');

module.exports = function(grunt){

	grunt.registerTask('populateServicesName', 'Populate services with some sort of name to easily identify them', function(){
		var data = {};

		var file = 'data/2/bus-services.json';
		var servicesData = grunt.file.readJSON(file);
		var stopsData = grunt.file.readJSON('data/2/bus-stops.json');

		servicesData.services.forEach(function(service){
			var no = service.no;
			var serviceData = grunt.file.readJSON('data/2/bus-services/' + no + '.json');
			var stops = serviceData[1].stops;
			if (stops.length){
				var firstStop = _.filter(stopsData, {no: stops[0]})[0].name;
				var lastStop = _.filter(stopsData, {no: stops[stops.length-1]})[0].name;
				service.name = (firstStop == lastStop) ? firstStop : (firstStop + ' - ' + lastStop);
			}
		});

		// Remove services that has no stops
		servicesData.services = servicesData.services.filter(function(service){
			var no = service.no;
			var serviceData = grunt.file.readJSON('data/2/bus-services/' + no + '.json');
			var stops = serviceData[1].stops;
			if (!stops.length) grunt.log.writeln('Bus service with no stops: ' + no);
			return !!stops.length;
		});

		grunt.file.write(file, JSON.stringify(servicesData));
		grunt.log.writeln('File "' + file + '" modified with names.');
	});

};
