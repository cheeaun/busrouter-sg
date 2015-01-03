'use strict';

var needle = require('needle');
var cheerio = require('cheerio');

module.exports = function(grunt){

	grunt.registerTask('fetchBusServices', 'Fetch all bus services', function(){

		var finish = this.async();

		grunt.util.async.parallel([
			function(done){
				grunt.log.writeln('Request to mytransport.sg');
				needle.get('http://www.mytransport.sg/content/mytransport/map.html', function(err, res, body){
					var $ = cheerio.load(body);

					var data = {
						types: {},
						services: []
					};

					var labelIndex = -1;
					$('#busservice_option optgroup').each(function(){
						var optgroup = $(this);
						var label = optgroup.attr('label').trim();
						data.types[++labelIndex] = label;

						optgroup.find('option[value]').each(function(){
							var option = $(this);
							data.services.push({
								no: option.text().trim(),
								routes: parseInt(option.attr('value').trim().match(/[0-9]$/)[0], 10),
								type: ''+labelIndex
							});
						});
					});

					done(null, data);
				});
			},
			function(done){
				grunt.log.writeln('Request to transitlink.com.sg');
				needle.get('http://www.transitlink.com.sg/eservice/eguide/service_idx.php', function(err, res, body){
					var $ = cheerio.load(body);

					var data = {};

					$('form[name=frmservice] dl dt').each(function(){
						var dt = $(this);
						var type = (dt.text().match(/sbs|smrt/i) || [null])[0].toLowerCase();

						dt.next().find('select option[value]').each(function(){
							var option = $(this);
							var value = option.attr('value').trim();
							if (value && value != '-'){
								value = value.replace(/#$/, 'C'); // E.g. 853# == 853C
								data[value] = type;
							}
						});
					});

					done(null, data);
				});
			}
		], function(err, results){
			var data = results[0];
			var data2 = results[1];

			data.services.forEach(function(service){
				service.operator = data2[service.no] || null;
			});

			var _ = grunt.util._;
			var diff = _.difference(_.map(data.services, function(service){
				return service.no;
			}), _.map(data2, function(v, k){
				return k;
			}));
			console.log('Diff between both sites: ' + diff.join(', '));

			var file = 'data/2/bus-services.json';
			grunt.file.write(file, JSON.stringify(data));
			grunt.log.writeln('File "' + file + '" generated.');

			finish();
		});

	});

};