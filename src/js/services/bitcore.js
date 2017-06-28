
angular.module('copayApp.services')
  .factory('bitcore', (bwcService) => {
    const bitcore = bwcService.getBitcore();
    return bitcore;
  });
