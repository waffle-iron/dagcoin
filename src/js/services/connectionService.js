(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('connectionService', ($rootScope, $timeout) => {
      const self = {};
      const updateInterval = 30000;
      const connectionErrors = [
        'Error: getaddrinfo ENOTFOUND byteball.org byteball.org:443'
      ];

      self.init = init;
      self.tryHandleError = tryHandleError;

      function notify(state) {
        $rootScope.$emit('connection:state-changed', state);
      }

      function tryHandleError(error) {
        const isConnectionError = !!connectionErrors.find(e => error && error.toLowerCase() === e.toLowerCase());
        if (isConnectionError) {
          notify(false);
        }
        return isConnectionError;
      }

      function check() {
        notify(navigator.onLine !== false);
      }

      function init() {
        window.addEventListener('offline', () => {
          notify(false);
        });

        window.addEventListener('online', () => {
          notify(true);
        });

        setInterval(() => {
          check();
        }, updateInterval);

        $timeout(() => {
          check();
        }, 0);
      }

      return self;
    });
}());
