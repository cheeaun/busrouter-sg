module.exports = function(grunt) {

	var awsCreds;
	try{
		awsCreds = grunt.file.readJSON('aws-credentials.json')
	} catch(e){}

 	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			scripts: {
				options: {
					sourceMap: true,
					beautify: {
						max_line_len: 500,
						screw_ie8: true
					}
				},
				files: [{
					src: [
						'assets/js/classlist.js',
						'assets/js/lscache.js',
						'assets/js/queue.js',
						'assets/js/ruto.js',
						'assets/js/yokuto.js',
						'assets/js/app.js'
					],
					dest: 'js/scripts.js'
				}]
			}
		},
		cssmin: {
			css: {
				files: {
					'assets/css/style.min.css': ['assets/css/style.css']
				}
			}
		},
		watch: {
			scripts: {
				files: 'assets/js/*.js',
				tasks: ['uglify']
			},
			styles: {
				files: 'assets/css/style.css',
				tasks: ['cssmin']
			}
		},
		connect: {
			server: {
			}
		},
		swPrecache: {
			production: {
				options: {
					staticFileGlobs: [
						'js/scripts.js',
						'assets/css/style.min.css',
						'assets/images/bus-sprite.png',
						'assets/images/loader-large.gif',
						'**.html'
					]
				}
			}
		},
		aws: awsCreds,
		s3: {
			options: {
				accessKeyId: '<%= aws.accessKeyId %>',
				secretAccessKey: '<%= aws.secretAccessKey %>',
				bucket: 'busrouter-sg',
				region: 'ap-southeast-1',
				sslEnabled: false
			},
			data: {
				options: {
					headers: {
						CacheControl: 21600 // 6 hours, in seconds
					}
				},
				cwd: 'data/2/',
				src: ['*.json', '*.geojson', '*.kml', 'bus-services/*.json'],
				dest: 'v2/'
			},
			js: {
				options: {
					headers: {
						CacheControl: 43200 // 12 hours, in seconds
					}
				},
				src: 'js/gzip-enabled.js',
				dest: 'js/gzip-enabled.js'
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-aws');
	grunt.loadTasks('tasks');

	grunt.registerTask('server', ['connect', 'watch']);
};
