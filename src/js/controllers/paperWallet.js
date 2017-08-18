/*
 This should be rewritten!
 - accept the private key
 - derive its address
 - find all outputs to this address (requires full node or light/get_history)
 - spend them to one of my own addresses
 */

(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('paperWalletController',
    function ($scope, $http, $timeout, $log, configService, profileService, go, addressService, txStatus, bitcore) {
      const self = this;
      const fc = profileService.focusedClient;
      // let rawTx;

      self.onQrCodeScanned = function (data) {
        $scope.inputData = data;
        self.onData(data);
      };

      self.onData = function (data) {
        self.error = '';
        self.scannedKey = data;
        self.isPkEncrypted = (data.charAt(0) === '6');
      };

      self.processFundScanning = function (cb) {
        function getPrivateKey(scannedKey, isPkEncrypted, passphrase, callBack) {
          if (!isPkEncrypted) {
            return callBack(null, scannedKey);
          }
          return fc.decryptBIP38PrivateKey(scannedKey, passphrase, null, cb);
        }

        function getBalance(privateKey, callBack) {
          fc.getBalanceFromPrivateKey(privateKey, callBack);
        }

        function checkPrivateKey(privateKey) {
          try {
            bitcore.PrivateKey(privateKey, 'livenet');
          } catch (err) {
            return false;
          }
          return true;
        }

        getPrivateKey(self.scannedKey, self.isPkEncrypted, $scope.passphrase, (err, privateKey) => {
          if (err) {
            return cb(err);
          }
          if (!checkPrivateKey(privateKey)) {
            return cb(new Error('Invalid private key'));
          }

          return getBalance(privateKey, (getBalanceError, balance) => {
            if (getBalanceError) {
              return cb(getBalanceError);
            }
            return cb(null, privateKey, balance);
          });
        });
      };

      self.scanFunds = function () {
        self.error = 'Unimplemented';
        // TODO Implement the scanFunds functionality

        // self.scanning = true;
        // self.privateKey = '';
        // self.balanceBytes = 0;
        // self.error = '';
        //
        // $timeout(() => {
        //   self.processFundScanning((err, privateKey, balance) => {
        //     self.scanning = false;
        //     if (err) {
        //       $log.error(err);
        //       self.error = err.message || err.toString();
        //     } else {
        //       self.privateKey = privateKey;
        //       self.balanceBytes = balance;
        //       const config = configService.getSync().wallet.settings;
        //       self.balance = `${profileService.formatAmount(balance)} ${config.unitName}`;
        //     }
        //
        //     $scope.$apply();
        //   });
        // }, 100);
      };

      self.processWalletSweep = function (cb) {
        addressService.getAddress(fc.credentials.walletId, true, (err, destinationAddress) => {
          if (err) return cb(err);

          return fc.buildTxFromPrivateKey(self.privateKey, destinationAddress, null, (buildTxFromPrivateKeyError, tx) => {
            if (buildTxFromPrivateKeyError) {
              return cb(buildTxFromPrivateKeyError);
            }

            return fc.broadcastRawTx({
              rawTx: tx.serialize(),
              network: 'livenet',
            }, (broadcastRawTxError, txid) => {
              if (broadcastRawTxError) {
                return cb(broadcastRawTxError);
              }
              return cb(null, destinationAddress, txid);
            });
          });
        });
      };

      self.sweepWallet = function () {
        self.sending = true;
        self.error = '';

        $timeout(() => {
          self.processWalletSweep((err) => {
            self.sending = false;

            if (err) {
              self.error = err.message || err.toString();
              $log.error(err);
            } else {
              txStatus.notify({
                status: 'broadcasted',
              }, () => {
                go.walletHome();
              });
            }

            $scope.$apply();
          });
        }, 100);
      };
    });
}());
