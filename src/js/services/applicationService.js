(function () {
  'use strict';

  /* eslint-disable import/no-extraneous-dependencies,import/no-unresolved */
  angular.module('copayApp.services')
  .factory('applicationService', ($rootScope, $timeout, isCordova, nodeWebkit, go) => {
    const root = {};

    root.restart = function () {
      const hashIndex = window.location.href.indexOf('#/');
      if (isCordova) {
        window.location = window.location.href.substr(0, hashIndex);
        $timeout(() => {
          $rootScope.$digest();
        }, 1);
      } else if (nodeWebkit.isDefined()) {
        // Go home reloading the application
        go.walletHome();
        $timeout(() => {
          const win = require('nw.gui').Window.get();
          win.reload(3);
          // or
          win.reloadDev();
        }, 100);
      } else {
        window.location = window.location.href.substr(0, hashIndex);
      }
    };

    return root;
  });
}());
