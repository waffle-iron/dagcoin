(function () {
  'use strict';

  angular.module('copayApp.controllers')
  .controller('approveNewWitnesses', ($scope, $modalInstance, $document, autoUpdatingWitnessesList) => {
    $scope.addWitnesses = autoUpdatingWitnessesList.addWitnesses;
    $scope.delWitnesses = autoUpdatingWitnessesList.delWitnesses;


    $scope.replace = function () {
      const oldWitnesses = $scope.delWitnesses;
      const newWitnesses = $scope.addWitnesses;

      const n = 0;
      const l = newWitnesses.length;

      function replaceWitness(index, oldW, newW) {
        const myWitnesses = require('byteballcore/my_witnesses.js');
        myWitnesses.replaceWitness(oldWitnesses[index], newWitnesses[index], () => {
          if (l < index) {
            let i = index;
            i += 1;
            replaceWitness(i, oldW, newW);
          } else {
            $modalInstance.close('closed result');
          }
        });
      }

      replaceWitness(n, oldWitnesses, newWitnesses);
    };

    $scope.later = function () {
      $modalInstance.close('closed result');
    };
  });
}());
