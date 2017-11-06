(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('exportController',
    function ($rootScope, $scope, $timeout, $log, backupService, storageService, fileSystemService, isCordova, isMobile, gettextCatalog, notification) {
      const async = require('async');
      const crypto = require('crypto');
      const conf = require('byteballcore/conf');
      let jsZip;
      let Zip;
      if (isCordova) {
        const JSZip = require('jszip');
        jsZip = new JSZip();
      } else {
        Zip = require('zip');
        jsZip = null;
      }

      const self = this;
      self.error = null;
      self.passError = null;
      self.success = null;
      self.password = null;
      self.repeatpassword = null;
      self.exporting = false;
      self.isCordova = isCordova;
      self.bCompression = false;
      self.connection = null;

      function addDBAndConfToZip(cb) {
        const dbDirPath = `${fileSystemService.getDatabaseDirPath()}/`;
        fileSystemService.readdir(dbDirPath, (err, listFilenames) => {
          if (err) {
            return cb(err);
          }
          const fileNameList = listFilenames.filter(name => (name === 'conf.json' || /\.sqlite/.test(name)));
          if (isCordova) {
            return async.forEachSeries(fileNameList, (name, callback) => {
              fileSystemService.readFile(`${dbDirPath}/${name}`, (fileSystemServiceError, data) => {
                if (fileSystemServiceError) {
                  return callback(fileSystemServiceError);
                }
                jsZip.file(name, data);
                return callback();
              });
            }, cb);
          }
          return async.forEachSeries(fileNameList, (name, callback) => {
            fileSystemService.getPath(`${dbDirPath}/${name}`, (fileSystemServiceErr, path) => {
              if (fileSystemServiceErr) {
                return callback(fileSystemServiceErr);
              }
              jsZip.file(name, path);
              return callback();
            });
          }, cb);
        });
      }

      function checkValueFileAndChangeStatusExported() {
        $timeout(() => {
          const inputFile = document.getElementById('nwExportInputFile');
          if (!inputFile.value && self.exporting) {
            self.exporting = false;
            $timeout(() => {
              $rootScope.$apply();
            });
          }
          if (!inputFile.value && self.connection) {
            self.connection.release();
            self.connection = false;
          }
          window.removeEventListener('focus', checkValueFileAndChangeStatusExported, true);
        }, 1000);
      }


      function saveFile(file, cb) {
        const backupFilename = `Dagcoin${Date.now()}.encrypted`;
        if (!isCordova) {
          const inputFile = document.getElementById('nwExportInputFile');
          inputFile.setAttribute('nwsaveas', backupFilename);
          inputFile.click();
          window.addEventListener('focus', checkValueFileAndChangeStatusExported, true);
          inputFile.onchange = function () {
            cb(this.value);
          };
        } else {
          fileSystemService.cordovaWriteFile((isMobile.iOS() ? window.cordova.file.documentsDirectory : window.cordova.file.externalRootDirectory), 'Byteball', backupFilename, file, (err) => {
            cb(err);
          });
        }
      }

      function encrypt(buffer, password) {
        const bufferPassword = Buffer.from(password);
        const cipher = crypto.createCipheriv('aes-256-ctr', crypto.pbkdf2Sync(bufferPassword, '', 100000, 32, 'sha512'), crypto.createHash('sha1').update(bufferPassword).digest().slice(0, 16));
        const arrChunks = [];
        const CHUNK_LENGTH = 2003;
        for (let offset = 0; offset < buffer.length; offset += CHUNK_LENGTH) {
          arrChunks.push(cipher.update(buffer.slice(offset, Math.min(offset + CHUNK_LENGTH, buffer.length)), 'utf8'));
        }
        arrChunks.push(cipher.final());
        return Buffer.concat(arrChunks);
      }

      function showError(text) {
        self.exporting = false;
        self.error = text;
        $timeout(() => {
          $rootScope.$apply();
        });
        return false;
      }

      self.walletExportPC = function (connection) {
        self.connection = connection;
        saveFile(null, (path) => {
          if (!path) return;
          const cipher = crypto.createCipher('aes-256-ctr', self.password);
          jsZip = new Zip(path, {
            compressed: self.bCompression ? 6 : 0,
            cipher,
          });
          storageService.getProfile((err, profile) => {
            storageService.getConfig((storageServiceError, config) => {
              if (storageServiceError) {
                return showError(storageServiceError);
              }
              jsZip.text('profile', JSON.stringify(profile));
              jsZip.text('config', config);
              if (conf.bLight) {
                jsZip.text('light', 'true');
              }
              return addDBAndConfToZip((addDBAndConfToZipError) => {
                if (addDBAndConfToZipError) {
                  return showError(addDBAndConfToZipError);
                }
                return jsZip.end(() => {
                  connection.release();
                  self.connection = null;
                  self.exporting = false;
                  $timeout(() => {
                    $rootScope.$apply();
                    notification.success(gettextCatalog.getString('Success'), gettextCatalog.getString('Export completed successfully', {}));
                  });
                });
              });
            });
          });
        });
      };

      self.walletExportCordova = function (connection) {
        storageService.getProfile((err, profile) => {
          storageService.getConfig((getConfigError, config) => {
            if (getConfigError) {
              return showError(getConfigError);
            }
            jsZip.file('profile', JSON.stringify(profile));
            jsZip.file('config', config);
            jsZip.file('light', 'true');
            return addDBAndConfToZip((addDBAndConfToZipErr) => {
              if (addDBAndConfToZipErr) {
                return showError(addDBAndConfToZipErr);
              }
              const zipParams = { type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } };
              return jsZip.generateAsync(zipParams).then((zipFile) => {
                saveFile(encrypt(zipFile, self.password), (encryptError) => {
                  connection.release();
                  if (encryptError) {
                    return showError(encryptError);
                  }
                  self.exporting = false;
                  return $timeout(() => {
                    $rootScope.$apply();
                    notification.success(gettextCatalog.getString('Success'), gettextCatalog.getString('Export completed successfully', {}));
                  });
                });
              }, (generateAsyncError) => {
                showError(generateAsyncError);
              });
            });
          });
        });
      };

      self.walletExport = function () {
        self.error = '';
        if (!self.password) {
          self.passError = 'Please enter password';
        } else if (self.password !== self.repeatpassword) {
          self.passError = 'These passwords don\'t match';
        } else {
          self.passError = '';
        }
        if (self.passError) {
          return;
        }
        self.exporting = true;
        const db = require('byteballcore/db');
        db.takeConnectionFromPool((connection) => {
          if (isCordova) {
            self.walletExportCordova(connection);
          } else {
            self.walletExportPC(connection);
          }
        });
      };
    });
}());
