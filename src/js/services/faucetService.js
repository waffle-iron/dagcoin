(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('faucetService', ($rootScope) => {
      const self = {};
      const constants = require('byteballcore/constants.js');
      const code = 'A6thOoiPnsPGKgMj4G/OYkh4d7WR/MX3r1k2tG/WJPof@byteball.org/bb-test#0000';
      const isTestnet = constants.version.match(/t$/);

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
        const device = require('byteballcore/device.js');
        const matches = code.match(/^([\w\/+]+)@([\w.:\/-]+)#([\w\/+-]+)$/);
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

          device.readCorrespondent(deviceAddress, () => { });
        });
      }

      return self;
    });
}());
