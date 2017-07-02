

angular.module('copayApp.services').factory('witnessListService', ($state, $rootScope, go) => {
  const root = {};

  console.log('witnessListService');


  root.currentWitness = null;


  return root;
});
