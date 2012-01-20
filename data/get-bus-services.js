#!/usr/bin/env node

var scraper = require('scraper');
var fs = require('fs');

scraper('http://publictransport.sg/content/publictransport/en/homepage/map.html', function(e, $){
	if (e) throw e;
	
	var data = {};
	var $busOption = $('#busservice_option');
	var $groups = $busOption.find('optgroup');
	$groups.each(function(){
		var $group = $(this);
		var label = $group.attr('label');
		data[label] = [];
		$group.find('option').each(function(){
			var $option = $(this);
			var d = $option.val().split('_')[1];
			if (!d) d = 1;
			data[label].push({
				no: $option.text(),
				dir: parseInt(d, 10)
			});
		});
	});
	fs.writeFile('bus-services.json', JSON.stringify(data), function(){
		console.log('bus-services.json created.');
	});
});