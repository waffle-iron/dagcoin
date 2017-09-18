(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('discoveryService', ($q, fileSystemService, promiseService) => {
      const eventBus = require('byteballcore/event_bus.js');
      const objectHash = require('byteballcore/object_hash.js');

      const self = {};

      // Testnet
      // const code = 'ApwhbsSyD7cF22UWxlZyH53y1vLpjsPk5gu4AW7AIdq0@byteball.org/bb-test#0000';

      // Yary's public testnet server
      const code = 'AnqLjlEMkQsoP6yZ/vDwT41F3IE6ItfggF0oxyYsUj42@byteball.org/bb-test#0000';

      // Local to Yary's machine
      // const code = 'A8EImXA5RtFDBstX3u1CzcVmcKm8jmBBYlMm93FAHQ0z@byteball.org/bb-test#0000';

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
      let waitingForFundingAddress = false;

      self.messages = messages;
      self.processMessage = processMessage;
      self.sendMessage = sendMessage;
      self.isDiscoveryServiceAddress = isDiscoveryServiceAddress;
      self.setFundingAddressPair = setFundingAddressPair;
      self.getUserConfig = getUserConfig;

      function setIsWaitingForFundingAddress(value) {
        waitingForFundingAddress = value;
      }

      function isWaitingForFundingAddress() {
        return waitingForFundingAddress;
      }

      /* function setCorrespondent(cor) {
        correspondent = cor;
      } */

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

      /**
       * Ensures the discovery service is connected and responsive.
       */
      function makeSureDiscoveryServiceIsConnected() {
        return checkOrPairDevice(code)
        .then((correspondent) => {
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

      function fundingPairListener(fromAddress, body, callback) {
        const device = require('byteballcore/device.js');
        device.readCorrespondent(fromAddress, () => {
          try {
            const jsonBody = JSON.parse(body);

            if (jsonBody.title && jsonBody.title === 'funding_address_pair') {
              return callback(jsonBody);
            }
          } catch (e) {
            console.log(e);
          }
        });
      }

      function processMessage(resp) {
        if (!resp || !isJsonString(resp)) {
          return Promise.resolve(false);
        }

        const respObj = JSON.parse(resp);
        let fundingNode;
        let pairCode;

        switch (respObj.messageType) {
          case messages.listTraders:
            if (!respObj.messageBody || !respObj.messageBody.traders || !respObj.messageBody.traders.length) {
              console.log('NO TRADERS AVAILABLE');
              return Promise.resolve(true);
            }

            respObj.messageBody.traders.sort((a, b) => {
              if (a.exchangeFee > b.exchangeFee) {
                return 1;
              }
              return -1;
            });

            fundingNode = respObj.messageBody.traders[0];
            pairCode = fundingNode.pairCode;

            return checkOrPairDevice(pairCode)
            .then((correspondent) => {
              console.log(`CORRESPONDENT: ${JSON.stringify(correspondent)}`);
              return readMyAddress()
                .then(address => askForFundingAddress(correspondent.device_address, address))
                .then(() => {
                  const promise = new Promise((resolve, reject) => {
                    // Timed rejection: can't wait more than 30 seconds
                    const err = `No funding pair received from ${correspondent.device_address} on time (30s timeout)`;
                    const timeoutId = setTimeout(reject(err), 30000);

                    eventBus.on('text', (fromAddress, body) => {
                      clearTimeout(timeoutId);
                      fundingPairListener(fromAddress, body, resolve);
                    });
                  }).then((jsonBody) => {
                    setFundingAddressPair(jsonBody.byteOrigin, jsonBody.dagcoinDestination);
                  }).then(() => {
                    eventBus.removeListener('text', fundingPairListener);
                  }).catch(() => {
                    eventBus.removeListener('text', fundingPairListener);
                  });

                  return promise;
                });
            }, err => console.log(err))
            .then(() => Promise.resolve(true));
          default:
            return Promise.resolve(false);
        }
      }

      function lookupDeviceByPublicKey(pubkey) {
        const promise = new Promise((resolve) => {
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

        return promise;
      }

      function pairDevice(pubkey, hub, pairingSecret) {
        const device = require('byteballcore/device.js');
        const promise = new Promise((resolve) => {
          device.addUnconfirmedCorrespondent(pubkey, hub, 'New', (deviceAddress) => {
            console.log(`PAIRING WITH ${deviceAddress} ... ADD UNCONFIRMED CORRESPONDENT`);
            discoveryServiceAddresses.push(deviceAddress);
            resolve(deviceAddress);
          });
        }).then((deviceAddress) => {
          console.log(`PAIRING WITH ${deviceAddress} ... ADD UNCONFIRMED CORRESPONDENT WAITING FOR PAIRING`);
          const waitForPairing = new Promise((resolve) => {
            device.startWaitingForPairing((reversePairingInfo) => {
              resolve({
                deviceAddress,
                reversePairingInfo
              });
            });
          });

          return waitForPairing;
        }).then((params) => {
          const sendingPairingMessage = new Promise((resolve, reject) => {
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

          return sendingPairingMessage;
        }).then((deviceAddress) => {
          console.log(`LOOKING UP CORRESPONDENT WITH DEVICE ADDRESS ${deviceAddress}`);
          return getCorrespondent(deviceAddress);
        });

        return promise;
      }

      function getCorrespondent(deviceAddress) {
        const device = require('byteballcore/device.js');
        const promise = new Promise((resolve) => {
          device.readCorrespondent(deviceAddress, (cor) => {
            resolve(cor);
          });
        });

        return promise;
      }

      // TODO: should have some dagcoins on it
      function readMyAddress() {
        const promise = new Promise((resolve, reject) => {
          const walletGeneral = require('byteballcore/wallet_general.js');
          walletGeneral.readMyAddresses((arrMyAddresses) => {
            if (arrMyAddresses.length === 0) {
              reject('No addresses available');
            } else {
              resolve(arrMyAddresses[0]);
            }
          });
        });

        return promise;
      }

      function askForFundingAddress(deviceAddress, address) {
        if (isWaitingForFundingAddress()) {
          return Promise.reject('Already requesting a funding address');
        }

        console.log(`REQUESTING A FUNDING ADDRESS TO ${deviceAddress} TO BE USED WITH ${address}`);

        setIsWaitingForFundingAddress(true);

        const userConfig = getUserConfig();

        if (userConfig.byteOrigin && userConfig.dagcoinDestination) {
          console.log('No need to ask for funding addresses');
          setIsWaitingForFundingAddress(false);
          return Promise.resolve(false);
        }

        const messageTitle = 'funding-address-request';
        const device = require('byteballcore/device.js');

        console.log(`Sending ${messageTitle} to ${device.getMyDeviceAddress()}:${address}`);

        const promise = listenToCreateNewSharedAddress(deviceAddress);

        device.sendMessageToDevice(
          deviceAddress,
          'text',
          JSON.stringify({
            protocol: 'dagcoin',
            title: messageTitle,
            deviceAddress: device.getMyDeviceAddress(),
            address
          })
        );

        return promise;
      }

      function checkOrPairDevice(pairCode) {
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

      function sendMessage(messageType, messageBody) {
        return makeSureDiscoveryServiceIsConnected().then(
          (correspondent) => {
            const device = require('byteballcore/device.js');
            const promise = new Promise((resolve, reject) => {
              const message = {
                protocol: 'dagcoin',
                title: `request.${messageType}`,
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

            return promise;
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

      function listenToCreateNewSharedAddress(deviceAddress) {
        const mainPromise = new Promise((mainResolve) => {
          eventBus.on('create_new_shared_address', (template, signers) => {
            const device = require('byteballcore/device.js');
            const promise = new Promise((resolve, reject) => {
              const walletGeneral = require('byteballcore/wallet_general.js');
              walletGeneral.readMyAddresses((arrMyAddresses) => {
                if (arrMyAddresses.length === 0) {
                  reject('No addresses available');
                } else {
                  resolve(arrMyAddresses[0]);
                }
              });
            }).then((address) => {
              console.log(`CREATE NEW SHARED ADDRESS FOR ${address} TEMPLATE: ${JSON.stringify(template)}`);
              console.log(`CREATE NEW SHARED ADDRESS FOR ${address} SIGNERS: ${JSON.stringify(signers)}`);

              if (!deviceAddress) {
                return Promise.reject();
              }

              const localSigners = {
                r: {
                  address,
                  device_address: device.getMyDeviceAddress()
                }
              };

              const addressTemplateCHash = objectHash.getChash160(template);

              device.sendMessageToDevice(deviceAddress, 'approve_new_shared_address', {
                address_definition_template_chash: addressTemplateCHash,
                address,
                device_addresses_by_relative_signing_paths: localSigners
              });

              mainResolve(true);
              return Promise.resolve(true);
            });

            return promise;
          });
        });

        return mainPromise;
      }

      return self;
    });
}());
