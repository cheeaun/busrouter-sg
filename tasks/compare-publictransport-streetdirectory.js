'use strict';

var needle = require('needle');
var cheerio = require('cheerio');

module.exports = function(grunt){

	grunt.registerTask('comparePTSD', 'Compare publictransport.sg to streetdirectory.com', function(){

		var data = grunt.file.readJSON('data/2/bus-services.json');
		var services = data.services.map(function(s){
			var service = s.no;
			return function(alldone){
				grunt.log.writeln(service);
				grunt.util.async.parallel([
					function(done){
						needle.head('http://www.publictransport.sg/content/publictransport/en/homepage/Ajax/map_ajaxlib.getBusRouteByServiceId.' + service + '.html', function(err, res){
							var len = parseInt(res.headers['content-length'], 10);
							var exists = len > 2000; // Exists when length is > 2K
							done(null, exists);
						});
					},
					function(done){
						needle.head('http://www.streetdirectory.com/asia_travel/mappage/ajax_new/get_bus_service_route.php?no=' + service + '&d=1&longlat=1', function(err, res){
							var len = res.headers['content-length'];
							var exists = len == undefined; // Exists when there's NO content-length (chunked)
							done(null, exists);
						});
					}
				], function(err, results){
					grunt.log.writeln('PT ' + results[0] + '  SD ' + results[1]);
					alldone();
				});
			}
		});

		var finish = this.async();
		grunt.util.async.series(services, finish);
	});

};