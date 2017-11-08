(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('sidebarController',
    function ($rootScope, $timeout, lodash, profileService, configService, go, isMobile, isCordova, backButton, $state) {
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

      self.switchWallet = function (selectedWalletId, currentWalletId, state) {
        backButton.menuOpened = false;
        if (selectedWalletId === currentWalletId) {
          $state.go(state);
          return;
        }
        self.walletSelection = false;
        return profileService.setAndStoreFocus(selectedWalletId, () => {
          $state.go(state);
        });
      };

      self.switchWalletOpenPreferences = function (selectedWalletId, currentWalletId) {
        self.switchWallet(selectedWalletId, currentWalletId, 'preferences');
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
          color: config.colorFor[c.walletId] || '#d51f26',
        }));
        self.wallets = lodash.sortBy(ret, 'name');
      };

      self.setWallets();
    });
}());

