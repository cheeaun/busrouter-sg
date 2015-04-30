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
				files: {
					'js/scripts.js': [
						'assets/js/*.js'
					]
				}
			}
		},
		connect: {
			server: {
				options: {
					keepalive: true
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
				src: ['*.json', 'bus-services/*.json'],
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
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-aws');
	grunt.loadTasks('tasks');

};
