/* eslint-disable import/no-dynamic-require */
(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('fundingExchangeClientService', ($rootScope,
                                              discoveryService,
                                              configService,
                                              dagcoinProtocolService,
                                              promiseService,
                                              addressService,
                                              profileService,
                                              proofingService) => {
      const self = {};

      // Statuses
      self.active = false;
      self.activating = false;

      self.dagcoinOrigin = null;

      self.bytesProviderDeviceAddress = null;
      self.byteOrigin = null;
      self.dagcoinDestination = null;

      function isFundingPairPresent() {
        let fundingPairAvailable = true;

        if (!self.bytesProviderDeviceAddress) {
          console.log('MISSING bytesProviderDeviceAddress IN THE CONFIGURATION');
          fundingPairAvailable = false;
        }

        if (!self.byteOrigin) {
          console.log('MISSING byteOrigin IN THE CONFIGURATION');
          fundingPairAvailable = false;
        }

        if (!self.dagcoinDestination) {
          console.log('MISSING dagcoinDestination IN THE CONFIGURATION');
          fundingPairAvailable = false;
        }

        return fundingPairAvailable;
      }

      function askForFundingNode() {
        console.log('ASKING FOR A FUNDING NODE');

        const promise = promiseService.listeningTimedPromise(
          `dagcoin.response.${discoveryService.messages.listTraders}`,
          (message, fromAddress) => {
            if (!discoveryService.isDiscoveryServiceAddress(fromAddress)) {
              console.log(`RECEIVED A LIST OF TRADERS FROM AN ADDRESS THAT IS NOT MY DISCOVERY SERVICE: ${fromAddress}`);
              return false;
            }

            console.log(`THE DISCOVERY SERVICE (${fromAddress}) SENT A MESSAGE: ${JSON.stringify(message)}`);

            const body = message.messageBody;

            if (!body) {
              console.log(`DISCOVERY SERVICE (${fromAddress}) SENT A TRADERS LIST WITH NO BODY`);
              return false;
            }

            const traders = body.traders;

            if (!traders) {
              console.log(`DISCOVERY SERVICE (${fromAddress}) SENT A TRADERS LIST MESSAGE BODY WITH NO TRADERS' SECTION`);
              return false;
            }

            if (traders.length === 0) {
              console.log(`DISCOVERY SERVICE (${fromAddress}) HAS NO TRADERS AVAILABLE`);
              return false;
            }

            traders.sort((a, b) => {
              if (a.exchangeFee > b.exchangeFee) {
                return 1;
              }
              return -1;
            });

            return traders[0];
          },
          30 * 1000,
          'NO LIST OF TRADERS FROM THE DISCOVERY SERVICE'
        );

        console.log('BEFORE SENDING A MESSAGE TO THE DISCOVERY SERVICE');
        discoveryService.sendMessage(discoveryService.messages.listTraders);
        console.log('AFTER SENDING A MESSAGE TO THE DISCOVERY SERVICE');

        return promise;
      }

      function activate() {
        if (self.active) {
          return Promise.resolve(true);
        }

        if (self.activating) {
          return Promise.resolve(false);
        }

        self.activating = true;

        if (isFundingPairPresent()) {
          self.activating = false;
          self.active = true;
          return Promise.resolve(true);
        }

        return readFundingClientConfiguration().then((ready) => {
          if (ready) {
            console.log('A SHARED ADDRESS WAS FOUND IN THE DATABASE USED THAT ONE TO INITIALIZE');
            self.activating = false;
            self.active = true;
            return Promise.resolve();
          }

          return queryDiscoveryService();
        });
      }

      function readFundingClientConfiguration() {
        return readMyAddress().then((myAddress) => {
          if (!myAddress) {
            return Promise.reject('COULD NOT FIND ANY ADDRESS IN THE DATABASE');
          }

          self.dagcoinOrigin = myAddress;

          return new Promise((resolve, reject) => {
            const db = require('byteballcore/db.js');
            db.query(
              'SELECT distinct shared_address, address, device_address FROM shared_address_signing_paths WHERE address not in (select address from my_addresses) and address not in (select shared_address from shared_addresses)',
              [],
              (rows) => {
                if (rows.length === 0) {
                  console.log('NO SHARED ADDRESSES FOUND. QUERYING THE DISCOVERY SERVICE FOR A FUNDING NODE');
                  resolve(false);
                } else if (rows.length > 1) {
                  reject(`THERE ARE TOO MANY SHARED ADDRESSES: ${JSON.stringify(rows)}`);
                } else {
                  self.byteOrigin = rows[0].shared_address;
                  self.dagcoinDestination = rows[0].address;
                  self.bytesProviderDeviceAddress = rows[0].device_address;

                  resolve(true);
                }
              }
            );
          });
        });
      }

      function queryDiscoveryService() {
        return askForFundingNode().then((fundingNode) => {
          console.log(`TRADERS AVAILABLE: ${JSON.stringify(fundingNode)}`);

          self.bytesProviderDeviceAddress = fundingNode.deviceAddress;

          return dagcoinProtocolService.pairAndConnectDevice(fundingNode.pairCode);
        }).then(() => {
          console.log(`SUCCESSFULLY PAIRED WITH ${self.bytesProviderDeviceAddress}`);

          if (self.dagcoinOrigin) {
            return Promise.resolve(self.dagcoinOrigin);
          }

          return readMyAddress();
        }).then((myAddress) => {
          if (!myAddress) {
            return Promise.reject('COULD NOT FIND ANY ADDRESS IN THE DATABASE');
          }

          self.dagcoinOrigin = myAddress;

          const device = require('byteballcore/device');

          self.myDeviceAddress = device.getMyDeviceAddress();

          return askForFundingAddress();
        })
          .then(
          (result) => {
            self.activating = false;
            self.active = true;
            // self.index.selectSubWallet(self.byteOrigin);
            return Promise.resolve(result);
          },
          (err) => {
            self.activating = false;
            return Promise.reject(err);
          }
        );
      }

      function askForFundingAddress() {
        if (self.isWaitingForFundingAddress) {
          return Promise.reject('Already requesting a funding address');
        }

        console.log(`REQUESTING A FUNDING ADDRESS TO ${self.bytesProviderDeviceAddress} TO BE USED WITH ${self.dagcoinOrigin}`);

        self.isWaitingForFundingAddress = true;

        const messageTitle = 'request.share-funded-address';
        const device = require('byteballcore/device.js');

        const promise = listenToCreateNewSharedAddress();

        proofingService.proofMasterAddress().then((proof) => {
          proof.protocol = 'dagcoin';
          proof.title = messageTitle;
          proof.id = discoveryService.nextMessageId();

          console.log(`SENDING TO ${device.getMyDeviceAddress()}: ${JSON.stringify(proof)}`);

          device.sendMessageToDevice(
            self.bytesProviderDeviceAddress,
            'text',
            JSON.stringify(proof)
          );
        });

        return promise;
      }

      function listenToCreateNewSharedAddress() {
        return new Promise((resolve) => {
          const eventBus = require('byteballcore/event_bus');
          const device = require('byteballcore/device');

          eventBus.on('create_new_shared_address', (template, signers) => {
            console.log(`CREATE NEW SHARED ADDRESS FOR ${self.dagcoinOrigin} TEMPLATE: ${JSON.stringify(template)}`);
            console.log(`CREATE NEW SHARED ADDRESS FOR ${self.dagcoinOrigin} SIGNERS: ${JSON.stringify(signers)}`);

            const localSigners = {
              r: {
                address: self.dagcoinOrigin,
                device_address: device.getMyDeviceAddress()
              }
            };

            const objectHash = require('byteballcore/object_hash');
            const addressTemplateCHash = objectHash.getChash160(template);

            device.sendMessageToDevice(self.bytesProviderDeviceAddress, 'approve_new_shared_address', {
              address_definition_template_chash: addressTemplateCHash,
              address: self.dagcoinOrigin,
              device_addresses_by_relative_signing_paths: localSigners
            });

            resolve();
          });
        }).then(() => checkConfigurationInTime(10));
      }

      function checkConfigurationInTime(times) {
        if (times <= 0) {
          return Promise.reject(`WON'T CHECK AGAIN. GIVEN UP AFTER ${times} TIMES`);
        }

        return new Promise((resolve) => {
          setTimeout(() => {
            readFundingClientConfiguration().then((ready) => {
              resolve(ready);
            });
          }, 6000);
        }).then((ready) => {
          if (ready) {
            return Promise.resolve();
          }

          return checkConfigurationInTime(times - 1);
        });
      }
      // todo: needs refactoring
      function readMyAddresses() {
        return new Promise((resolve, reject) => {
          const fc = profileService.focusedClient;
          addressService.getAddresses(fc.credentials.walletId, (err, addr) => {
            if (!addr) {
              reject('NO ADDRESSES AVAILABLE');
            } else {
              resolve(addr);
            }
          });
        });
      }

      // TODO: should have some dagcoins on it
      function readMyAddress() {
        return new Promise((resolve, reject) => {
          const fc = profileService.focusedClient;
          addressService.getAddress(fc.credentials.walletId, false, (err, addr) => {
            if (!addr) {
              reject('NO ADDRESSES AVAILABLE');
            } else {
              console.log(`FOUND AN ADDRESS: ${addr}`);
              resolve(addr);
            }
          });
        });
      }

      self.getSharedAddressBalance = (sharedAddress) => {
        const db = require('byteballcore/db.js');
        return new Promise((resolve) => {
          db.query(
            'SELECT asset, address, is_stable, SUM(amount) AS balance \n\ ' +
            'FROM outputs CROSS JOIN units USING(unit) \n\ ' +
            'WHERE is_spent=0 AND sequence=\'good\' AND address = ? \n\ ' +
            'GROUP BY asset, address, is_stable \n\ ' +
            'UNION ALL \n\ ' +
            'SELECT NULL AS asset, address, 1 AS is_stable, SUM(amount) AS balance FROM witnessing_outputs \n\ ' +
            'WHERE is_spent=0 AND address = ? GROUP BY address \n\ ' +
            'UNION ALL \n\ ' +
            'SELECT NULL AS asset, address, 1 AS is_stable, SUM(amount) AS balance FROM headers_commission_outputs \n\ ' +
            'WHERE is_spent=0 AND address = ? GROUP BY address',
            [sharedAddress, sharedAddress, sharedAddress],
            (rows) => {
              const assocBalances = {};

              assocBalances.base = { stable: 0, pending: 0, total: 0 };

              for (let i = 0; i < rows.length; i += 1) {
                const row = rows[i];

                console.log(`SOMETHING FOR ${sharedAddress}: ${JSON.stringify(row)}`);

                const asset = row.asset || 'base';

                if (!assocBalances[asset]) {
                  assocBalances[asset] = { stable: 0, pending: 0, total: 0 };
                  console.log(`CREATED THE BALANCES ARRAY OF ADDRESS ${sharedAddress} FOR ASSET ${asset}`);
                }

                console.log(`UPDATING BALANCE OF ${sharedAddress} FOR ASSET ${asset}: ${row.is_stable ? 'stable' : 'pending'} ${row.balance}`);
                assocBalances[asset][row.is_stable ? 'stable' : 'pending'] += row.balance;
                assocBalances[asset].total += row.balance;
              }

              resolve(assocBalances);
            }
          );
        });
      };

      self.getByteOrigin = function () {
        const db = require('byteballcore/db.js');

        return new Promise((resolve, reject) => {
          db.query(
            'SELECT shared_address, address FROM shared_address_signing_paths sasp WHERE sasp.address IN (SELECT address FROM my_addresses)',
            [],
            (rows) => {
              if (!rows || rows.length === 0) {
                resolve(null);
              } else if (rows.length > 1) {
                reject('MULTIPLE SHARED ADDRESSES ARE NOT YET SUPPORTED');
              } else {
                resolve(rows[0]);
              }
            }
          );
        }).then((sharedAddressObject) => {
          if (!sharedAddressObject) {
            return Promise.resolve(null);
          }

          return new Promise((resolve) => {
            db.query(
              'SELECT wallet FROM my_addresses WHERE address = ?',
              [sharedAddressObject.address],
              (rows) => {
                if (!rows || rows.length === 0) {
                  resolve(null);
                } else {
                  const focusedClient = profileService.focusedClient;

                  if (focusedClient.credentials.walletId === rows[0].wallet) {
                    resolve(sharedAddressObject.shared_address);
                  } else {
                    resolve(null);
                  }
                }
              }
            );
          });
        });
      };

      $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', () => {
        readMyAddresses().then((myAddresses) => {
          if (!myAddresses) {
            console.log('THIS WALLET DOES NOT HAVE ADDRESSES');
          }
          self.walletAddresses = [];
          myAddresses.forEach((addr) => {
            self.walletAddresses.push(addr.address);
          });
        });
        console.log('ACTIVATING');
        self.activate().then(
          (active) => {
            if (active) {
              console.log('FUNDING EXCHANGE CLIENT ACTIVATED');
              proofingService.readMasterAddress().then((masterAddress) => {
                dagcoinProtocolService.sendRequest(
                  self.bytesProviderDeviceAddress,
                  'load-address',
                  {
                    address: masterAddress
                  }
                );
              });
            } else {
              console.log('FUNDING EXCHANGE CLIENT STILL ACTIVATING. BE PATIENT');
            }
          },
          (err) => {
            console.log(`COULD NOT ACTIVATE FUNDING EXCHANGE CLIENT: ${err}`);
          }
        );
      });

      self.activate = activate;

      self.setIndex = (index) => {
        self.index = index;
      };

      return self;
    });
}());
