const bwcModule = angular.module('bwcModule', []);
// var Client = require('../node_modules/bitcore-wallet-client');
console.log('before');
// console.log("path="+require.resolve('./angular-bitcore-wallet-client/bitcore-wallet-client/index.js'));
// we are in public/, require() from webkit context
const Client = require('../angular-bitcore-wallet-client/bitcore-wallet-client/index.js');

console.log('after');

bwcModule.constant('MODULE_VERSION', '1.0.0');

bwcModule.provider('bwcService', () => {
  const provider = {};

  provider.$get = function () {
    const service = {};

    service.getBitcore = function () {
      return Client.Bitcore;
    };

    service.getSJCL = function () {
      return Client.sjcl;
    };


    service.getUtils = function () {
      return Client.Utils;
    };

    service.getClient = function (walletData) {
      const bwc = new Client({});
      if (walletData) {
        bwc.import(walletData);
      }
      return bwc;
    };

    return service;
  };

  return provider;
});
