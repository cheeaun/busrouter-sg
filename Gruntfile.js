module.exports = function(grunt) {

 	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			scripts: {
				options: {
					sourceMap: 'js/scripts.js.map'
				},
				files: {
					'js/scripts.js': ['assets/js/*.js']
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