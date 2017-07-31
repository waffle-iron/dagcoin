(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('discoveryService', ($q, $rootScope, correspondentListService) => {
      const self = {};
      const device = require('byteballcore/device.js');
      const conf = require('byteballcore/conf.js');
      const code = conf.discoveryServiceCode || 'ApwhbsSyD7cF22UWxlZyH53y1vLpjsPk5gu4AW7AIdq0@byteball.org/bb-test#0000';

      let correspondent = null;
      let messageEvents = null;

      self.sendMessage = sendMessage;

      function setCorrespondent(cor) {
        correspondent = cor;
        messageEvents = correspondentListService.messageEventsByCorrespondent[cor.device_address];

        if (!messageEvents) {
          correspondentListService.messageEventsByCorrespondent[cor.device_address] = [];
          messageEvents = correspondentListService.messageEventsByCorrespondent[cor.device_address];
        }
      }

      function initService() {
        const defer = $q.defer();

        if (correspondent === null || correspondent === undefined) {
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
                  ifOk: () => {
                  },
                  ifError: () => {
                  }
                });
            });

            device.readCorrespondent(deviceAddress, (cor) => {
              setCorrespondent(cor);
              defer.resolve();
            });
          });
        } else {
          defer.resolve();
        }

        return defer.promise;
      }

      function sendMessage(message) {
        const def = $q.defer();

        initService().then(() => {
          device.sendMessageToDevice(correspondent.device_address, 'text', message, {
            ifOk() {
              def.resolve();
            },
            ifError(error) {
              def.reject(error);
            }
          });
        }, def.reject);

        return def.promise;
      }

      return self;
    });
}());
