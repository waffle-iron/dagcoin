(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('discoveryService', ($q, fileSystemService) => {
      const eventBus = require('byteballcore/event_bus.js');
      const device = require('byteballcore/device.js');
      const objectHash = require('byteballcore/object_hash.js');
      const db = require('byteballcore/db.js');

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

      // let correspondent = null;
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

      function makeSureDiscoveryServiceIsConnected() {
        return checkOrPairDevice(code);
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

            checkOrPairDevice(pairCode).then((correspondent) => {
              console.log(`CORRESPONDENT: ${JSON.stringify(correspondent)}`);
              return readMyShareableAddress()
                .then(address => askForFundingAddress(correspondent.device_address, address))
                .then(() => {
                  eventBus.on('text', (fromAddress, body) => {
                    device.readCorrespondent(fromAddress, () => {
                      try {
                        const jsonBody = JSON.parse(body);

                        if (jsonBody.title && jsonBody.title === 'funding_address_pair') {
                          setFundingAddressPair(jsonBody.byteOrigin, jsonBody.dagcoinDestination);
                          return;
                        }
                      } catch (e) {
                        console.log(e);
                      }
                    });
                  });
                });
            }, err => console.log(err));
            // addPairDevice(pairCode).then(() => {
            // }, err => console.log(err));
            break;
          default:
            break;
        }
      }

      function lookupDeviceByPublicKey(pubkey) {
        const promise = new Promise((resolve) => {
          db.query('SELECT device_address FROM correspondent_devices WHERE pubkey = ?', [pubkey], (rows) => {
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
        const promise = new Promise((resolve) => {
          device.addUnconfirmedCorrespondent(pubkey, hub, 'New', (deviceAddress) => {
            console.log(`PAIRING WITH ${deviceAddress} ... ADD UNCONFIRMED CORRESPONDENT`);
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
        const promise = new Promise((resolve) => {
          device.readCorrespondent(deviceAddress, (cor) => {
            resolve(cor);
          });
        });

        return promise;
      }

      function readMyShareableAddress() {
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
          return Promise.resolve(true);
        }

        const messageTitle = 'ask_for_funding_address';
        console.log(`Sending ${messageTitle} to ${device.getMyDeviceAddress()}:${address}`);

        const promise = listenToCreateNewSharedAddress(deviceAddress);

        device.sendMessageToDevice(
          deviceAddress,
          'text',
          JSON.stringify({
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

      /* function addPairDevice(pairCode) {
        const defer = $q.defer();

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
                ifOk: () => {
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
                    if (isWaitingForFundingAddress()) {
                      return Promise.reject('Already requesting a funding address');
                    }

                    console.log('REQUESTING A FUNDING ADDRESS');

                    setIsWaitingForFundingAddress(true);

                    const userConfig = getUserConfig();

                    if (userConfig.byteOrigin && userConfig.dagcoinDestination) {
                      console.log('No need to ask for funding addresses');
                      return;
                    }

                    const messageTitle = 'ask_for_funding_address';
                    console.log(`Sending ${messageTitle} to ${device.getMyDeviceAddress()}:${address}`);
                    device.sendMessageToDevice(
                      deviceAddress,
                      'text',
                      JSON.stringify({
                        title: messageTitle,
                        deviceAddress: device.getMyDeviceAddress(),
                        address
                      })
                    );
                  });

                  return promise;
                },
                ifError: () => {
                }
              });
          });

          device.readCorrespondent(deviceAddress, (cor) => {
            defer.resolve(cor);
          });
        });

        return defer.promise;
      } */

      /* function initService() {
         if (correspondent === null || correspondent === undefined) {
          return addPairDevice(code).then((cor) => {
            setCorrespondent(cor);
          });
        }

        return $q.resolve();
        return makeSureDiscoveryServiceIsConnected();
      } */

      function sendMessage(messageType, messageBody) {
        /* const def = $q.defer();
        const message = {messageType, messageBody};

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

        return def.promise; */

        return makeSureDiscoveryServiceIsConnected().then((correspondent) => {
          const promise = new Promise((resolve, reject) => {
            const message = { messageType, messageBody };

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
        });
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

        updateConfig(userConfig);
      }

      function listenToCreateNewSharedAddress(deviceAddress) {
        const mainPromise = new Promise((mainResolve) => {
          eventBus.on('create_new_shared_address', (template, signers) => {
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
