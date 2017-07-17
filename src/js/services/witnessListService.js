(function () {
  'use strict';

  angular.module('copayApp.services').factory('witnessListService', () => {
    const root = {};
    console.log('witnessListService');
    root.currentWitness = null;
    return root;
  });
}());
