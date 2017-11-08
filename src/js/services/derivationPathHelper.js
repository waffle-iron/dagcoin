(function () {
  'use strict';

  angular.module('copayApp.services').factory('derivationPathHelper', () => {
    const root = {};

    root.default = "m/44'/0'/0'";
    root.parse = function (str) {
      const arr = str.split('/');

      const ret = {};

      if (arr[0] !== 'm') {
        return false;
      }

      switch (arr[1]) {
        case "44'":
          ret.derivationStrategy = 'BIP44';
          break;
        case "48'":
          ret.derivationStrategy = 'BIP48';
          break;
        default:
          return false;
      }

      switch (arr[2]) {
        case "0'":
          ret.networkName = 'livenet';
          break;
        case "1'":
          ret.networkName = 'testnet';
          break;
        default:
          return false;
      }

      const match = arr[3].match(/(\d+)'/);
      if (!match) {
        return false;
      }
      ret.account = +match[1];

      return ret;
    };

    return root;
  });
}());
