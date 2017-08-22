(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('discoveryService', ($q) => {
      const self = {};
      const code = 'ApwhbsSyD7cF22UWxlZyH53y1vLpjsPk5gu4AW7AIdq0@byteball.org/bb-test#0000';

      const discoveryServiceAddresses = [
        '03BQAPTUC75VFZYA2KRX5GL237YEPXJPI', // testnet discovery-service
        '0ZLO3332VBI2ARKSNES4AU6HT6ET7LLDF' // local discovery-service
      ];

      const messages = {
        startingTheBusiness: 'STARTING_THE_BUSINESS',
        aliveAndWell: 'ALIVE_AND_WELL',
        temporarilyUnavailable: 'TEMPORARILY_UNAVAILABLE',
        outOfBusiness: 'OUT_OF_BUSINESS',
        listTraders: 'LIST_TRADERS',
        updateSettings: 'UPDATE_SETTINGS'
      };

      let correspondent = null;

      self.messages = messages;
      self.processMessage = processMessage;
      self.sendMessage = sendMessage;
      self.isDiscoveryServiceAddress = isDiscoveryServiceAddress;

      function setCorrespondent(cor) {
        correspondent = cor;
      }

      function isDiscoveryServiceAddress(deviceAddress) {
        return !!discoveryServiceAddresses.find(obj => obj === deviceAddress);
      }

      function isJsonString(str) {
        try {
          JSON.parse(str);
          return true;
        } catch (err) {
          return false;
        }
      }

      function processMessage(resp) {
        if (!resp || !isJsonString(resp)) {
          return;
        }

        const respObj = JSON.parse(resp);
        let fundingNode;
        let pairCode;

        switch (respObj.messageType) {
          case messages.listTraders:
            if (!respObj.messageBody || !respObj.messageBody.traders || !respObj.messageBody.traders.length) {
              return;
            }

            respObj.messageBody.traders.sort((a, b) => {
              if (a.exchangeFee > b.exchangeFee) {
                return 1;
              }
              return -1;
            });

            fundingNode = respObj.messageBody.traders[0];
            pairCode = fundingNode.pairCode;

            addPairDevice(pairCode).then(() => { }, err => console.log(err));
            break;
          default:
            break;
        }
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

      function initService() {
        if (correspondent === null || correspondent === undefined) {
          return addPairDevice(code).then((cor) => {
            setCorrespondent(cor);
          });
        }

        return $q.resolve();
      }

      function sendMessage(messageType, messageBody) {
        const def = $q.defer();
        const message = { messageType, messageBody };
        const device = require('byteballcore/device.js');

        initService().then(() => {
          device.sendMessageToDevice(correspondent.device_address, 'text', JSON.stringify(message), {
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
