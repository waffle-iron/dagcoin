(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('importController',
    function ($scope, $rootScope, $location, $timeout, $log, storageService, fileSystemService, isCordova, isMobile) {
      const JSZip = require('jszip');
      const async = require('async');
      const crypto = require('crypto');
      const conf = require('byteballcore/conf');
      const userAgent = navigator.userAgent;
      let zip;
      let unzip;
      if (isCordova) {
        zip = new JSZip();
      } else {
        unzip = require('unzip');
      }

      const self = this;
      self.imported = false;
      self.password = '';
      self.error = '';
      self.iOs = isMobile.iOS();
      self.android = isMobile.Android();
      self.arrBackupFiles = [];
      self.androidVersion = isMobile.Android() ? parseFloat(userAgent.slice(userAgent.indexOf('Android') + 8)) : null;
      self.oldAndroidFilePath = null;
      self.oldAndroidFileName = '';

      function generateListFilesForIos() {
        const backupDirPath = `${window.cordova.file.documentsDirectory}/Byteball/`;
        fileSystemService.readdir(backupDirPath, (err, listFilenames) => {
          if (listFilenames) {
            listFilenames.forEach((name) => {
              const dateNow = parseInt(name.split(' ')[1], 10);
              self.arrBackupFiles.push({
                name: name.replace(dateNow, new Date(dateNow).toLocaleString()),
                originalName: name,
                time: dateNow,
              });
            });
          }
          $timeout(() => {
            $rootScope.$apply();
          });
        });
      }

      if (self.iOs) generateListFilesForIos();

      function writeDBAndFileStorageMobile(zipfiles, cb) {
        const db = require('byteballcore/db');
        const dbDirPath = `${fileSystemService.getDatabaseDirPath()}/`;
        db.close(() => {
          async.forEachOfSeries(zipfiles.files, (objFile, key, callback) => {
            if (key === 'profile') {
              zipfiles.file(key).async('string').then((data) => {
                storageService.storeProfile(Profile.fromString(data), callback);
              });
            } else if (key === 'config') {
              zipfiles.file(key).async('string').then((data) => {
                storageService.storeConfig(data, callback);
              });
            } else if (/\.sqlite/.test(key)) {
              zipfiles.file(key).async('nodebuffer').then((data) => {
                fileSystemService.cordovaWriteFile(dbDirPath, null, key, data, callback);
              });
            } else {
              callback();
            }
          }, (err) => {
            if (err) return cb(err);
            return cb();
          });
        });
      }

      function writeDBAndFileStoragePC(cb) {
        const db = require('byteballcore/db');
        const dbDirPath = `${fileSystemService.getDatabaseDirPath()}/`;
        db.close(() => {
          async.series([
            function (callback) {
              fileSystemService.readFile(`${dbDirPath}temp/profile`, (err, data) => {
                if (err) {
                  return callback(err);
                }
                return storageService.storeProfile(Profile.fromString(data.toString()), callback);
              });
            },
            function (callback) {
              fileSystemService.readFile(`${dbDirPath}temp/config`, (err, data) => {
                if (err) {
                  return callback(err);
                }
                return storageService.storeConfig(data.toString(), callback);
              });
            },
            function (callback) {
              fileSystemService.readdir(`${dbDirPath}temp/`, (err, fileNames) => {
                const names = fileNames.filter(name => /\.sqlite/.test(name));
                async.forEach(names, (name, callback2) => {
                  fileSystemService.nwMoveFile(`${dbDirPath}temp/${name}`, dbDirPath + name, callback2);
                }, (error) => {
                  if (error) {
                    return callback(error);
                  }
                  return callback();
                });
              });
            },
            function (callback) {
              const existsConfJson = fileSystemService.nwExistsSync(`${dbDirPath}temp/conf.json`);
              const existsLight = fileSystemService.nwExistsSync(`${dbDirPath}temp/light`);
              if (existsConfJson) {
                fileSystemService.nwMoveFile(`${dbDirPath}temp/conf.json`, `${dbDirPath}conf.json`, callback);
              } else if (existsLight && !existsConfJson) {
                fileSystemService.nwWriteFile(`${dbDirPath}conf.json`, JSON.stringify({ bLight: true }, null, '\t'), callback);
              } else if (!existsLight && conf.bLight) {
                const config = require(`${dbDirPath}conf.json`);
                config.bLight = false;
                fileSystemService.nwWriteFile(`${dbDirPath}conf.json`, JSON.stringify(config, null, '\t'), callback);
              } else {
                callback();
              }
            },
            function (callback) {
              fileSystemService.readdir(`${dbDirPath}temp/`, (err, fileNames) => {
                async.forEach(fileNames, (name, callback2) => {
                  fileSystemService.nwUnlink(`${dbDirPath}temp/${name}`, callback2);
                }, (fileSystemServiceError) => {
                  if (fileSystemServiceError) {
                    return callback(fileSystemServiceError);
                  }
                  return fileSystemService.nwRmDir(`${dbDirPath}temp/`, () => {
                    callback();
                  });
                });
              });
            },
          ], (err) => {
            cb(err);
          });
        });
      }

      function decrypt(buffer, password) {
        const bufferPassword = Buffer.from(password);
        const decipher = crypto.createDecipheriv('aes-256-ctr', crypto.pbkdf2Sync(bufferPassword, '', 100000, 32, 'sha512'), crypto.createHash('sha1').update(bufferPassword).digest().slice(0, 16));
        const arrChunks = [];
        const CHUNK_LENGTH = 2003;
        for (let offset = 0; offset < buffer.length; offset += CHUNK_LENGTH) {
          arrChunks.push(decipher.update(buffer.slice(offset, Math.min(offset + CHUNK_LENGTH, buffer.length)), 'utf8'));
        }
        arrChunks.push(decipher.final());
        return Buffer.concat(arrChunks);
      }

      function showError(text) {
        self.imported = false;
        self.error = text;
        $timeout(() => {
          $rootScope.$apply();
        });
        return false;
      }

      function unzipAndWriteFiles(data, password) {
        if (isCordova) {
          zip.loadAsync(decrypt(data, password)).then((zippedFile) => {
            if (!zippedFile.file('light')) {
              self.imported = false;
              self.error = 'Mobile version supports only light wallets.';
              $timeout(() => {
                $rootScope.$apply();
              });
            } else {
              writeDBAndFileStorageMobile(zippedFile, (err) => {
                if (err) {
                  return showError(err);
                }
                self.imported = false;
                return $rootScope.$emit('Local/ShowAlert', 'Import successfully completed, please restart the application.', 'fi-check', () => {
                  if (navigator && navigator.app) {
                    navigator.app.exitApp();
                  } else if (process.exit) {
                    process.exit();
                  }
                });
              });
            }
          }, (err) => {
            showError('Incorrect password or file');
            console.log('Incorrect password or file', err);
          });
        } else {
          const bufferPassword = Buffer.from(password);
          const decipher = crypto.createDecipheriv('aes-256-ctr', crypto.pbkdf2Sync(bufferPassword, '', 100000, 32, 'sha512'), crypto.createHash('sha1').update(bufferPassword).digest().slice(0, 16));
          data.pipe(decipher).pipe(unzip.Extract({ path: `${fileSystemService.getDatabaseDirPath()}/temp/` })).on('error', (err) => {
            if (err.message === 'Invalid signature in zip file') {
              showError('Incorrect password or file');
            } else {
              showError(err);
            }
          }).on('finish', () => {
            setTimeout(() => {
              writeDBAndFileStoragePC((err) => {
                if (err) {
                  return showError(err);
                }
                self.imported = false;
                return $rootScope.$emit('Local/ShowAlert', 'Import successfully completed, please restart the application.', 'fi-check', () => {
                  if (navigator && navigator.app) {
                    navigator.app.exitApp();
                  } else if (process.exit) {
                    process.exit();
                  }
                });
              });
            }, 100);
          });
        }
      }

      self.oldAndroidInputFileClick = function () {
        window.plugins.mfilechooser.open([], (uri) => {
          self.oldAndroidFilePath = `file://${uri}`;
          self.oldAndroidFileName = uri.split('/').pop();
          $timeout(() => {
            $rootScope.$apply();
          });
        }, (error) => {
          alert(error);
        });
      };

      self.walletImport = function () {
        self.imported = true;
        self.error = '';
        if (isMobile.Android() && self.androidVersion < 5) {
          fileSystemService.readFile(self.oldAndroidFilePath, (err, data) => {
            unzipAndWriteFiles(data, self.password);
          });
        } else {
          fileSystemService.readFileFromForm($scope.file, (err, data) => {
            if (err) {
              return showError(err);
            }
            return unzipAndWriteFiles(data, self.password);
          });
        }
      };

      self.iosWalletImportFromFile = function (fileName) {
        $rootScope.$emit('Local/NeedsPassword', false, null, (err, password) => {
          if (password) {
            const backupDirPath = `${window.cordova.file.documentsDirectory}/Byteball/`;
            fileSystemService.readFile(backupDirPath + fileName, (fileSystemServiceError, data) => {
              if (fileSystemServiceError) {
                return showError(fileSystemServiceError);
              }
              return unzipAndWriteFiles(data, password);
            });
          }
        });
      };

      $scope.getFile = function () {
        $timeout(() => {
          $rootScope.$apply();
        });
      };
    });
}());
