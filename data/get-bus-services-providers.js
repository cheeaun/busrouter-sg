#!/usr/bin/env node

var fs = require('fs');
var async = require('async');
var request = require('request');

var json = fs.readFileSync('bus-services.json', 'ascii');
if (!json) console.log('bus-services.json not found');

var reqs = [];

var data = JSON.parse(json);
for (var type in data){
	var services = data[type];
	services.forEach(function(service){
		reqs.push(function(done){
			var no = service.no;
			request({
				url: 'http://www.smrtbuses.com.sg/ebusguide/busfrequency.asp?BusNo=' + no,
				method: 'HEAD',
				followRedirect: false
			}, function(e, response){
				if (e) throw e;
				if (response.statusCode == 200){
					service.provider = 'smrt';
					done(null, null);
				} else { // 302, assumed as bus number fail
					request({
						url: 'http://www.sbstransit.com.sg/journeyplan/servicedetails.aspx?serviceno=' + no,
						method: 'HEAD',
						followRedirect: false
					}, function(e, response){
						if (e) throw e;
						if (response.statusCode == 200 && parseInt(response.headers['content-length'], 10) > 1500){
							service.provider = 'sbs';
						} else {
							console.log(no + ' has no providers.');
						}
						done(null, null);
					});
				}
			});
		});
	});
}

async.parallel(reqs, function(e){
	fs.writeFile('bus-services.json', JSON.stringify(data), function(){
		console.log('bus-services.json recreated with providers data.');
	});
});