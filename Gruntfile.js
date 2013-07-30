module.exports = function(grunt) {

 	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			scripts: {
				options: {
					sourceMap: 'js/scripts.js.map',
					sourceMappingURL: 'scripts.js.map'
				},
				files: {
					'js/scripts.js': [
						'assets/js/zepto/zepto.js',
						'assets/js/zepto/event.js',
						'assets/js/zepto/ajax.js',
						'assets/js/*.js'
					]
				}
			}
		},
		connect: {
			server: {
				options: {
					keepalive: true,
					hostname: null
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadTasks('tasks');

};