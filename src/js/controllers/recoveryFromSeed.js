/* eslint-disable no-useless-concat,import/no-extraneous-dependencies,no-shadow */
(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('recoveryFromSeed',
    function ($rootScope, $scope, $log, $timeout, profileService) {
      const async = require('async');
      const conf = require('byteballcore/conf.js');
      const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
      const objectHash = require('byteballcore/object_hash.js');
      let ecdsa;
      try {
        ecdsa = require('secp256k1');
      } catch (e) {
        ecdsa = require('byteballcore/node_modules/secp256k1' + '');
      }
      const Mnemonic = require('bitcore-mnemonic');
      const Bitcore = require('bitcore-lib');
      const db = require('byteballcore/db.js');
      const network = require('byteballcore/network');
      const myWitnesses = require('byteballcore/my_witnesses');

      const self = this;

      self.error = '';
      self.bLight = conf.bLight;
      self.scanning = false;
      self.inputMnemonic = '';
      self.xPrivKey = '';
      self.assocIndexesToWallets = {};

      function determineIfAddressUsed(address, cb) {
        db.query('SELECT 1 FROM outputs WHERE address = ? LIMIT 1', [address], (outputsRows) => {
          if (outputsRows.length === 1) { cb(true); } else {
            db.query('SELECT 1 FROM unit_authors WHERE address = ? LIMIT 1', [address], (unitAuthorsRows) => {
              cb(unitAuthorsRows.length === 1);
            });
          }
        });
      }

      function scanForAddressesAndWallets(mnemonic, cb) {
        self.xPrivKey = new Mnemonic(mnemonic).toHDPrivateKey();
        let xPubKey;
        let lastUsedAddressIndex = -1;
        let lastUsedWalletIndex = -1;
        let currentAddressIndex = 0;
        let currentWalletIndex = 0;
        const assocMaxAddressIndexes = {};

        function checkAndAddCurrentAddress(isChange) {
          const address = objectHash.getChash160(['sig', { pubkey: walletDefinedByKeys.derivePubkey(xPubKey, `m/${isChange}/${currentAddressIndex}`) }]);
          determineIfAddressUsed(address, (bUsed) => {
            if (bUsed) {
              lastUsedAddressIndex = currentAddressIndex;
              if (!assocMaxAddressIndexes[currentWalletIndex]) assocMaxAddressIndexes[currentWalletIndex] = { main: 0 };
              if (isChange) {
                assocMaxAddressIndexes[currentWalletIndex].change = currentAddressIndex;
              } else {
                assocMaxAddressIndexes[currentWalletIndex].main = currentAddressIndex;
              }
              currentAddressIndex += 1;
              checkAndAddCurrentAddress(isChange);
            } else {
              currentAddressIndex += 1;
              if (currentAddressIndex - lastUsedAddressIndex >= 20) {
                if (isChange) {
                  if (lastUsedAddressIndex !== -1) {
                    lastUsedWalletIndex = currentWalletIndex;
                  }
                  if (currentWalletIndex - lastUsedWalletIndex >= 20) {
                    cb(assocMaxAddressIndexes);
                  } else {
                    currentWalletIndex += 1;
                    setCurrentWallet();
                  }
                } else {
                  currentAddressIndex = 0;
                  checkAndAddCurrentAddress(1);
                }
              } else {
                checkAndAddCurrentAddress(isChange);
              }
            }
          });
        }

        function setCurrentWallet() {
          xPubKey = Bitcore.HDPublicKey(self.xPrivKey.derive(`m/44'/0'/${currentWalletIndex}'`));
          lastUsedAddressIndex = -1;
          currentAddressIndex = 0;
          checkAndAddCurrentAddress(0);
        }

        setCurrentWallet();
      }

      function removeAddressesAndWallets(cb) {
        const arrQueries = [];
        db.addQuery(arrQueries, 'DELETE FROM pending_shared_address_signing_paths');
        db.addQuery(arrQueries, 'DELETE FROM shared_address_signing_paths');
        db.addQuery(arrQueries, 'DELETE FROM pending_shared_addresses');
        db.addQuery(arrQueries, 'DELETE FROM shared_addresses');
        db.addQuery(arrQueries, 'DELETE FROM my_addresses');
        db.addQuery(arrQueries, 'DELETE FROM wallet_signing_paths');
        db.addQuery(arrQueries, 'DELETE FROM extended_pubkeys');
        db.addQuery(arrQueries, 'DELETE FROM wallets');
        db.addQuery(arrQueries, 'DELETE FROM correspondent_devices');

        async.series(arrQueries, cb);
      }

      function createAddresses(assocMaxAddressIndexes, cb) {
        const accounts = Object.keys(assocMaxAddressIndexes);
        let currentAccount = 0;

        function addAddress(wallet, isChange, index, maxIndex) {
          walletDefinedByKeys.issueAddress(wallet, isChange, index, () => {
            let ind = index;
            ind += 1;
            if (ind <= maxIndex) {
              addAddress(wallet, isChange, ind, maxIndex);
            } else if (isChange) {
              currentAccount += 1;
              if (currentAccount < accounts.length) {
                startAddToNewWallet(0);
              } else {
                cb();
              }
            } else {
              startAddToNewWallet(1);
            }
          });
        }

        function startAddToNewWallet(isChange) {
          if (isChange) {
            if (assocMaxAddressIndexes[accounts[currentAccount]].change !== undefined) {
              addAddress(self.assocIndexesToWallets[accounts[currentAccount]], 1, 0, assocMaxAddressIndexes[accounts[currentAccount]].change);
            } else {
              currentAccount += 1;
              if (currentAccount < accounts.length) {
                startAddToNewWallet(0);
              } else {
                cb();
              }
            }
          } else {
            addAddress(self.assocIndexesToWallets[accounts[currentAccount]], 0, 0, assocMaxAddressIndexes[accounts[currentAccount]].main + 20);
          }
        }


        startAddToNewWallet(0);
      }

      function createWallets(arrWalletIndexes, cb) {
        function createWallet(n) {
          let walletIndex = n;
          const account = parseInt(arrWalletIndexes[walletIndex], 10);
          const opts = {};
          opts.m = 1;
          opts.n = 1;
          opts.name = `Wallet #${account}`;
          opts.network = 'livenet';
          opts.cosigners = [];
          opts.extendedPrivateKey = self.xPrivKey;
          opts.mnemonic = self.inputMnemonic;
          opts.account = account;

          profileService.createWallet(opts, (err, walletId) => {
            self.assocIndexesToWallets[account] = walletId;
            walletIndex += 1;
            if (walletIndex < arrWalletIndexes.length) {
              createWallet(walletIndex);
            } else {
              cb();
            }
          });
        }

        createWallet(0);
      }

      function scanForAddressesAndWalletsInLightClient(mnemonic, cb) {
        self.xPrivKey = new Mnemonic(mnemonic).toHDPrivateKey();
        let xPubKey;
        let currentWalletIndex = 0;
        let lastUsedWalletIndex = -1;
        const assocMaxAddressIndexes = {};

        function checkAndAddCurrentAddresses(isChange) {
          if (!assocMaxAddressIndexes[currentWalletIndex]) {
            assocMaxAddressIndexes[currentWalletIndex] = {
              main: 0,
              change: 0
            };
          }
          const arrTmpAddresses = [];
          for (let i = 0; i < 20; i += 1) {
            const index = (isChange ? assocMaxAddressIndexes[currentWalletIndex].change : assocMaxAddressIndexes[currentWalletIndex].main) + i;
            arrTmpAddresses.push(objectHash.getChash160(['sig', { pubkey: walletDefinedByKeys.derivePubkey(xPubKey, `m/${isChange}/${index}`) }]));
          }
          myWitnesses.readMyWitnesses((arrWitnesses) => {
            network.requestFromLightVendor('light/get_history', {
              addresses: arrTmpAddresses,
              witnesses: arrWitnesses
            }, (ws, request, response) => {
              if (response && response.error) {
                const breadcrumbs = require('byteballcore/breadcrumbs.js');
                breadcrumbs.add(`Error scanForAddressesAndWalletsInLightClient: ${response.error}`);
                self.error = 'When scanning an error occurred, please try again later.';
                self.scanning = false;
                $timeout(() => {
                  $rootScope.$apply();
                });
                return;
              }
              if (Object.keys(response).length) {
                lastUsedWalletIndex = currentWalletIndex;
                if (isChange) {
                  assocMaxAddressIndexes[currentWalletIndex].change += 20;
                } else {
                  assocMaxAddressIndexes[currentWalletIndex].main += 20;
                }
                checkAndAddCurrentAddresses(isChange);
              } else if (isChange) {
                if (assocMaxAddressIndexes[currentWalletIndex].change === 0
                  && assocMaxAddressIndexes[currentWalletIndex].main === 0) {
                  delete assocMaxAddressIndexes[currentWalletIndex];
                }
                currentWalletIndex += 1;
                if (currentWalletIndex - lastUsedWalletIndex > 3) {
                  cb(assocMaxAddressIndexes);
                } else {
                  setCurrentWallet();
                }
              } else {
                checkAndAddCurrentAddresses(1);
              }
            });
          });
        }

        function setCurrentWallet() {
          xPubKey = Bitcore.HDPublicKey(self.xPrivKey.derive(`m/44'/0'/${currentWalletIndex}'`));
          checkAndAddCurrentAddresses(0);
        }

        setCurrentWallet();
      }

      function cleanAndAddWalletsAndAddresses(assocMaxAddressIndexes) {
        const device = require('byteballcore/device');
        const arrWalletIndexes = Object.keys(assocMaxAddressIndexes);
        if (arrWalletIndexes.length) {
          removeAddressesAndWallets(() => {
            const myDeviceAddress = objectHash.getDeviceAddress(ecdsa.publicKeyCreate(self.xPrivKey.derive("m/1'").privateKey.bn.toBuffer({ size: 32 }), true).toString('base64'));
            profileService.replaceProfile(self.xPrivKey.toString(), self.inputMnemonic, myDeviceAddress, () => {
              device.setDevicePrivateKey(self.xPrivKey.derive("m/1'").privateKey.bn.toBuffer({ size: 32 }));
              createWallets(arrWalletIndexes, () => {
                createAddresses(assocMaxAddressIndexes, () => {
                  self.scanning = false;
                  $rootScope.$emit('Local/ShowAlert', `${arrWalletIndexes.length} wallets recovered, please restart the application to finish.`, 'fi-check', () => {
                    if (navigator && navigator.app) {  // android
                      navigator.app.exitApp();
                    } else if (process.exit) { // nwjs
                      process.exit();
                    }
                  });
                });
              });
            });
          });
        } else {
          self.error = 'No active addresses found.';
          self.scanning = false;
          $timeout(() => {
            $rootScope.$apply();
          });
        }
      }

      self.recoveryForm = function () {
        if (self.inputMnemonic) {
          self.error = '';
          self.inputMnemonic = self.inputMnemonic.toLowerCase();
          if ((self.inputMnemonic.split(' ').length % 3 === 0) && Mnemonic.isValid(self.inputMnemonic)) {
            self.scanning = true;
            if (self.bLight) {
              scanForAddressesAndWalletsInLightClient(self.inputMnemonic, cleanAndAddWalletsAndAddresses);
            } else {
              scanForAddressesAndWallets(self.inputMnemonic, cleanAndAddWalletsAndAddresses);
            }
          } else {
            self.error = 'Seed is not valid';
          }
        }
      };
    });
}());
