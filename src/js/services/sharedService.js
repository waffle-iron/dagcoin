(function () {
  'use strict';

  angular
    .module('copayApp.services')
    .factory('sharedService', sharedService);

  sharedService.$inject = ['$rootScope'];

  /* @ngInject */
  function sharedService($rootScope) {
    const service = {};
    const balanceStatuses = {
      total: 'total',
      pending: 'pending',
      stable: 'stable'
    };

    service.balanceStatuses = balanceStatuses;
    service.hasBalance = hasBalance;
    service.hasDags = hasDags;
    service.hasBytes = hasBytes;

    let currentBalance = null;

    $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', (event, ab) => {
      currentBalance = ab;
    });

    function hasBalance(status) {
      return hasBytes(status) || hasDags(status);
    }

    function hasBytes(status) {
      const st = status || balanceStatuses.stable;
      return (currentBalance && currentBalance.base && currentBalance.base[st] > 0);
    }

    function hasDags(status) {
      const constants = require('byteballcore/constants.js');
      const st = status || balanceStatuses.stable;
      return (currentBalance && currentBalance[constants.DAGCOIN_ASSET] && currentBalance[constants.DAGCOIN_ASSET][st] > 0);
    }

    return service;
  }
}());

