(function () {
  'use strict';

  angular.module('copayApp.services')
  .factory('autoUpdatingWitnessesList', ($timeout, $modal, $rootScope, configService) => {
    const root = {};

    root.autoUpdate = true;
    root.timerNextCheck = null;

    root.checkChangeWitnesses = function () {
      if (!root.autoUpdate) return;

      const device = require('byteballcore/device.js');
      const myWitnesses = require('byteballcore/my_witnesses.js');
      device.getWitnessesFromHub((err, arrWitnessesFromHub) => {
        if (arrWitnessesFromHub) {
          myWitnesses.readMyWitnesses((arrWitnesses) => {
            root.addWitnesses = arrWitnessesFromHub.filter(witness => arrWitnesses.indexOf(witness) === -1);
            root.delWitnesses = arrWitnesses.filter(witness => arrWitnessesFromHub.indexOf(witness) === -1);

            if (root.addWitnesses.length !== 0) {
              const modalInstance = $modal.open({
                templateUrl: 'views/modals/approveNewWitnesses.html',
                controller: 'approveNewWitnesses',
              });
              $rootScope.$on('closeModal', () => {
                modalInstance.dismiss('cancel');
              });
            }
            if (root.timerNextCheck) $timeout.cancel(root.timerNextCheck);
            root.timerNextCheck = $timeout(root.checkChangeWitnesses, 1000 * 60 * 60 * 24);
          }, 'wait');
        } else {
          if (root.timerNextCheck) $timeout.cancel(root.timerNextCheck);
          root.timerNextCheck = $timeout(root.checkChangeWitnesses, 1000 * 60);
        }
      });
    };

    root.setAutoUpdate = function (bAutoUpdate) {
      configService.set({autoUpdateWitnessesList: bAutoUpdate}, () => {
      });
      root.autoUpdate = bAutoUpdate;
    };

    configService.get((err, conf) => {
      if (conf.autoUpdateWitnessesList === undefined) {
        root.setAutoUpdate(true);
      } else {
        root.autoUpdate = conf.autoUpdateWitnessesList;
      }
      root.checkChangeWitnesses();
    });

    return root;
  });
}());
