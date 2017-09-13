(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('faucetService', ($rootScope, $q) => {
      const self = {};
      const constants = require('byteballcore/constants.js');
      const code = 'A6thOoiPnsPGKgMj4G/OYkh4d7WR/MX3r1k2tG/WJPof@byteball.org/bb-test#0000';
      const isTestnet = constants.version.match(/t$/);
      let isInitialized = false;

      self.isFaucetAddress = isFaucetAddress;

      const faucetAddresses = [
        '0JMVEW6BBLT26R5C66HRN7YAP2Z77XCX7', // testnet faucet
      ];

      if (isTestnet) {
        $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', () => {
          initService();
        });
      }

      function isFaucetAddress(deviceAddress) {
        return !!faucetAddresses.find(obj => obj === deviceAddress);
      }

      function initService() {
        if (isInitialized) {
          return;
        }

        const device = require('byteballcore/device.js');
        device.readCorrespondents((list) => {
          const paired = !!list.find(d => !!faucetAddresses.find(obj => obj === d.device_address));

          if (paired) {
            isInitialized = true;
            return;
          }

          addPairDevice(code).then(() => {
            isInitialized = true;
          });
        });
      }

      function addPairDevice(pairCode) {
        const defer = $q.defer();

        const device = require('byteballcore/device.js');
        const matches = pairCode.match(/^([\w\/+]+)@([\w.:\/-]+)#([\w\/+-]+)$/);
        const pubkey = matches[1];
        const hub = matches[2];
        const pairingSecret = matches[3];

        device.addUnconfirmedCorrespondent(pubkey, hub, 'New', (deviceAddress) => {
          device.startWaitingForPairing((reversePairingInfo) => {
            device.sendPairingMessage(hub,
              pubkey,
              pairingSecret,
              reversePairingInfo.pairing_secret,
              {
                ifOk: () => { },
                ifError: () => { }
              });
          });

          device.readCorrespondent(deviceAddress, (cor) => {
            defer.resolve(cor);
          });
        });

        return defer.promise;
      }

      return self;
    });
}());
