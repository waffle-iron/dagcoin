(function () {
  'use strict';

  /* eslint-disable arrow-body-style */
  angular.module('copayApp.services')
  .factory('bitcore', (bwcService) => {
    return bwcService.getBitcore();
  });
}());
