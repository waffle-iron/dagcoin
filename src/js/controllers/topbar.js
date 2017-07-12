(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('topbarController', function ($scope, $rootScope, go) {
    this.onBeforeScan = function () {
    };

    this.goHome = function () {
      go.walletHome();
    };
  });
}());
