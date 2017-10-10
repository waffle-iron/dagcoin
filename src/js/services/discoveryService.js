(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('discoveryService', ($q, fileSystemService, promiseService, isCordova) => {
      const eventBus = require('byteballcore/event_bus.js');

      const self = {};

      const discoveryServiceAddresses = [];

      const messages = {
        startingTheBusiness: 'STARTING_THE_BUSINESS',
        aliveAndWell: 'ALIVE_AND_WELL',
        temporarilyUnavailable: 'TEMPORARILY_UNAVAILABLE',
        outOfBusiness: 'OUT_OF_BUSINESS',
        listTraders: 'LIST_TRADERS',
        updateSettings: 'UPDATE_SETTINGS'
      };

      let discoveryServiceAvailabilityCheckingPromise = null;

      self.messages = messages;
      // self.processMessage = processMessage;
      self.sendMessage = sendMessage;
      self.isDiscoveryServiceAddress = isDiscoveryServiceAddress;
      self.setFundingAddressPair = setFundingAddressPair;
      self.getUserConfig = getUserConfig;
      self.messageCounter = 0;

      function getPairingCode() {
        console.log('GETTING THE PAIRING CODE');

        return new Promise((resolve, reject) => {
          if (!isCordova) {
            fileSystemService.readFile('package.json', (err, data) => {
              if (err) {
                reject(`COULD NOT OPEN package.json: ${err}`);
              } else {
                const env = JSON.parse(data);
                console.log(`PAIRING CODE: ${env.discoveryServicePairingCode}`);
                resolve(env.discoveryServicePairingCode);
              }
            });
          } else {
            const constants = require('byteballcore/constants.js');

            if (constants.version.match(/t$/)) {
              // TESTNET
              resolve('AnqLjlEMkQsoP6yZ/vDwT41F3IE6ItfggF0oxyYsUj42@byteball.org/bb-test#0000');
            } else {
              // LIVENET
              resolve('A7MiDQd+H7S6kFXfEdIKrM6oW6YF2oq4ewU+eSH30YGp@byteball.org/bb#0000');
            }
          }
        });
      }

      function isDiscoveryServiceAddress(deviceAddress) {
        console.log(`DISCOVERY SERVICE ADDRESSES: ${JSON.stringify(discoveryServiceAddresses)}`);
        return !!discoveryServiceAddresses.find((obj) => {
          return obj === deviceAddress;
        });
      }

      /**
       * Ensures the discovery service is connected and responsive.
       */
      function makeSureDiscoveryServiceIsConnected() {
        return getPairingCode().then((discoveryServicePairingCode) => {
          console.log(`GOT PAIRING CODE: ${discoveryServicePairingCode}`);
          return checkOrPairDevice(discoveryServicePairingCode);
        }).then((correspondent) => {
          const discoveryServiceDeviceAddress = correspondent.device_address;

          if (!discoveryServiceAddresses.includes(discoveryServiceDeviceAddress)) {
            discoveryServiceAddresses.push(discoveryServiceDeviceAddress);
          }

          if (discoveryServiceAvailabilityCheckingPromise !== null) {
            console.log('ALREADY WAITING FOR THE DISCOVERY SERVICE TO REPLY');
            return discoveryServiceAvailabilityCheckingPromise;
          }

          const promise = new Promise((resolve) => {
            const listener = function (message, fromAddress) {
              if (fromAddress === discoveryServiceDeviceAddress) {
                console.log(`THE DISCOVERY SERVICE (${discoveryServiceDeviceAddress}) IS ALIVE`);
                eventBus.removeListener('dagcoin.connected', listener);
                resolve(correspondent);
              }
            };

            eventBus.on('dagcoin.connected', listener);
          });

          const keepAlive = {
            protocol: 'dagcoin',
            title: 'is-connected'
          };

          const device = require('byteballcore/device.js');
          device.sendMessageToDevice(discoveryServiceDeviceAddress, 'text', JSON.stringify(keepAlive));

          const attempts = 12;

          const timeoutMessage = `THE DISCOVERY SERVICE ${discoveryServiceDeviceAddress} DID NOT REPLY AFTER 10 SECONDS`;
          const finalTimeoutMessage = `THE DISCOVERY SERVICE DID NOT REPLY AFTER ${attempts} ATTEMPS`;

          const timeoutMessages = { timeoutMessage, finalTimeoutMessage };

          discoveryServiceAvailabilityCheckingPromise = promiseService.repeatedTimedPromise(promise, 10000, attempts, timeoutMessages);

          // After ten minutes will be needed to make sure the discovery service is connected
          setTimeout(() => {
            discoveryServiceAvailabilityCheckingPromise = null;
          }, 10 * 60 * 1000);

          return discoveryServiceAvailabilityCheckingPromise;
        });
      }

      function lookupDeviceByPublicKey(pubkey) {
        return new Promise((resolve) => {
          const db = require('byteballcore/db.js');
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

      function pairDevice(pubkey, hub, pairingSecret) {
        const device = require('byteballcore/device.js');
        return new Promise((resolve) => {
          device.addUnconfirmedCorrespondent(pubkey, hub, 'New', (deviceAddress) => {
            console.log(`PAIRING WITH ${deviceAddress} ... ADD UNCONFIRMED CORRESPONDENT`);
            discoveryServiceAddresses.push(deviceAddress);
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
        }).then((params) => {
          return new Promise((resolve, reject) => {
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
          });
        }).then((deviceAddress) => {
          console.log(`LOOKING UP CORRESPONDENT WITH DEVICE ADDRESS ${deviceAddress}`);
          return getCorrespondent(deviceAddress);
        });
      }

      function getCorrespondent(deviceAddress) {
        const device = require('byteballcore/device.js');
        return new Promise((resolve) => {
          device.readCorrespondent(deviceAddress, (cor) => {
            resolve(cor);
          });
        });
      }

      function checkOrPairDevice(pairCode) {
        if (!pairCode) {
          return Promise.reject('NO PAIRING CODE AVAILABLE');
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
        const id = self.messageCounter;
        self.messageCounter += 1;
        return id;
      }

      function sendMessage(messageType, messageBody) {
        return makeSureDiscoveryServiceIsConnected().then(
          (correspondent) => {
            const device = require('byteballcore/device.js');
            return new Promise((resolve, reject) => {
              const message = {
                protocol: 'dagcoin',
                title: `request.${messageType}`,
                id: nextMessageId(),
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

      function requireUncached(module) {
        if (typeof require.resolve === 'function') {
          delete require.cache[require.resolve(module)];
        }
        return require(module.toString());
      }

      function getUserConfig() {
        try {
          const userConfFile = fileSystemService.getUserConfFilePath();
          return requireUncached(userConfFile);
        } catch (e) {
          return {}; // empty config
        }
      }

      function updateConfig(config) {
        return new Promise((resolve, reject) => {
          fileSystemService.writeFile(fileSystemService.getUserConfFilePath(), JSON.stringify(config, null, '\t'), 'utf8', (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      function setFundingAddressPair(byteOrigin, dagcoinDestination) {
        const userConfig = getUserConfig();

        if (userConfig.byteOrigin && userConfig.dagcoinDestination) {
          console.log('No need to update funding addresses');
          return;
        }

        userConfig.byteOrigin = byteOrigin;
        userConfig.dagcoinDestination = dagcoinDestination;

        return updateConfig(userConfig);
      }

      self.nextMessageId = nextMessageId;

      return self;
    });
}());
