#!/usr/bin/env node

var fs = require('fs');

var json = fs.readFileSync('bus-stops.json', 'ascii');
if (!json) console.log('bus-stops.json not found');

var data = JSON.parse(json);
var count = 0;
for (var i in data){
	count++;
}
console.log(count + ' bus stops');