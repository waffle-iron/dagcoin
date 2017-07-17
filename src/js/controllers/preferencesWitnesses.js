(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('preferencesWitnessesController',
    function ($scope, go, witnessListService, autoUpdatingWitnessesList) {
      const self = this;
      this.witnesses = [];
      console.log('preferencesWitnessesController');

      $scope.autoUpdWitnessesList = autoUpdatingWitnessesList.autoUpdate;

      const myWitnesses = require('byteballcore/my_witnesses.js');
      myWitnesses.readMyWitnesses((arrWitnesses) => {
        self.witnesses = arrWitnesses;
        $scope.$apply();
        console.log(`preferencesWitnessesController set witnesses ${arrWitnesses}`);
      }, 'wait');

      this.edit = function (witness) {
        if ($scope.autoUpdWitnessesList) return;

        witnessListService.currentWitness = witness;
        go.path('preferencesEditWitness');
      };


      const unwatchAutoUpdWitnessesList = $scope.$watch('autoUpdWitnessesList', (val) => {
        autoUpdatingWitnessesList.setAutoUpdate(val);

        if (val) {
          autoUpdatingWitnessesList.checkChangeWitnesses();
        }
      });

      $scope.$on('$destroy', () => {
        unwatchAutoUpdWitnessesList();
      });
    });
}());
