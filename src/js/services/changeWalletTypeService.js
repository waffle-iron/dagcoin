(function () {
  'use strict';

  angular
    .module('copayApp.services')
    .factory('changeWalletTypeTypeService', changeWalletTypeTypeService);

  changeWalletTypeTypeService.$inject = ['$rootScope', 'fileSystemService', 'localStorageService', 'isCordova'];

  function changeWalletTypeTypeService($rootScope, fileSystemService, localStorageService, isCordova) {
    const service = {};
    let assocBalances = null;

    service.change = change;
    service.canChange = canChange;
    service.isInProgress = isInProgress;
    service.getNewWalletSettings = getNewWalletSettings;
    service.finish = finish;

    $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', (event, ab) => {
      assocBalances = ab;
    });

    function hasBalance() {
      const constants = require('byteballcore/constants.js');
      const hasDags = (assocBalances && assocBalances[constants.DAGCOIN_ASSET] && assocBalances[constants.DAGCOIN_ASSET].total > 0);
      const hasBytes = (assocBalances && assocBalances.base && assocBalances.base.total > 0);
      return hasDags || hasBytes;
    }

    function getUserConfig() {
      try {
        const userConfFile = fileSystemService.getUserConfFilePath();
        return requireUncached(userConfFile);
      } catch (e) {
        return {}; // empty config
      }
    }

    function requireUncached(module) {
      if (typeof require.resolve === 'function') {
        delete require.cache[require.resolve(module)];
      }
      return require(module.toString());
    }

    function canChange() {
      return !isCordova && !hasBalance();
    }

    function change() {
      // load config
      const userConf = getUserConfig();
      const userConfFile = fileSystemService.getUserConfFilePath();
      userConf.bLight = !userConf.bLight;

      // set wallet type
      fileSystemService.writeFile(userConfFile, JSON.stringify(userConf, null, '\t'), 'utf8', (err) => {
        if (err) {
          console.log(err);
        } else {
          // clear local-storage
          const oldWallet = { config: null, profile: null, type: userConf.bLight ? 'light' : 'full' };
          oldWallet.config = JSON.parse(localStorageService.getSync('config'));
          oldWallet.profile = JSON.parse(localStorageService.getSync('profile'));
          localStorageService.setSync('old-wallet', JSON.stringify(oldWallet));

          localStorageService.removeSync('config');
          localStorageService.removeSync('profile');

          localStorageService.setSync('change-wallet-type', JSON.stringify({ bLight: userConf.bLight, deviceName: oldWallet.config.deviceName }));

          // reload application
          return $rootScope.$emit('Local/ShowAlert', 'Wallet type successfully changed, please restart the application.', 'fi-check', () => {
            if (navigator && navigator.app) {
              navigator.app.exitApp();
            } else if (process.exit) {
              process.exit();
            }
          });
        }
      });
    }

    function getNewWalletSettings() {
      if (isInProgress()) {
        const changeWalletType = localStorageService.getSync('change-wallet-type');
        const changeWalletTypeParams = JSON.parse(changeWalletType);
        return changeWalletTypeParams;
      }

      return null;
    }

    // change wallet type in progress
    function isInProgress() {
      if (!isCordova) {
        const changeWalletType = localStorageService.getSync('change-wallet-type');

        if (changeWalletType) {
          return true;
        }
      }

      return false;
    }

    // finish change type
    function finish() {
      localStorageService.removeSync('change-wallet-type');
    }

    return service;
  }
}());

