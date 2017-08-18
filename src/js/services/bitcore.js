(function () {
  'use strict';

  angular.module('copayApp.services')
  .factory('bitcore', (bwcService) => {
    bwcService.getBitcore();
  });
}());
