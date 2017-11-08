(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('preferencesEditWitnessController',
    function ($scope, $timeout, go, witnessListService) {
      const self = this;
      this.witness = witnessListService.currentWitness;

      this.save = function () {
        const new_address = this.witness.trim();
        if (new_address === witnessListService.currentWitness) {
          return goBack();
        }
        const myWitnesses = require('byteballcore/my_witnesses.js');
        myWitnesses.replaceWitness(witnessListService.currentWitness, new_address, (err) => {
          console.log(err);
          if (err) {
            return setError(err);
          }
          goBack();
        });
      };

      function setError(error) {
        self.error = error;
        $timeout(() => {
          $scope.$apply();
        }, 100);
      }

      function goBack() {
        go.path('witnesses');
      }
    });
}());
