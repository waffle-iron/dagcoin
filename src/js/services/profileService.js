

var breadcrumbs = require('byteballcore/breadcrumbs.js');

angular.module('copayApp.services')
  .factory('profileService', ($rootScope, $location, $timeout, $filter, $log, lodash, storageService, bwcService, configService, pushNotificationsService, isCordova, gettext, gettextCatalog, nodeWebkit, uxLanguage) => {
    const root = {};

    root.profile = null;
    root.focusedClient = null;
    root.walletClients = {};

    root.Utils = bwcService.getUtils();
    root.formatAmount = function (amount, asset, opts) {
      const config = configService.getSync().wallet.settings;
      // if (config.unitCode == 'byte') return amount;

      // TODO : now only works for english, specify opts to change thousand separator and decimal separator
      if (asset.toLowerCase() === 'dag') {
        return this.Utils.formatAmount(amount, config.dagUnitCode, opts);
      }
      return this.Utils.formatAmount(amount, config.unitCode, opts);
    };

    root._setFocus = function (walletId, cb) {
      $log.debug('Set focus:', walletId);

      // Set local object
      if (walletId) { root.focusedClient = root.walletClients[walletId]; } else { root.focusedClient = []; }

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
      root._setFocus(walletId, () => {
        storageService.storeFocusedWalletId(walletId, cb);
      });
    };

    root.setWalletClient = function (credentials) {
      if (root.walletClients[credentials.walletId] && root.walletClients[credentials.walletId].started) { return; }

      const client = bwcService.getClient(JSON.stringify(credentials));

      client.credentials.xPrivKey = root.profile.xPrivKey;
      client.credentials.mnemonic = root.profile.mnemonic;
      client.credentials.xPrivKeyEncrypted = root.profile.xPrivKeyEncrypted;
      client.credentials.mnemonicEncrypted = root.profile.mnemonicEncrypted;

      root.walletClients[credentials.walletId] = client;

      root.walletClients[credentials.walletId].started = true;

      client.initialize({}, (err) => {
        if (err) {
                // impossible

        }
      });
    };

    root.setWalletClients = function () {
      const credentials = root.profile.credentials;
      lodash.each(credentials, (credentials) => {
        root.setWalletClient(credentials);
      });
      $rootScope.$emit('Local/WalletListUpdated');
    };


    function saveTempKeys(tempDeviceKey, prevTempDeviceKey, onDone) {
      console.log('will save temp device keys');// , tempDeviceKey, prevTempDeviceKey);
      root.profile.tempDeviceKey = tempDeviceKey.toString('base64');
      if (prevTempDeviceKey) { root.profile.prevTempDeviceKey = prevTempDeviceKey.toString('base64'); }
      storageService.storeProfile(root.profile, (err) => {
        onDone(err);
      });
    }

    function unlockWalletAndInitDevice() {
        // wait till the wallet fully loads
      breadcrumbs.add('unlockWalletAndInitDevice');
      var removeListener = $rootScope.$on('Local/BalanceUpdated', () => {
        removeListener();
        breadcrumbs.add('unlockWalletAndInitDevice BalanceUpdated');
        root.insistUnlockFC(null, () => {
          breadcrumbs.add('unlockWalletAndInitDevice unlocked');
          if (!root.focusedClient.credentials.xPrivKey) { throw Error('xPrivKey still not set after unlock'); }
          console.log(`unlocked: ${root.focusedClient.credentials.xPrivKey}`);
          const config = configService.getSync();
          root.focusedClient.initDeviceProperties(
                    root.focusedClient.credentials.xPrivKey, root.profile.my_device_address, config.hub, config.deviceName);
          $rootScope.$emit('Local/BalanceUpdatedAndWalletUnlocked');
        });
      });
    }

    root.bindProfile = function (profile, cb) {
      breadcrumbs.add('bindProfile');
      root.profile = profile;
      configService.get((err) => {
        $log.debug('Preferences read');
        if (err) { return cb(err); }
        root.setWalletClients();
        storageService.getFocusedWalletId((err, focusedWalletId) => {
          if (err) { return cb(err); }
          root._setFocus(focusedWalletId, () => {
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
            } else if (root.profile.xPrivKey) { root.focusedClient.initDeviceProperties(profile.xPrivKey, root.profile.my_device_address, config.hub, config.deviceName); } else { throw Error('neither xPrivKey nor xPrivKeyEncrypted'); }
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
      storageService.getDisclaimerFlag((err, val) => {
        if (!val) {
		  breadcrumbs.add('Non agreed disclaimer');
          return cb(new Error('NONAGREEDDISCLAIMER: Non agreed disclaimer'));
        }
        storageService.getProfile((err, profile) => {
          if (err) {
            $rootScope.$emit('Local/DeviceError', err);
            return cb(err);
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


    root._seedWallet = function (opts, cb) {
      opts = opts || {};

      const walletClient = bwcService.getClient();
      const network = opts.networkName || 'livenet';


      if (opts.mnemonic) {
        try {
          opts.mnemonic = root._normalizeMnemonic(opts.mnemonic);
          walletClient.seedFromMnemonic(opts.mnemonic, {
            network,
            passphrase: opts.passphrase,
            account: opts.account || 0,
            derivationStrategy: opts.derivationStrategy || 'BIP44',
          });
        } catch (ex) {
          $log.info(ex);
          return cb(gettext('Could not create: Invalid wallet seed'));
        }
      } else if (opts.extendedPrivateKey) {
        try {
          walletClient.seedFromExtendedPrivateKey(opts.extendedPrivateKey, opts.account || 0);
        } catch (ex) {
          $log.warn(ex);
          return cb(gettext('Could not create using the specified extended private key'));
        }
      } else if (opts.extendedPublicKey) {
        try {
          walletClient.seedFromExtendedPublicKey(opts.extendedPublicKey, opts.externalSource, opts.entropySource, {
            account: opts.account || 0,
            derivationStrategy: opts.derivationStrategy || 'BIP44',
          });
        } catch (ex) {
          $log.warn('Creating wallet from Extended Public Key Arg:', ex, opts);
          return cb(gettext('Could not create using the specified extended public key'));
        }
      } else {
        const lang = uxLanguage.getCurrentLanguage();
        console.log(`will seedFromRandomWithMnemonic for language ${lang}`);
        try {
          walletClient.seedFromRandomWithMnemonic({
            network,
            passphrase: opts.passphrase,
            language: lang,
            account: opts.account || 0,
          });
        } catch (e) {
          $log.info(`Error creating seed: ${e.message}`);
          if (e.message.indexOf('language') > 0) {
            $log.info('Using default language for mnemonic');
            walletClient.seedFromRandomWithMnemonic({
              network,
              passphrase: opts.passphrase,
              account: opts.account || 0,
            });
          } else {
            return cb(e);
          }
        }
      }
      return cb(null, walletClient);
    };


    root._createNewProfile = function (opts, cb) {
      console.log('_createNewProfile');
      if (opts.noWallet) { return cb(null, Profile.create()); }
      root._seedWallet({}, (err, walletClient) => {
        if (err) { return cb(err); }
        const config = configService.getSync();
        const device = require('byteballcore/device.js');
        const tempDeviceKey = device.genPrivKey();
			// initDeviceProperties sets my_device_address needed by walletClient.createWallet
        walletClient.initDeviceProperties(walletClient.credentials.xPrivKey, null, config.hub, config.deviceName);
        const walletName = gettextCatalog.getString('Small Expenses Wallet');
        walletClient.createWallet(walletName, 1, 1, {
          network: 'livenet',
        }, (err) => {
          if (err) { return cb(`${gettext('Error creating wallet')}: ${err}`); }
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
        root.unlockFC(null, (err) => {
          if (err) { return cb(err.message); }
          root.createWallet(opts, cb);
        });
        return console.log('need password to create new wallet');
      }
      const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
      walletDefinedByKeys.readNextAccount((account) => {
        console.log(`next account = ${account}`);
        if (!opts.extendedPrivateKey && !opts.mnemonic) {
          if (!root.focusedClient.credentials.xPrivKey) { throw Error('no root.focusedClient.credentials.xPrivKey'); }
          $log.debug('reusing xPrivKey from focused client');
          opts.extendedPrivateKey = root.focusedClient.credentials.xPrivKey;
          opts.mnemonic = root.profile.mnemonic;
          opts.account = account;
        }
        root._seedWallet(opts, (err, walletClient) => {
          if (err) { return cb(err); }

          walletClient.createWallet(opts.name, opts.m, opts.n, {
            network: opts.networkName,
            account: opts.account,
            cosigners: opts.cosigners,
          }, (err) => {
            if (err) { return cb(`${gettext('Error creating wallet')}: ${err}`); }
            root._addWalletClient(walletClient, opts, cb);
          });
        });
      });
    };


    root.getClient = function (walletId) {
      return root.walletClients[walletId];
    };

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

      storageService.clearBackupFlag(walletId, (err) => {
        if (err) $log.warn(err);
      });

      $timeout(() => {
        root.setWalletClients();
        root.setAndStoreFocus(null, () => {
          storageService.storeProfile(root.profile, (err) => {
            if (err) return cb(err);
            return cb();
          });
        });
      });
    };

    root.setMetaData = function (walletClient, addressBook, cb) {
      storageService.getAddressbook(walletClient.credentials.network, (err, localAddressBook) => {
        let localAddressBook1 = {};
        try {
          localAddressBook1 = JSON.parse(localAddressBook);
        } catch (ex) {
          $log.warn(ex);
        }
        const mergeAddressBook = lodash.merge(addressBook, localAddressBook1);
        storageService.setAddressbook(walletClient.credentials.network, JSON.stringify(addressBook), (err) => {
          if (err) return cb(err);
          return cb(null);
        });
      });
    };

    root._addWalletClient = function (walletClient, opts, cb) {
      const walletId = walletClient.credentials.walletId;

        // check if exists
      const w = lodash.find(root.profile.credentials, { walletId });
      if (w) { return cb(gettext('Wallet already in Byteball' + ': ') + w.walletName); }

      root.profile.credentials.push(JSON.parse(walletClient.export()));
      root.setWalletClients();

		// assign wallet color based on first character of walletId
      const color = configService.colorOpts[walletId.charCodeAt(0) % configService.colorOpts.length];
      const configOpts = { colorFor: {} };
      configOpts.colorFor[walletId] = color;
      configService.set(configOpts, (err) => {
        root.setAndStoreFocus(walletId, () => {
          storageService.storeProfile(root.profile, (err) => {
            const config = configService.getSync();
            return cb(err, walletId);
          });
        });
      });
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
        return cb(gettext('Could not import. Check input file and password'));
      }

      str = JSON.parse(str);

      const addressBook = str.addressBook || {};

      root._addWalletClient(walletClient, opts, (err, walletId) => {
        if (err) return cb(err);
        root.setMetaData(walletClient, addressBook, (error) => {
          if (error) console.log(error);
          return cb(err, walletId);
        });
      });
    };


    root.importExtendedPrivateKey = function (xPrivKey, opts, cb) {
      const walletClient = bwcService.getClient();
      $log.debug('Importing Wallet xPrivKey');

      walletClient.importFromExtendedPrivateKey(xPrivKey, (err) => {
        if (err) { return cb(`${gettext('Could not import')}: ${err}`); }

        root._addWalletClient(walletClient, opts, cb);
      });
    };

    root._normalizeMnemonic = function (words) {
      const isJA = words.indexOf('\u3000') > -1;
      const wordList = words.split(/[\u3000\s]+/);

      return wordList.join(isJA ? '\u3000' : ' ');
    };


    root.importMnemonic = function (words, opts, cb) {
      const walletClient = bwcService.getClient();

      $log.debug('Importing Wallet Mnemonic');

      words = root._normalizeMnemonic(words);
      walletClient.importFromMnemonic(words, {
        network: opts.networkName,
        passphrase: opts.passphrase,
        account: opts.account || 0,
      }, (err) => {
        if (err) { return cb(`${gettext('Could not import')}: ${err}`); }

        root._addWalletClient(walletClient, opts, cb);
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
          if (err.code === 'NOT_AUTHORIZED') { err.code = 'WALLET_DOES_NOT_EXIST'; }

          return cb(`${gettext('Could not import')}: ${err}`);
        }

        root._addWalletClient(walletClient, opts, cb);
      });
    };


    root.create = function (opts, cb) {
      $log.info('Creating profile', opts);
      const defaults = configService.getDefaults();

      configService.get((err) => {
        root._createNewProfile(opts, (err, p) => {
          if (err) return cb(err);

          root.bindProfile(p, (err) => {
            storageService.storeNewProfile(p, err => cb(err));
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
      for (const wid in root.walletClients) { root.walletClients[wid].clearMnemonic(); }
      storageService.storeProfile(root.profile, cb);
    };

    root.setPrivateKeyEncryptionFC = function (password, cb) {
      const fc = root.focusedClient;
      $log.debug('Encrypting private key for', fc.credentials.walletName);

      fc.setPrivateKeyEncryption(password);
      if (!fc.credentials.xPrivKeyEncrypted) { throw Error('no xPrivKeyEncrypted after setting encryption'); }
      root.profile.xPrivKeyEncrypted = fc.credentials.xPrivKeyEncrypted;
      root.profile.mnemonicEncrypted = fc.credentials.mnemonicEncrypted;
      delete root.profile.xPrivKey;
      delete root.profile.mnemonic;
      root.lockFC();
      for (const wid in root.walletClients) {
        root.walletClients[wid].credentials.xPrivKeyEncrypted = root.profile.xPrivKeyEncrypted;
        delete root.walletClients[wid].credentials.xPrivKey;
      }
      storageService.storeProfile(root.profile, () => {
        $log.debug('Wallet encrypted');
        return cb();
      });
        /* root.updateCredentialsFC(function() {
            $log.debug('Wallet encrypted');
                return cb();
        });*/
    };


    root.disablePrivateKeyEncryptionFC = function (cb) {
      const fc = root.focusedClient;
      $log.debug('Disabling private key encryption for', fc.credentials.walletName);

      try {
        fc.disablePrivateKeyEncryption();
      } catch (e) {
        return cb(e);
      }
      if (!fc.credentials.xPrivKey) { throw Error('no xPrivKey after disabling encryption'); }
      root.profile.xPrivKey = fc.credentials.xPrivKey;
      root.profile.mnemonic = fc.credentials.mnemonic;
      delete root.profile.xPrivKeyEncrypted;
      delete root.profile.mnemonicEncrypted;
      for (const wid in root.walletClients) {
        root.walletClients[wid].credentials.xPrivKey = root.profile.xPrivKey;
        delete root.walletClients[wid].credentials.xPrivKeyEncrypted;
      }
      storageService.storeProfile(root.profile, () => {
        $log.debug('Wallet encryption disabled');
        return cb();
      });
        /* root.updateCredentialsFC(function() {
            $log.debug('Wallet encryption disabled');
                return cb();
        });*/
    };

    root.lockFC = function () {
      const fc = root.focusedClient;
      try {
        fc.lock();
      } catch (e) {}
    };

    root.unlockFC = function (error_message, cb) {
      $log.debug('Wallet is encrypted');
      $rootScope.$emit('Local/NeedsPassword', false, error_message, (err2, password) => {
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
        var autolock = function () {
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
            } catch (e) {}
          }
        };
        $timeout(autolock, 30 * 1000);
        return cb();
      });
    };

    // continue to request password until the correct password is entered
    root.insistUnlockFC = function (error_message, cb) {
      root.unlockFC(error_message, (err) => {
        if (!err) { return cb(); }
        $timeout(() => {
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
      if (window.touchidAvailable && config.touchIdFor[fc.credentials.walletId]) { $rootScope.$emit('Local/RequestTouchid', cb); } else			{ return cb(); }
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
