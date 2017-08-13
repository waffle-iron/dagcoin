/* eslint-disable no-unused-vars */
(function () {
  'use strict';

  angular.module('copayApp.services')
  .factory('profileService', ($rootScope,
                              $location,
                              $timeout,
                              $filter,
                              $log,
                              lodash,
                              storageService,
                              bwcService,
                              configService,
                              pushNotificationsService,
                              isCordova,
                              gettext,
                              gettextCatalog,
                              nodeWebkit,
                              uxLanguage) => {
    const root = {};
    const breadcrumbs = require('byteballcore/breadcrumbs.js');
    root.profile = null;
    root.focusedClient = null;
    root.walletClients = {};

    root.Utils = bwcService.getUtils();
    root.formatAmount = function (amount, asset, opts) {
      const options = opts || { dontRound: true };
      const config = configService.getSync().wallet.settings;
      // if (config.unitCode == 'byte') return amount;

      // TODO : now only works for english, specify opts to change thousand separator and decimal separator
      if (asset.toLowerCase() === 'dag') {
        return this.Utils.formatAmount(amount, config.dagUnitCode, options);
      }
      return this.Utils.formatAmount(amount, config.unitCode, options);
    };

    root.setFocus = function (walletId, cb) {
      $log.debug('Set focus:', walletId);

      // Set local object
      if (walletId) {
        root.focusedClient = root.walletClients[walletId];
      } else {
        root.focusedClient = [];
      }

      if (lodash.isEmpty(root.focusedClient)) {
        root.focusedClient = root.walletClients[lodash.keys(root.walletClients)[0]];
      }

      // Still nothing?
      if (lodash.isEmpty(root.focusedClient)) {
        $rootScope.$emit('Local/NoWallets');
      } else {
        $rootScope.$emit('Local/NewFocusedWallet');
      }

      return cb();
    };

    root.setAndStoreFocus = function (walletId, cb) {
      root.setFocus(walletId, () => {
        storageService.storeFocusedWalletId(walletId, cb);
      });
    };

    root.setWalletClient = function (credentials) {
      if (root.walletClients[credentials.walletId] && root.walletClients[credentials.walletId].started) {
        return;
      }

      const client = bwcService.getClient(JSON.stringify(credentials));

      client.credentials.xPrivKey = root.profile.xPrivKey;
      client.credentials.mnemonic = root.profile.mnemonic;
      client.credentials.xPrivKeyEncrypted = root.profile.xPrivKeyEncrypted;
      client.credentials.mnemonicEncrypted = root.profile.mnemonicEncrypted;
      root.walletClients[credentials.walletId] = client;
      root.walletClients[credentials.walletId].started = true;

      client.initialize({}, (initializeError) => {
        if (initializeError) {
          // impossible
          $log.info(initializeError);
        }
      });
    };

    root.setWalletClients = function () {
      const credentials = root.profile.credentials;
      lodash.each(credentials, (credential) => {
        root.setWalletClient(credential);
      });
      $rootScope.$emit('Local/WalletListUpdated');
    };


    function saveTempKeys(tempDeviceKey, prevTempDeviceKey, onDone) {
      console.log('will save temp device keys');// , tempDeviceKey, prevTempDeviceKey);
      root.profile.tempDeviceKey = tempDeviceKey.toString('base64');
      if (prevTempDeviceKey) {
        root.profile.prevTempDeviceKey = prevTempDeviceKey.toString('base64');
      }
      storageService.storeProfile(root.profile, (storeProfileError) => {
        onDone(storeProfileError);
      });
    }

    function unlockWalletAndInitDevice() {
      // wait till the wallet fully loads
      breadcrumbs.add('unlockWalletAndInitDevice');
      const removeListener = $rootScope.$on('Local/BalanceUpdated', (event, ab) => {
        removeListener();
        breadcrumbs.add('unlockWalletAndInitDevice BalanceUpdated');
        root.insistUnlockFC(null, () => {
          breadcrumbs.add('unlockWalletAndInitDevice unlocked');
          if (!root.focusedClient.credentials.xPrivKey) {
            throw Error('xPrivKey still not set after unlock');
          }
          console.log(`unlocked: ${root.focusedClient.credentials.xPrivKey}`);
          const config = configService.getSync();
          root.focusedClient.initDeviceProperties(
            root.focusedClient.credentials.xPrivKey, root.profile.my_device_address, config.hub, config.deviceName);
          $rootScope.$emit('Local/BalanceUpdatedAndWalletUnlocked', ab);
        });
      });
    }

    root.bindProfile = function (profile, cb) {
      breadcrumbs.add('bindProfile');
      root.profile = profile;
      configService.get((configServiceError) => {
        $log.debug('Preferences read');
        if (configServiceError) {
          return cb(configServiceError);
        }
        root.setWalletClients();
        return storageService.getFocusedWalletId((storageServiceError, focusedWalletId) => {
          if (storageServiceError) {
            return cb(storageServiceError);
          }
          return root.setFocus(focusedWalletId, () => {
            console.log('focusedWalletId', focusedWalletId);
            require('byteballcore/wallet.js');
            const device = require('byteballcore/device.js');
            const config = configService.getSync();
            const firstWc = root.walletClients[lodash.keys(root.walletClients)[0]];
            if (root.profile.xPrivKeyEncrypted) {
              console.log('priv key is encrypted, will wait for UI and request password');
              // assuming bindProfile is called on encrypted keys only at program startup
              unlockWalletAndInitDevice();
              device.setDeviceAddress(root.profile.my_device_address);
            } else if (root.profile.xPrivKey) {
              root.focusedClient.initDeviceProperties(profile.xPrivKey, root.profile.my_device_address, config.hub, config.deviceName);
            } else {
              throw Error('neither xPrivKey nor xPrivKeyEncrypted');
            }
            // var tempDeviceKey = device.genPrivKey();
            // saveTempKeys(tempDeviceKey, null, function(){});
            const tempDeviceKey = Buffer.from(profile.tempDeviceKey, 'base64');
            const prevTempDeviceKey = profile.prevTempDeviceKey ? Buffer.from(profile.prevTempDeviceKey, 'base64') : null;
            device.setTempKeys(tempDeviceKey, prevTempDeviceKey, saveTempKeys);
            $rootScope.$emit('Local/ProfileBound');
            return cb();
          });
        });
      });
    };

    root.loadAndBindProfile = function (cb) {
      breadcrumbs.add('loadAndBindProfile');
      storageService.getDisclaimerFlag((storageServiceError, val) => {
        if (!val) {
          breadcrumbs.add('Non agreed disclaimer');
          return cb(new Error('NONAGREEDDISCLAIMER: Non agreed disclaimer'));
        }
        return storageService.getProfile((getProfileError, profile) => {
          if (getProfileError) {
            $rootScope.$emit('Local/DeviceError', getProfileError);
            return cb(getProfileError);
          }
          if (!profile) {
            breadcrumbs.add('no profile');
            return cb(new Error('NOPROFILE: No profile'));
          }
          $log.debug('Profile read');
          return root.bindProfile(profile, cb);
        });
      });
    };


    root.seedWallet = function (opts, cb) {
      const options = opts || {};
      const walletClient = bwcService.getClient();
      const network = options.networkName || 'livenet';


      if (options.mnemonic) {
        try {
          options.mnemonic = root.normalizeMnemonic(options.mnemonic);
          walletClient.seedFromMnemonic(options.mnemonic, {
            network,
            passphrase: options.passphrase,
            account: options.account || 0,
            derivationStrategy: options.derivationStrategy || 'BIP44',
          });
        } catch (ex) {
          $log.info(ex);
          return cb(gettext('Could not create: Invalid wallet seed'));
        }
      } else if (options.extendedPrivateKey) {
        try {
          walletClient.seedFromExtendedPrivateKey(options.extendedPrivateKey, options.account || 0);
        } catch (ex) {
          $log.warn(ex);
          return cb(gettext('Could not create using the specified extended private key'));
        }
      } else if (options.extendedPublicKey) {
        try {
          walletClient.seedFromExtendedPublicKey(options.extendedPublicKey, options.externalSource, options.entropySource, {
            account: options.account || 0,
            derivationStrategy: options.derivationStrategy || 'BIP44',
          });
        } catch (ex) {
          $log.warn('Creating wallet from Extended Public Key Arg:', ex, options);
          return cb(gettext('Could not create using the specified extended public key'));
        }
      } else {
        const lang = uxLanguage.getCurrentLanguage();
        console.log(`will seedFromRandomWithMnemonic for language ${lang}`);
        try {
          walletClient.seedFromRandomWithMnemonic({
            network,
            passphrase: options.passphrase,
            language: lang,
            account: options.account || 0,
          });
        } catch (e) {
          $log.info(`Error creating seed: ${e.message}`);
          if (e.message.indexOf('language') > 0) {
            $log.info('Using default language for mnemonic');
            walletClient.seedFromRandomWithMnemonic({
              network,
              passphrase: options.passphrase,
              account: options.account || 0,
            });
          } else {
            return cb(e);
          }
        }
      }
      return cb(null, walletClient);
    };


    root.createNewProfile = function (opts, cb) {
      console.log('createNewProfile');
      if (opts.noWallet) {
        return cb(null, Profile.create());
      }
      return root.seedWallet({}, (seedWalletError, walletClient) => {
        if (seedWalletError) {
          return cb(seedWalletError);
        }
        const config = configService.getSync();
        const device = require('byteballcore/device.js');
        const tempDeviceKey = device.genPrivKey();
        // initDeviceProperties sets my_device_address needed by walletClient.createWallet
        walletClient.initDeviceProperties(walletClient.credentials.xPrivKey, null, config.hub, config.deviceName);
        const walletName = gettextCatalog.getString('Small Expenses Wallet');
        return walletClient.createWallet(walletName, 1, 1, {
          network: 'livenet',
        }, (error) => {
          if (error) {
            return cb(`${gettext('Error creating wallet')}: ${error}`);
          }
          console.log('created wallet, client:', walletClient);
          const xPrivKey = walletClient.credentials.xPrivKey;
          const mnemonic = walletClient.credentials.mnemonic;
          console.log(`mnemonic: ${mnemonic}`);
          const p = Profile.create({
            credentials: [JSON.parse(walletClient.export())],
            xPrivKey,
            mnemonic,
            tempDeviceKey: tempDeviceKey.toString('base64'),
            my_device_address: device.getMyDeviceAddress(),
          });
          device.setTempKeys(tempDeviceKey, null, saveTempKeys);
          return cb(null, p);
        });
      });
    };

    // create additional wallet (the first wallet is created in _createNewProfile())
    root.createWallet = function (opts, cb) {
      $log.debug('Creating Wallet:', opts);
      if (!root.focusedClient.credentials.xPrivKey) { // locked
        root.unlockFC(null, (unlockFCError) => {
          if (unlockFCError) {
            return cb(unlockFCError.message);
          }
          return root.createWallet(opts, cb);
        });
        return console.log('need password to create new wallet');
      }
      const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
      return walletDefinedByKeys.readNextAccount((account) => {
        console.log(`next account = ${account}`);
        if (!opts.extendedPrivateKey && !opts.mnemonic) {
          if (!root.focusedClient.credentials.xPrivKey) {
            throw Error('no root.focusedClient.credentials.xPrivKey');
          }
          $log.debug('reusing xPrivKey from focused client');
          opts.extendedPrivateKey = root.focusedClient.credentials.xPrivKey;
          opts.mnemonic = root.profile.mnemonic;
          opts.account = account;
        }
        root.seedWallet(opts, (seedWalletError, walletClient) => {
          if (seedWalletError) {
            return cb(seedWalletError);
          }

          return walletClient.createWallet(opts.name, opts.m, opts.n, {
            network: opts.networkName,
            account: opts.account,
            cosigners: opts.cosigners,
          }, (error) => {
            if (error) {
              return cb(`${gettext('Error creating wallet')}: ${error}`);
            }
            return root.addWalletClient(walletClient, opts, cb);
          });
        });
      });
    };


    root.getClient = walletId => root.walletClients[walletId];

    root.deleteWallet = function (opts, cb) {
      const client = opts.client || root.focusedClient;
      const walletId = client.credentials.walletId;
      $log.debug('Deleting Wallet:', client.credentials.walletName);
      breadcrumbs.add(`Deleting Wallet: ${client.credentials.walletName}`);

      root.profile.credentials = lodash.reject(root.profile.credentials, {
        walletId,
      });

      delete root.walletClients[walletId];
      root.focusedClient = null;

      storageService.clearBackupFlag(walletId, (clearBackupFlagError) => {
        if (clearBackupFlagError) {
          $log.warn(clearBackupFlagError);
        }
      });

      $timeout(() => {
        root.setWalletClients();
        root.setAndStoreFocus(null, () => {
          storageService.storeProfile(root.profile, (storeProfileError) => {
            if (storeProfileError) return cb(storeProfileError);
            return cb();
          });
        });
      });
    };

    root.setMetaData = function (walletClient, addressBook, cb) {
      storageService.getAddressbook(walletClient.credentials.network, (walletClientError, localAddressBook) => {
        let localAddressBook1 = {};
        try {
          localAddressBook1 = JSON.parse(localAddressBook);
        } catch (ex) {
          $log.warn(ex);
        }
        const mergeAddressBook = lodash.merge(addressBook, localAddressBook1);
        storageService.setAddressbook(walletClient.credentials.network, JSON.stringify(addressBook), (setAddressbookError) => {
          if (setAddressbookError) return cb(setAddressbookError);
          return cb(null);
        });
      });
    };

    root.addWalletClient = function (walletClient, opts, cb) {
      const walletId = walletClient.credentials.walletId;

      // check if exists
      const w = lodash.find(root.profile.credentials, { walletId });
      if (w) {
        return cb(`Wallet already in Byteball: ${w.walletName}`);
      }

      root.profile.credentials.push(JSON.parse(walletClient.export()));
      root.setWalletClients();

      // assign wallet color based on first character of walletId
      const color = configService.colorOpts[walletId.charCodeAt(0) % configService.colorOpts.length];
      const configOpts = { colorFor: {} };
      configOpts.colorFor[walletId] = color;
      return configService.set(configOpts, configServiceError => root.setAndStoreFocus(walletId, () => {
        if (configServiceError) return cb(configServiceError);
        return storageService.storeProfile(root.profile, (storeProfileError) => {
          const config = configService.getSync();
          cb(storeProfileError, walletId);
        });
      }));
    };


    root.importWallet = function (str, opts, cb) {
      const walletClient = bwcService.getClient();

      $log.debug('Importing Wallet:', opts);
      try {
        walletClient.import(str, {
          compressed: opts.compressed,
          password: opts.password,
        });
      } catch (err) {
        $log.warn(err);
        return cb(gettext('Could not import. Check input file and password'));
      }

      const inputStr = JSON.parse(str);

      const addressBook = inputStr.addressBook || {};

      return root.addWalletClient(walletClient, opts, (addWalletClientError, walletId) => {
        if (addWalletClientError) return cb(addWalletClientError);
        return root.setMetaData(walletClient, addressBook, (setMetaDataError) => {
          if (setMetaDataError) console.log(setMetaDataError);
          return cb(setMetaDataError, walletId);
        });
      });
    };


    root.importExtendedPrivateKey = function (xPrivKey, opts, cb) {
      const walletClient = bwcService.getClient();
      $log.debug('Importing Wallet xPrivKey');

      walletClient.importFromExtendedPrivateKey(xPrivKey, (importFromExtendedPrivateKeyError) => {
        if (importFromExtendedPrivateKeyError) {
          return cb(`${gettext('Could not import')}: ${importFromExtendedPrivateKeyError}`);
        }

        return root.addWalletClient(walletClient, opts, cb);
      });
    };

    root.normalizeMnemonic = (words) => {
      const isJA = words.indexOf('\u3000') > -1;
      const wordList = words.split(/[\u3000\s]+/);

      return wordList.join(isJA ? '\u3000' : ' ');
    };


    root.importMnemonic = function (words, opts, cb) {
      const walletClient = bwcService.getClient();

      $log.debug('Importing Wallet Mnemonic');

      const inputWords = root.normalizeMnemonic(words);
      walletClient.importFromMnemonic(inputWords, {
        network: opts.networkName,
        passphrase: opts.passphrase,
        account: opts.account || 0,
      }, (err) => {
        if (err) {
          return cb(`${gettext('Could not import')}: ${err}`);
        }
        return root.addWalletClient(walletClient, opts, cb);
      });
    };


    root.importExtendedPublicKey = function (opts, cb) {
      const walletClient = bwcService.getClient();
      $log.debug('Importing Wallet XPubKey');

      walletClient.importFromExtendedPublicKey(opts.extendedPublicKey, opts.externalSource, opts.entropySource, {
        account: opts.account || 0,
        derivationStrategy: opts.derivationStrategy || 'BIP44',
      }, (err) => {
        if (err) {
          // in HW wallets, req key is always the same. They can't addAccess.
          if (err.code === 'NOT_AUTHORIZED') {
            err.code = 'WALLET_DOES_NOT_EXIST';
          }

          return cb(`${gettext('Could not import')}: ${err}`);
        }

        return root.addWalletClient(walletClient, opts, cb);
      });
    };


    root.create = function (opts, cb) {
      $log.info('Creating profile', opts);
      const defaults = configService.getDefaults();

      configService.get((configServiceError) => {
        if (configServiceError) return cb(configServiceError);
        return root.createNewProfile(opts, (createNewProfileError, p) => {
          if (createNewProfileError) return cb(createNewProfileError);
          return root.bindProfile(p, (bindProfileError) => {
            if (bindProfileError) cb(bindProfileError);
            storageService.storeNewProfile(p, storeNewProfileError => cb(storeNewProfileError));
          });
        });
      });
    };


    root.updateCredentialsFC = function (cb) {
      const fc = root.focusedClient;

      const newCredentials = lodash.reject(root.profile.credentials, {
        walletId: fc.credentials.walletId,
      });
      newCredentials.push(JSON.parse(fc.export()));
      root.profile.credentials = newCredentials;
      // root.profile.my_device_address = device.getMyDeviceAddress();

      storageService.storeProfile(root.profile, cb);
    };

    root.clearMnemonic = function (cb) {
      delete root.profile.mnemonic;
      delete root.profile.mnemonicEncrypted;
      Object.keys(root.walletClients).forEach((wid) => {
        root.walletClients[wid].clearMnemonic();
      });
      storageService.storeProfile(root.profile, cb);
    };

    root.setPrivateKeyEncryptionFC = function (password, cb) {
      const fc = root.focusedClient;
      $log.debug('Encrypting private key for', fc.credentials.walletName);

      fc.setPrivateKeyEncryption(password);
      if (!fc.credentials.xPrivKeyEncrypted) {
        throw Error('no xPrivKeyEncrypted after setting encryption');
      }
      root.profile.xPrivKeyEncrypted = fc.credentials.xPrivKeyEncrypted;
      root.profile.mnemonicEncrypted = fc.credentials.mnemonicEncrypted;
      delete root.profile.xPrivKey;
      delete root.profile.mnemonic;
      root.lockFC();
      Object.keys(root.walletClients).forEach((wid) => {
        root.walletClients[wid].credentials.xPrivKeyEncrypted = root.profile.xPrivKeyEncrypted;
        delete root.walletClients[wid].credentials.xPrivKey;
      });
      storageService.storeProfile(root.profile, () => {
        $log.debug('Wallet encrypted');
        return cb();
      });
      /* root.updateCredentialsFC(function() {
       $log.debug('Wallet encrypted');
       return cb();
       }); */
    };


    root.disablePrivateKeyEncryptionFC = function (cb) {
      const fc = root.focusedClient;
      $log.debug('Disabling private key encryption for', fc.credentials.walletName);

      try {
        fc.disablePrivateKeyEncryption();
      } catch (e) {
        return cb(e);
      }
      if (!fc.credentials.xPrivKey) {
        throw Error('no xPrivKey after disabling encryption');
      }
      root.profile.xPrivKey = fc.credentials.xPrivKey;
      root.profile.mnemonic = fc.credentials.mnemonic;
      delete root.profile.xPrivKeyEncrypted;
      delete root.profile.mnemonicEncrypted;
      Object.keys(root.walletClients).forEach((wid) => {
        root.walletClients[wid].credentials.xPrivKey = root.profile.xPrivKey;
        delete root.walletClients[wid].credentials.xPrivKeyEncrypted;
      });
      return storageService.storeProfile(root.profile, () => {
        $log.debug('Wallet encryption disabled');
        return cb();
      });
      /* root.updateCredentialsFC(function() {
       $log.debug('Wallet encryption disabled');
       return cb();
       }); */
    };

    root.lockFC = function () {
      const fc = root.focusedClient;
      try {
        fc.lock();
      } catch (ex) {
        $log.warn(ex);
      }
    };

    root.unlockFC = function (error, cb) {
      $log.debug('Wallet is encrypted');
      $rootScope.$emit('Local/NeedsPassword', false, error, (err2, password) => {
        if (err2 || !password) {
          return cb({
            message: (err2 || gettext('Password needed')),
          });
        }
        const fc = root.focusedClient;
        try {
          fc.unlock(password);
          breadcrumbs.add(`unlocked ${fc.credentials.walletId}`);
        } catch (e) {
          $log.debug(e);
          return cb({
            message: gettext('Wrong password'),
          });
        }
        const autolock = () => {
          if (root.bKeepUnlocked) {
            console.log('keeping unlocked');
            breadcrumbs.add('keeping unlocked');
            $timeout(autolock, 30 * 1000);
            return;
          }
          console.log('time to auto-lock wallet', fc.credentials);
          if (fc.hasPrivKeyEncrypted()) {
            $log.debug('Locking wallet automatically');
            try {
              fc.lock();
              breadcrumbs.add(`locked ${fc.credentials.walletId}`);
            } catch (ex) {
              $log.warn(ex);
            }
          }
        };
        $timeout(autolock, 30 * 1000);
        return cb();
      });
    };

    // continue to request password until the correct password is entered
    root.insistUnlockFC = function (insistUnlockFCError, cb) {
      root.unlockFC(insistUnlockFCError, (err) => {
        if (!err) {
          return cb();
        }
        return $timeout(() => {
          root.insistUnlockFC(err.message, cb);
        }, 1000);
      });
    };

    root.getWallets = function (network) {
      if (!root.profile) return [];

      const config = configService.getSync();
      config.colorFor = config.colorFor || {};
      config.aliasFor = config.aliasFor || {};
      let ret = lodash.map(root.profile.credentials, c => ({
        m: c.m,
        n: c.n,
        is_complete: (c.publicKeyRing && c.publicKeyRing.length === c.n),
        name: config.aliasFor[c.walletId] || c.walletName,
        id: c.walletId,
        network: c.network,
        color: config.colorFor[c.walletId] || '#2C3E50',
      }));
      ret = lodash.filter(ret, w => (w.network === network && w.is_complete));
      return lodash.sortBy(ret, 'name');
    };


    root.requestTouchid = function (cb) {
      const fc = root.focusedClient;
      const config = configService.getSync();
      config.touchIdFor = config.touchIdFor || {};
      if (window.touchidAvailable && config.touchIdFor[fc.credentials.walletId]) {
        return $rootScope.$emit('Local/RequestTouchid', cb);
      }
      return cb();
    };

    root.replaceProfile = function (xPrivKey, mnemonic, myDeviceAddress, cb) {
      const device = require('byteballcore/device.js');

      root.profile.credentials = [];
      root.profile.xPrivKey = xPrivKey;
      root.profile.mnemonic = mnemonic;
      root.profile.my_device_address = myDeviceAddress;
      device.setNewDeviceAddress(myDeviceAddress);

      storageService.storeProfile(root.profile, () => cb());
    };
    return root;
  });
}());
