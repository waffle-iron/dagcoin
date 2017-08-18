(function () {
  'use strict';

  const eventBus = require('byteballcore/event_bus.js');

  angular.module('copayApp.services')
  .factory('newVersion', ($modal, $timeout, $rootScope) => {
    const root = {};
    root.shown = false;
    root.timerNextShow = false;


    eventBus.on('new_version_dagcoin', (ws, data) => {
      root.version = data.version;
      if (!root.shown) {
        const modalInstance = $modal.open({
          templateUrl: 'views/modals/newVersionIsAvailable.html',
          controller: 'newVersionIsAvailable'
        });
        $rootScope.$on('closeModal', () => {
          modalInstance.dismiss('cancel');
        });
        root.shown = true;
        startTimerNextShow();
      }
    });

    function startTimerNextShow() {
      if (root.timerNextShow) $timeout.cancel(root.timerNextShow);
      root.timerNextShow = $timeout(() => {
        root.shown = false;
      }, 1000 * 60 * 60 * 24);
    }

    return root;
  });
}());
