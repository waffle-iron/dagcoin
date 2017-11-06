/* eslint-disable import/no-unresolved */
(function () {
  'use strict';

  angular.module('copayApp.services').factory('dagcoinProtocolService', (promiseService) => {
    const eventBus = require('byteballcore/event_bus.js');
    const root = {};

    root.messageCounter = 0;

    const deviceConnectionPromiseMap = new Map();

    function pairAndConnectDevice(code, connectionCheckLifeSpan) {
      return checkOrPairDevice(code).then(correspondent => makeSureDeviceIsConnected(correspondent.device_address, connectionCheckLifeSpan)
      );
    }

    function makeSureDeviceIsConnected(deviceAddress, connectionCheckLifeSpan) {
      console.log(`CHECKING WHETHER DEVICE ${deviceAddress} IS CONNECTED`);

      let deviceConnectionPromise = deviceConnectionPromiseMap.get(deviceAddress);

      if (deviceConnectionPromise) {
        console.log(`STILL WAITING FOR A REPLY FROM ${deviceAddress}`);
        return deviceConnectionPromise;
      }

      let listener = null;

      const promise = new Promise((resolve) => {
        listener = function (message, fromAddress) {
          if (fromAddress === deviceAddress) {
            console.log(`DEVICE WITH ADDRESS ${deviceAddress} IS RESPONSIVE`);
            eventBus.removeListener('dagcoin.connected', listener);
            resolve(true);
          }
        };

        eventBus.on('dagcoin.connected', listener);
      }).then(
        () => getCorrespondent(deviceAddress),
        () => { eventBus.removeListener('dagcoin.connected', listener); }
      );

      const keepAlive = {
        protocol: 'dagcoin',
        title: 'is-connected'
      };
      const device = require('byteballcore/device.js');

      device.sendMessageToDevice(deviceAddress, 'text', JSON.stringify(keepAlive));

      const attempts = 12;
      const timeoutSeconds = 10;

      const timeoutMessage = `DEVICE WITH ADDRESS ${deviceAddress} DID NOT REPLY AFTER ${timeoutSeconds} SECONDS`;
      const finalTimeoutMessage = `DEVICE WITH ADDRESS ${deviceAddress} DID NOT REPLY AFTER ${attempts} ATTEMPS. GIVING UP.`;

      const timeoutMessages = { timeoutMessage, finalTimeoutMessage };

      deviceConnectionPromise = promiseService.repeatedTimedPromise(promise, timeoutSeconds * 1000, attempts, timeoutMessages);

      // After ten minutes will be needed to make sure the discovery service is connected
      if (connectionCheckLifeSpan !== root.FOREVER) {
        setTimeout(() => {
          deviceConnectionPromise = null;
        }, connectionCheckLifeSpan * 1000);
      }

      deviceConnectionPromiseMap.set(deviceAddress, deviceConnectionPromise);

      return deviceConnectionPromise;
    }

    function getCorrespondent(deviceAddress) {
      const device = require('byteballcore/device.js');
      return new Promise((resolve) => {
        device.readCorrespondent(deviceAddress, (cor) => {
          resolve(cor);
        });
      });
    }

    function pairDevice(pubkey, hub, pairingSecret) {
      const device = require('byteballcore/device.js');
      return new Promise((resolve) => {
        device.addUnconfirmedCorrespondent(pubkey, hub, 'New', (deviceAddress) => {
          console.log(`PAIRING WITH ${deviceAddress} ... ADD UNCONFIRMED CORRESPONDENT`);
          resolve(deviceAddress);
        });
      }).then((deviceAddress) => {
        console.log(`PAIRING WITH ${deviceAddress} ... ADD UNCONFIRMED CORRESPONDENT WAITING FOR PAIRING`);
        return new Promise((resolve) => {
          device.startWaitingForPairing((reversePairingInfo) => {
            resolve({
              deviceAddress,
              reversePairingInfo
            });
          });
        });
      }).then(params => new Promise((resolve, reject) => {
          console.log(`PAIRING WITH ${params.deviceAddress} ... SENDING PAIRING MESSAGE`);

          device.sendPairingMessage(
            hub,
            pubkey,
            pairingSecret,
            params.reversePairingInfo.pairing_secret, {
              ifOk: () => {
                resolve(params.deviceAddress);
              },
              ifError: () => {
                reject('FAILED DELIVERING THE PAIRING MESSAGE');
              }
            }
          );
        })).then((deviceAddress) => {
        console.log(`LOOKING UP CORRESPONDENT WITH DEVICE ADDRESS ${deviceAddress}`);
        return getCorrespondent(deviceAddress);
      });
    }

    function lookupDeviceByPublicKey(pubkey) {
      const db = require('byteballcore/db.js');
      return new Promise((resolve) => {
        db.query('SELECT device_address FROM correspondent_devices WHERE pubkey = ? AND is_confirmed = 1', [pubkey], (rows) => {
          if (rows.length === 0) {
            console.log(`DEVICE WITH PUBKEY ${pubkey} NOT YET PAIRED`);
            resolve(null);
          } else {
            const deviceAddress = rows[0].device_address;
            console.log(`DEVICE WITH PUBKEY ${pubkey} ALREADY PAIRED: ${deviceAddress}`);
            resolve(deviceAddress);
          }
        });
      });
    }

    function checkOrPairDevice(pairCode) {
      if (!pairCode) {
        return Promise.reject('NO PAIRING CODE PROVIDED');
      }

      const matches = pairCode.match(/^([\w\/+]+)@([\w.:\/-]+)#([\w\/+-]+)$/);
      const pubkey = matches[1];
      const hub = matches[2];
      const pairingSecret = matches[3];

      return lookupDeviceByPublicKey(pubkey).then((deviceAddress) => {
        if (deviceAddress === null) {
          return pairDevice(pubkey, hub, pairingSecret);
        }

        return getCorrespondent(deviceAddress);
      });
    }

    function nextMessageId() {
      const id = root.messageCounter;
      root.messageCounter += 1;
      return id;
    }

    function sendRequest(deviceAddress, subject, messageBody) {
      root.sendMessage(deviceAddress, 'request', subject, messageBody);
    }

    function sendResponse(deviceAddress, request, messageBody) {
      root.sendMessage(deviceAddress, 'response', request.title.split('.').pop(), messageBody, request.id);
    }

    function sendMessage(deviceAddress, messageType, subject, messageBody, messageId) {
      if (!deviceAddress) {
        throw Error('PARAMETER deviceAddress UNSPECIFIED');
      }

      if (!messageType) {
        throw Error('PARAMETER messageType UNSPECIFIED');
      }

      if (!subject) {
        throw Error('PARAMETER subject UNSPECIFIED');
      }

      return makeSureDeviceIsConnected(deviceAddress, 30 * 60 * 1000).then(
        (correspondent) => {
          const device = require('byteballcore/device.js');

          let responseId = messageId;

          if (responseId == null) {
            responseId = nextMessageId();
          }

          return new Promise((resolve, reject) => {
            const message = {
              protocol: 'dagcoin',
              title: `${messageType}.${subject}`,
              id: responseId,
              messageType,
              messageBody
            };

            device.sendMessageToDevice(correspondent.device_address, 'text', JSON.stringify(message), {
              ifOk() {
                resolve();
              },
              ifError(error) {
                reject(error);
              }
            });
          });
        },
        (error) => {
          console.log(`COULD NOT DELIVER ${messageType} TO DISCOVERY SERVICE: ${error}`);
        }
      );
    }

    root.FOREVER = -1;

    root.pairAndConnectDevice = pairAndConnectDevice;
    root.makeSureDeviceIsConnected = makeSureDeviceIsConnected;
    root.sendMessage = sendMessage;
    root.sendRequest = sendRequest;
    root.sendResponse = sendResponse;

    return root;
  });
}());
