'use strict';

module.exports = function(grunt){

	grunt.registerTask('stats', 'Bus stops and services stats', function(){
		var servicesData = grunt.file.readJSON('data/2/bus-services.json');
		grunt.log.writeln('Bus services: ' + servicesData.services.length);

		var stopsData = grunt.file.readJSON('data/2/bus-stops.json');
		grunt.log.writeln('Bus stops: ' + stopsData.length);
	});

};