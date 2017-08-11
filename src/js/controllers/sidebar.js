(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('sidebarController',
    function ($rootScope, $timeout, lodash, profileService, configService, go, isMobile, isCordova, backButton) {
      const self = this;
      self.isWindowsPhoneApp = isMobile.Windows() && isCordova;
      self.walletSelection = false;

      $rootScope.$on('Local/WalletListUpdated', () => {
        self.walletSelection = false;
        self.setWallets();
      });

      $rootScope.$on('Local/ColorUpdated', () => {
        self.setWallets();
      });

      $rootScope.$on('Local/AliasUpdated', () => {
        self.setWallets();
      });


      self.signout = function () {
        profileService.signout();
      };

      self.switchWallet = function (selectedWalletId, currentWalletId) {
        backButton.menuOpened = false;
        if (selectedWalletId === currentWalletId) {
          return;
        }
        self.walletSelection = false;
        profileService.setAndStoreFocus(selectedWalletId, () => { });
      };

      self.toggleWalletSelection = function () {
        self.walletSelection = !self.walletSelection;
        if (!self.walletSelection) {
          return;
        }
        self.setWallets();
      };

      self.setWallets = function () {
        if (!profileService.profile) return;
        const config = configService.getSync();
        config.colorFor = config.colorFor || {};
        config.aliasFor = config.aliasFor || {};
        const ret = lodash.map(profileService.profile.credentials, c => ({
          m: c.m,
          n: c.n,
          name: config.aliasFor[c.walletId] || c.walletName,
          id: c.walletId,
          color: config.colorFor[c.walletId] || '#4A90E2',
        }));
        self.wallets = lodash.sortBy(ret, 'name');
      };

      self.setWallets();
    });
}());

