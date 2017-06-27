

angular.module('copayApp.controllers').controller('approveNewWitnesses', ($scope, $modalInstance, $document, autoUpdatingWitnessesList) => {
  $scope.addWitnesses = autoUpdatingWitnessesList.addWitnesses;
  $scope.delWitnesses = autoUpdatingWitnessesList.delWitnesses;


  $scope.replace = function () {
    const oldWitnesses = $scope.delWitnesses;
    const newWitnesses = $scope.addWitnesses;

    let n = 0,
      l = newWitnesses.length;

    function replaceWitness(n, oldWitnesses, newWitnesses) {
	  const myWitnesses = require('byteballcore/my_witnesses.js');
      myWitnesses.replaceWitness(oldWitnesses[n], newWitnesses[n], (err) => {
        if (l < n) {
          replaceWitness(n++, oldWitnesses, newWitnesses);
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
