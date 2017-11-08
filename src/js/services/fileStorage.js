(function () {
  'use strict';

  angular.module('copayApp.services')
  .factory('fileStorageService', (lodash, $log) => {
    const root = {};
    let fileSystem;
    let directory;

    root.init = function (cb) {
      if (directory) {
        return cb(null, fileSystem, directory);
      }

      function onFileSystemSuccess(fs) {
        console.log('File system started: ', fs.name, fs.root.name);
        fileSystem = fs;
        root.getDir((err, newDir) => {
          if (err || !newDir.nativeURL) return cb(err);
          directory = newDir;
          $log.debug('Got main dir:', directory.nativeURL);
          return cb(null, fileSystem, directory);
        });
      }

      function fail(evt) {
        const msg = `Could not init file system: ${evt.target.error.code}`;
        console.log(msg);
        return cb(msg);
      }

      return window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, onFileSystemSuccess, fail);
    };

    root.get = function (k, cb) {
      root.init((err, fs, dir) => {
        if (err) {
          return cb(err);
        }
        return dir.getFile(k, {
          create: false,
        }, (fileEntry) => {
          if (!fileEntry) {
            return cb();
          }
          return fileEntry.file((file) => {
            const reader = new FileReader();

            reader.onloadend = function () {
              if (this.result) {
                $log.debug('Read: ', this.result);
              }
              return cb(null, this.result);
            };

            reader.readAsText(file);
          });
        }, (error) => {
          // Not found
          if (error.code === 1) {
            return cb();
          }
          return cb(error);
        });
      });
    };

    root.set = function (k, v, cb) {
      root.init((err, fs, dir) => {
        if (err) {
          return cb(err);
        }
        return dir.getFile(k, {
          create: true,
        }, (fileEntry) => {
          // Create a FileWriter object for our FileEntry (log.txt).
          fileEntry.createWriter((fileWriter) => {
            fileWriter.onwriteend = function () {
              console.log('Write completed.');
              return cb();
            };

            fileWriter.onerror = function (e) {
              const error = e.error ? e.error : JSON.stringify(e);
              console.log(`Write failed: ${error}`);
              return cb(`Fail to write:${error}`);
            };
            let val = v;
            if (lodash.isObject(val)) {
              val = JSON.stringify(val);
            }

            if (!lodash.isString(val)) {
              val = val.toString();
            }

            $log.debug('Writing:', k, val);
            fileWriter.write(val);
          }, cb);
        }, cb);
      });
    };


    // See https://github.com/apache/cordova-plugin-file/#where-to-store-files
    root.getDir = function (cb) {
      if (!cordova.file) {
        return cb('Could not write on device storage');
      }

      const url = cordova.file.dataDirectory;
      // This could be needed for windows
      // if (cordova.file === undefined) {
      //   url = 'ms-appdata:///local/';
      return window.resolveLocalFileSystemURL(url, dir => cb(null, dir), (err) => {
        $log.warn(err);
        return cb(err || `Could not resolve filesystem:${url}`);
      });
    };

    root.remove = function (k, cb) {
      root.init((err, fs, dir) => {
        if (err) {
          return cb(err);
        }
        return dir.getFile(k, {
          create: false,
        }, (fileEntry) => {
          // Create a FileWriter object for our FileEntry (log.txt).
          fileEntry.remove(() => {
            console.log('File removed.');
            return cb();
          }, cb);
        }, cb);
      });
    };

    /**
     * Same as setItem, but fails if an item already exists
     */
    root.create = function (name, value, callback) {
      root.get(name,
        (err, data) => {
          if (data) {
            return callback('EEXISTS');
          }
          return root.set(name, value, callback);
        });
    };

    return root;
  });
}());
