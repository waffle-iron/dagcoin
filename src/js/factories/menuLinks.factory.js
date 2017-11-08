(() => {
  'use strict';

  angular
    .module('copayApp.services')
    .factory('menuLinks', menuLinks);

  menuLinks.$inject = [];
  function menuLinks() {
    return [{
      category: 'Account',
      links: [
        {
          title: 'My Wallets',
          icon: 'wallet',
          state: 'walletHome',
          menuBar: true
        }, {
          title: 'Send',
          icon: 'paperplane',
          state: 'send',
          menuBar: true
        }, {
          title: 'Receive',
          icon: 'banknote',
          state: 'receive',
          menuBar: true
        }
      ]
    }, {
      category: 'More',
      links: [
        {
          title: 'Settings',
          icon: 'cog',
          state: 'preferencesGlobal'
        }
      ]
    }];
  }
})();
