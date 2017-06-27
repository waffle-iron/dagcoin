

angular.module('copayApp.services')
  .factory('fileStorageService', (lodash, $log) => {
    let root = {},
      _fs,
      _dir;

    root.init = function (cb) {
      if (_dir) return cb(null, _fs, _dir);

      function onFileSystemSuccess(fileSystem) {
        console.log('File system started: ', fileSystem.name, fileSystem.root.name);
        _fs = fileSystem;
        root.getDir((err, newDir) => {
          if (err || !newDir.nativeURL) return cb(err);
          _dir = newDir;
          $log.debug('Got main dir:', _dir.nativeURL);
          return cb(null, _fs, _dir);
        });
      }

      function fail(evt) {
        const msg = `Could not init file system: ${evt.target.error.code}`;
        console.log(msg);
        return cb(msg);
      }

      window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, onFileSystemSuccess, fail);
    };

    root.get = function (k, cb) {
      root.init((err, fs, dir) => {
        if (err) return cb(err);
        dir.getFile(k, {
          create: false,
        }, (fileEntry) => {
          if (!fileEntry) return cb();
          fileEntry.file((file) => {
            const reader = new FileReader();

            reader.onloadend = function (e) {
              if (this.result) { $log.debug('Read: ', this.result); }
              return cb(null, this.result);
            };

            reader.readAsText(file);
          });
        }, (err) => {
          // Not found
          if (err.code == 1) return cb();
          return cb(err);
        });
      });
    };

    root.set = function (k, v, cb) {
      root.init((err, fs, dir) => {
        if (err) return cb(err);
        dir.getFile(k, {
          create: true,
        }, (fileEntry) => {
          // Create a FileWriter object for our FileEntry (log.txt).
          fileEntry.createWriter((fileWriter) => {
            fileWriter.onwriteend = function (e) {
              console.log('Write completed.');
              return cb();
            };

            fileWriter.onerror = function (e) {
              const err = e.error ? e.error : JSON.stringify(e);
              console.log(`Write failed: ${err}`);
              return cb(`Fail to write:${err}`);
            };

            if (lodash.isObject(v)) { v = JSON.stringify(v); }

            if (!lodash.isString(v)) {
              v = v.toString();
            }

            $log.debug('Writing:', k, v);
            fileWriter.write(v);
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
      window.resolveLocalFileSystemURL(url, dir => cb(null, dir), (err) => {
        $log.warn(err);
        return cb(err || `Could not resolve filesystem:${url}`);
      });
    };

    root.remove = function (k, cb) {
      root.init((err, fs, dir) => {
        if (err) return cb(err);
        dir.getFile(k, {
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
