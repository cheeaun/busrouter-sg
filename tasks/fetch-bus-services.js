// Fetch all bus services

const fs = require('fs');
const needle = require('needle');
const cheerio = require('cheerio');
const async = require('async');
const _ = require('lodash');

async.parallel([
	function(done){
		console.log('Request to mytransport.sg');
		needle.get('https://www.mytransport.sg/content/mytransport/map.html', function(err, res, body){
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
		console.log('Request to transitlink.com.sg');
		needle.get('http://www.transitlink.com.sg/eservice/eguide/service_idx.php', function(err, res, body){
			var $ = cheerio.load(body);

			var data = {};

			$('form[name=frmservice] dl dt').each(function(){
				var dt = $(this);
				var type = (dt.text().match(/sbs|smrt|(tower transit)|(go-ahead)/i) || [null])[0].toLowerCase();

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
		var serviceNo = service.no;
		var serviceNoInt = parseInt(service.no, 10) + '';
		service.operator = data2[serviceNo] || data2[serviceNoInt] || null;
	});

	const dataNos = _.map(data.services, function(service){
		return service.no;
	});
	const data2Nos = _.map(data2, function(v, k){
		return k;
	});

	var diff1 = _.difference(dataNos, data2Nos);
	var diff2 = _.difference(data2Nos, dataNos);
	console.log('Diff (not listed on transitlink.com.sg):\n' + diff1.join(', '));
	console.log('Diff (not listed mytransport.sg):\n' + diff2.join(', '));

	var file = 'data/2/bus-services.json';
	fs.writeFileSync(file, JSON.stringify(data));
	console.log('File "' + file + '" generated.');
});
