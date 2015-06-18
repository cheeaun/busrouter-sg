'use strict';

var path = require('path');
var swPrecache = require('sw-precache');

module.exports = function(grunt){

  grunt.registerMultiTask('swPrecache', function(){
    var done = this.async();
    var options = this.options();
    var rootDir = options.rootDir || '';
    var swFileName = 'service-worker.js';
    swPrecache.write(path.join(rootDir, swFileName), options, function(error) {
      if (error) grunt.fail.warn(error);
      done();
    });
  });

};
