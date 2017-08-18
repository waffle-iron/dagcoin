(function () {
  'use strict';

  angular.module('copayApp.services')
  .factory('sjcl', (bwcService) => {
    const sjcl = bwcService.getSJCL();
    return sjcl;
  });
}());
