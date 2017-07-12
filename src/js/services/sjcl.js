(function () {
  'use strict';

  /* eslint-disable arrow-body-style */
  angular.module('copayApp.services')
  .factory('sjcl', (bwcService) => {
    return bwcService.getSJCL();
  });
}());
