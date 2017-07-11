(function () {
  angular.module('copayApp.controllers').controller('versionAndWalletTypeController', function () {
    // wallet type
    const conf = require('byteballcore/conf.js');
    this.type = (conf.bLight ? 'light wallet' : 'full wallet');
    // this.type = (conf.bLight ? 'light' : '');

    // version
    this.version = window.version;
    this.commitHash = window.commitHash;
  });
}());
