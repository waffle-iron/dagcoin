module.exports = (config) => {
  config.set({

    basePath: '..',
    frameworks: ['jasmine'],
    files: [
      'bower_components/angular/angular.js', // angular
      'bower_components/angular-mocks/angular-mocks.js', // angular mocks
      'src/js/app.js',
      'test/**/*.test.js'
    ],

    exclude: [
      'src/js/translations.js',
      'src/js/version.js',
      'test/karma.conf.js',
      'test/old/*',
    ],

    preprocessors: {
      'src/js/**/*.js': ['babel', 'coverage'],
      'test/**/*.js': ['babel'],
    },
    babelPreprocessor: {
      options: {
        presets: ['es2015'], // use the es2015 preset
        sourceMap: 'inline', // inline source maps inside compiled files
      },
      filename: (file) => {
        return file.originalPath.replace(/\.js$/, '.es5.js');
      },
      sourceFileName: (file) => {
        return file.originalPath;
      },
    },

    reporters: ['progress', 'coverage'],
    coverageReporter: {
      dir: 'coverage/',
      reporters: [{
        type: 'html',
        subdir: 'report-html',
      }, {
        type: 'lcov',
        subdir: 'report-lcov',
      }, {
        type: 'text-summary',
      }],
    },

    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['NodeWebkit'],
    singleRun: false,
  });
};
