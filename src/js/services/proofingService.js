/* eslint-disable import/no-unresolved */
(function () {
  'use strict';

  angular.module('copayApp.services').factory('proofingService', (
    profileService,
    addressService,
    dagcoinProtocolService,
    $rootScope
  ) => {
    const root = {};

    root.initialized = false;

    root.readAddress = function (addressToBeProofed) {
      const db = require('byteballcore/db.js');

      const walletId = profileService.focusedClient.credentials.walletId;
      const signingPath = 'r';

      return new Promise((resolve, reject) => {
        db.query(
          'SELECT address, wallet, account, is_change, address_index, full_approval_date, device_address, definition ' +
          'FROM my_addresses JOIN wallets USING(wallet) JOIN wallet_signing_paths USING(wallet) ' +
          'WHERE address=? AND signing_path=?',
          [addressToBeProofed, signingPath],
          (rows) => {
            if (!rows || rows.length === 0) {
              reject(`CURRENT ADDRESS DEFINITION NOT FOUND FOR WALLET ${walletId} AND ADDRESS ${addressToBeProofed}`);
            }

            if (rows.length > 1) {
              reject(`TOO MANY CURRENT ADDRESS DEFINITIONS FOUND FOR WALLET ${walletId} AND ADDRESS ${addressToBeProofed}: ${rows.length}`);
            }

            resolve(rows[0]);
          });
      });
    };

    root.readCurrentAddress = function () {
      const db = require('byteballcore/db.js');

      const walletId = profileService.focusedClient.credentials.walletId;
      const signingPath = 'r';

      return new Promise((resolve, reject) => {
        addressService.getAddress(walletId, false, (err, address) => {
          if (!address) {
            reject('NO CURRENT ADDRESSES AVAILABLE');
          } else {
            resolve(address);
          }
        });
      }).then((currentAddress) => {
        console.log(`CURRENT ADDRESS FOUND: ${currentAddress}`);
        return new Promise((resolve, reject) => {
          db.query(
            'SELECT address, wallet, account, is_change, address_index, full_approval_date, device_address, definition ' +
            'FROM my_addresses JOIN wallets USING(wallet) JOIN wallet_signing_paths USING(wallet) ' +
            'WHERE address=? AND signing_path=?',
            [currentAddress, signingPath],
            (rows) => {
              if (!rows || rows.length === 0) {
                reject(`CURRENT ADDRESS DEFINITION NOT FOUND FOR WALLET ${walletId} AND ADDRESS ${currentAddress}`);
              }

              if (rows.length > 1) {
                reject(`TOO MANY CURRENT ADDRESS DEFINITIONS FOUND FOR WALLET ${walletId} AND ADDRESS ${currentAddress}: ${rows.length}`);
              }

              resolve(rows[0]);
            });
        });
      });
    };

    root.readMasterAddress = function () {
      const db = require('byteballcore/db.js');

      const walletId = profileService.focusedClient.credentials.walletId;
      const signingPath = 'r';

      return new Promise((resolve, reject) => {
        db.query(
          'SELECT address ' +
          'FROM my_addresses ' +
          'WHERE is_change = 0 ' +
          'AND address_index = 0 ' +
          'AND wallet = ?',
          [walletId],
          (rows) => {
            if (!rows || rows.length === 0) {
              reject(`MASTER ADDRESS NOT FOUND FOR WALLET ${walletId}`);
            }

            if (rows.length > 1) {
              reject(`TOO MANY MASTER ADDRESSES FOR WALLET ${walletId}: ${rows.length}`);
            }

            resolve(rows[0].address);
          }
        );
      }).then((masterAddress) => {
        console.log(`MASTER ADDRESS FOUND: ${masterAddress}`);
        return new Promise((resolve, reject) => {
          db.query(
            'SELECT address, wallet, account, is_change, address_index, full_approval_date, device_address, definition ' +
            'FROM my_addresses JOIN wallets USING(wallet) JOIN wallet_signing_paths USING(wallet) ' +
            'WHERE address=? AND signing_path=?',
            [masterAddress, signingPath],
            (rows) => {
              if (!rows || rows.length === 0) {
                reject(`MASTER ADDRESS DEFINITION NOT FOUND FOR WALLET ${walletId} AND ADDRESS ${masterAddress}`);
              }

              if (rows.length > 1) {
                reject(`TOO MANY MASTER ADDRESS DEFINITIONS FOUND FOR WALLET ${walletId} AND ADDRESS ${masterAddress}: ${rows.length}`);
              }

              resolve(rows[0]);
            });
        });
      });
    };

    root.proofAddress = function (addressToBeProofed) {
      return root.readAddress(addressToBeProofed).then((currentAddressObject) => {
        console.log(`ADDRESS ${addressToBeProofed} ${currentAddressObject ? '' : ' NOT '} FOUND IN THE LOCAL DATABASE`);
        return root.readMasterAddress().then((masterAddress) => {
          if (addressToBeProofed !== masterAddress.address) {
            currentAddressObject.master_address = masterAddress.address;
          }

          return Promise.resolve(currentAddressObject);
        });
      }).then((AddressToBeProofedObject) => {
        const proof = {
          address: AddressToBeProofedObject.address,
          address_definition: AddressToBeProofedObject.definition
        };

        return root.signWithAddress(addressToBeProofed, AddressToBeProofedObject.device_address).then((deviceAddressSignature) => {
          proof.device_address_signature = deviceAddressSignature;

          if (AddressToBeProofedObject.master_address) {
            return root.signWithMasterAddress(proof.address).then((masterAddressSignature) => {
              proof.master_address_signature = masterAddressSignature;
              proof.master_address = AddressToBeProofedObject.master_address;

              return Promise.resolve(proof);
            });
          }

          return Promise.resolve(proof);
        });
      });
    };

    root.proofCurrentAddress = function () {
      return root.readCurrentAddress().then(currentAddressObject =>
        root.readMasterAddress().then((masterAddress) => {
          if (currentAddressObject.address !== masterAddress.address) {
            currentAddressObject.master_address = masterAddress.address;
          }

          return Promise.resolve(currentAddressObject);
        })
      ).then((currentAddressObject) => {
        const proof = {
          address: currentAddressObject.address,
          address_definition: currentAddressObject.definition
        };

        return root.signWithCurrentAddress(currentAddressObject.device_address).then((deviceAddressSignature) => {
          proof.device_address_signature = deviceAddressSignature;

          if (currentAddressObject.master_address) {
            return root.signWithMasterAddress(proof.address).then((masterAddressSignature) => {
              proof.master_address_signature = masterAddressSignature;
              proof.master_address = currentAddressObject.master_address;

              return Promise.resolve(proof);
            });
          }

          return Promise.resolve(proof);
        });
      });
    };

    root.proofMasterAddress = function () {
      return root.readMasterAddress().then(masterAddress => root.proofAddress(masterAddress.address));
    };

    root.signWithMasterAddress = (text) => {
      const xPrivKey = profileService.focusedClient.credentials.xPrivKey;

      return root.readMasterAddress().then((master) => {
        const Bitcore = require('bitcore-lib');
        const PrivateKey = require('bitcore-lib/lib/privatekey');
        const ecdsaSig = require('byteballcore/signature.js');

        const path = `m/44'/0'/${master.account}'/${master.is_change}/${master.address_index}`;
        const privateKey = new Bitcore.HDPrivateKey.fromString(xPrivKey).derive(path); // eslint-disable-line new-cap
        const privKeyBuf = privateKey.privateKey.bn.toBuffer({ size: 32 }); // https://github.com/bitpay/bitcore-lib/issues/47

        if (!PrivateKey.isValid(privateKey.privateKey)) {
          const Networks = require('bitcore-lib/lib/networks');
          const error = PrivateKey.getValidationError(xPrivKey, Networks.defaultNetwork);
          if (error) {
            return Promise.reject(`INVALID PRIVATE KEY (${xPrivKey}) : ${error}`);
          }
        }

        const crypto = require('crypto');
        const bufToSign = crypto.createHash('sha256').update(text, 'utf8').digest();

        return Promise.resolve(ecdsaSig.sign(bufToSign, privKeyBuf));
      });
    };

    root.signWithAddress = (address, text) => {
      const xPrivKey = profileService.focusedClient.credentials.xPrivKey;

      return root.readAddress(address).then((addressObject) => {
        const Bitcore = require('bitcore-lib');
        const PrivateKey = require('bitcore-lib/lib/privatekey');
        const ecdsaSig = require('byteballcore/signature.js');

        const path = `m/44'/0'/${addressObject.account}'/${addressObject.is_change}/${addressObject.address_index}`;
        const privateKey = new Bitcore.HDPrivateKey.fromString(xPrivKey).derive(path); // eslint-disable-line new-cap
        const privKeyBuf = privateKey.privateKey.bn.toBuffer({ size: 32 }); // https://github.com/bitpay/bitcore-lib/issues/47

        if (!PrivateKey.isValid(privateKey.privateKey)) {
          const Networks = require('bitcore-lib/lib/networks');
          const error = PrivateKey.getValidationError(xPrivKey, Networks.defaultNetwork);
          if (error) {
            return Promise.reject(`INVALID PRIVATE KEY (${xPrivKey}) : ${error}`);
          }
        }

        const crypto = require('crypto');
        const bufToSign = crypto.createHash('sha256').update(text, 'utf8').digest();

        return Promise.resolve(ecdsaSig.sign(bufToSign, privKeyBuf));
      });
    };

    root.signWithCurrentAddress = (text) => {
      const xPrivKey = profileService.focusedClient.credentials.xPrivKey;

      return root.readCurrentAddress().then((current) => {
        const Bitcore = require('bitcore-lib');
        const PrivateKey = require('bitcore-lib/lib/privatekey');
        const ecdsaSig = require('byteballcore/signature.js');

        const path = `m/44'/0'/${current.account}'/${current.is_change}/${current.address_index}`;
        const privateKey = new Bitcore.HDPrivateKey.fromString(xPrivKey).derive(path); // eslint-disable-line new-cap
        const privKeyBuf = privateKey.privateKey.bn.toBuffer({ size: 32 }); // https://github.com/bitpay/bitcore-lib/issues/47

        if (!PrivateKey.isValid(privateKey.privateKey)) {
          const Networks = require('bitcore-lib/lib/networks');
          const error = PrivateKey.getValidationError(xPrivKey, Networks.defaultNetwork);
          if (error) {
            return Promise.reject(`INVALID PRIVATE KEY (${xPrivKey}) : ${error}`);
          }
        }

        const crypto = require('crypto');
        const bufToSign = crypto.createHash('sha256').update(text, 'utf8').digest();

        return Promise.resolve(ecdsaSig.sign(bufToSign, privKeyBuf));
      });
    };

    root.buildListWithEnoughDagcoinsForFunding = function (addressList, fundingList, total) {
      const db = require('byteballcore/db');
      const constants = require('byteballcore/constants');

      console.log(`LIST: ${JSON.stringify(addressList)}`);

      if (!addressList || addressList.length === 0) {
        // CONDITION FULFILLED
        // TODO: use a value from the funding node or use some constants
        if (total > 500000) {
          return Promise.resolve(fundingList);
        }

        return Promise.reject('THERE ARE NOT ENOUGH DAGCOINS ON THIS WALLET FOR FUNDING');
      }

      const address = addressList.pop().address;

      return new Promise((resolve, reject) => {
        db.query(
          'SELECT asset, address, is_stable, SUM(amount) AS balance ' +
          'FROM outputs CROSS JOIN units USING(unit) ' +
          'WHERE is_spent=0 AND sequence=\'good\' AND address = ? ' +
          'GROUP BY asset, address, is_stable ' +
          'UNION ALL ' +
          'SELECT NULL AS asset, address, 1 AS is_stable, SUM(amount) AS balance FROM witnessing_outputs ' +
          'WHERE is_spent=0 AND address = ? GROUP BY address ' +
          'UNION ALL ' +
          'SELECT NULL AS asset, address, 1 AS is_stable, SUM(amount) AS balance FROM headers_commission_outputs ' +
          'WHERE is_spent=0 AND address = ? GROUP BY address',
          [address, address, address],
          (rows) => {
            let totalAmount = 0;

            if (rows && rows.length > 0) {
              for (let i = 0; i < rows.length; i += 1) {
                const row = rows[i];

                if (row.asset === constants.DAGCOIN_ASSET) {
                  totalAmount += row.balance;
                }
              }
            }

            if (totalAmount > 0) {
              fundingList.push(address);

              const fundingTotal = total + totalAmount;

              if (fundingTotal < 500000) {
                root.buildListWithEnoughDagcoinsForFunding(addressList, fundingList, fundingTotal).then(
                  (list) => {
                    resolve(list);
                  }, (error) => {
                    reject(error);
                  }
                );
              } else {
                root.buildListWithEnoughDagcoinsForFunding([], fundingList, fundingTotal).then(
                  (list) => {
                    resolve(list);
                  }, (error) => {
                    reject(error);
                  }
                );
              }
            } else {
              // Just removed an empty address from the address list
              root.buildListWithEnoughDagcoinsForFunding(addressList, fundingList, total).then(
                (list) => {
                  resolve(list);
                }, (error) => {
                  reject(error);
                }
              );
            }
          });
      });
    };

    root.getAddressListWithEnoughDagcoins = function () {
      const db = require('byteballcore/db.js');
      const walletId = profileService.focusedClient.credentials.walletId;

      console.log(`WALLET: ${walletId}`);

      return new Promise((resolve, reject) => {
        db.query(
          'SELECT address FROM my_addresses WHERE wallet = ?',
          [walletId],
          (rows) => {
            if (!rows || rows.length === 0) {
              reject('NO ADDRESSES AVAILABLE');
            } else {
              resolve(rows);
            }
          }
        );
      }).then(addressList => root.buildListWithEnoughDagcoinsForFunding(addressList, [], 0));
    };

    $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', () => {
      if (root.initialized) {
        return;
      }

      root.initialized = true;

      const eventBus = require('byteballcore/event_bus.js');

      eventBus.on('dagcoin.request.have-dagcoins', (request, fromAddress) => {
        console.log(`NEW DAGCOIN CARRYING ADDRESS LIST REQUEST FROM ${fromAddress}: ${JSON.stringify(request)}`);

        const response = {};

        console.log('BEFORE getAddressListWithEnoughDagcoins BEGINS');

        root.getAddressListWithEnoughDagcoins().then((addressList) => {
          console.log(`DAGCOIN CARRYING ADDRESSES: ${addressList}`);

          const proofingPromises = [];

          addressList.forEach((addressToBeProofed) => {
            proofingPromises.push(root.proofAddress(addressToBeProofed));
          });

          return Promise.all(proofingPromises).then((proofs) => {
            response.proofs = proofs;
          });
        }).then(
          () => {
            dagcoinProtocolService.sendResponse(fromAddress, request, response);
          }, (error) => {
            console.error(`REPLYING TO DAGCOIN CARRYING ADDRESS LIST REQUEST WITH ERROR: ${error} `);
            response.error = error;
            dagcoinProtocolService.sendResponse(fromAddress, request, response);
          }
        );
      });

      eventBus.on('dagcoin.request.proofing', (request, fromAddress) => {
        console.log(`NEW PROOFING REQUEST FROM ${fromAddress}: ${JSON.stringify(request)}`);

        const response = {};

        const addressesToBeProofed = request.messageBody.addresses;

        if (!addressesToBeProofed || addressesToBeProofed.length === 0) {
          response.error = 'No addresses specified for proofing';
          dagcoinProtocolService.sendResponse(fromAddress, 'proofing', response);
        } else {
          const proofingPromises = [];

          addressesToBeProofed.forEach((addressToBeProofed) => {
            proofingPromises.push(root.proofAddress(addressToBeProofed));
          });

          Promise.all(proofingPromises).then(
            (proofs) => {
              response.proofs = proofs;
            },
            (error) => {
              console.error(`REPLYING TO PROOFING REQUEST WITH ERROR: ${error.message} `);
              response.error = error.message;
            }
          ).then(() => {
            dagcoinProtocolService.sendResponse(fromAddress, request, response);
          });
        }
      });
    });

    return root;
  });
}());
