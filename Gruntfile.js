module.exports = function(grunt) {

	var awsCreds;
	try{
		awsCreds = grunt.file.readJSON('aws-credentials.json')
	} catch(e){}

 	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			options: {
				sourceMap: true,
				maxLineLen: 500,
				screwIE8: true
			},
			scripts: {
				files: [{
					src: [
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
		svg_sprite: {
			options: {
				mode: {
					symbol: {
						inline: true
					}
				}
			},
			icons: {
				expand: true,
				cwd: 'assets/svg',
				src: ['*.svg'],
				dest: 'assets/svg_sprite'
			}
		},
		inline: {
			options: {
				cssmin: true,
				uglify: true
			},
			index: {
				src: 'assets/html/index.html',
				dest: 'index.html'
			},
			arrival: {
				src: 'assets/html/arrival.html',
				dest: 'bus-arrival/index.html'
			}
		},
		watch: {
			scripts: {
				files: 'assets/js/*.js',
				tasks: ['uglify']
			},
			svg_sprite: {
				files: 'assets/svg/*.svg',
				tasks: ['svg_sprite']
			},
			index: {
				files: ['assets/html/index.html', 'assets/css/style.css', 'assets/svg_sprite/**/*.svg'],
				tasks: ['inline:index']
			},
			arrival: {
				files: ['assets/html/arrival.html', 'assets/css/arrival.css', 'assets/js/lscache.js', 'assets/js/arrival.js'],
				tasks: ['inline:arrival']
			}
		},
		connect: {
			server: {
				options: {
					middleware: function(connect, options, middlewares){
						middlewares.unshift(function(req, res, next){
							if (grunt.option('service-worker')){
								return next();
							}
							if (/service-worker\.js/i.test(req.url)){
								grunt.log.writeln('service-worker.js returns 404');
								res.writeHead(404, {'content-type': 'text/plain'});
								res.end();
							}
							return next();
						});
						return middlewares;
					}
				}
			}
		},
		swPrecache: {
			production: {
				options: {
					staticFileGlobs: [
						'js/scripts.js',
						'index.html',
						'bus-arrival/index.html'
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
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-inline');
	grunt.loadNpmTasks('grunt-svg-sprite');
	grunt.loadNpmTasks('grunt-aws');
	grunt.loadTasks('tasks');

	grunt.registerTask('server', ['connect', 'watch']);
};
