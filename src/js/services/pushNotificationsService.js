(function () {
  'use strict';

  /* eslint-disable no-shadow */
  angular.module('copayApp.services')
  .factory('pushNotificationsService', ($http, $rootScope, $log, isMobile, storageService, configService, lodash, isCordova) => {
    const root = {};
    const usePushNotifications = isCordova && !isMobile.Windows();
    let projectNumber;
    let wsLocal;

    const eventBus = require('byteballcore/event_bus.js');

    function sendRequestEnableNotification(ws, registrationId) {
      const network = require('byteballcore/network.js');
      network.sendRequest(ws, 'hub/enable_notification', registrationId, false, (ws, request, response) => {
        if (!response || (response && response !== 'ok')) {
          return $log.error('Error sending push info');
        }
      });
    }

    window.onNotification = function (data) {
      if (data.event === 'registered') {
        return storageService.setPushInfo(projectNumber, data.regid, true, () => {
          sendRequestEnableNotification(wsLocal, data.regid);
        });
      }
      return false;
    };

    eventBus.on('receivedPushProjectNumber', (ws, data) => {
      wsLocal = ws;
      if (data && data.projectNumber !== undefined) {
        storageService.getPushInfo((err, pushInfo) => {
          const config = configService.getSync();
          projectNumber = `${data.projectNumber}`;
          if (pushInfo && projectNumber === '0') {
            root.pushNotificationsUnregister(() => {

            });
          } else if (projectNumber && config.pushNotifications.enabled) {
            root.pushNotificationsInit();
          }
        });
      }
    });

    root.pushNotificationsInit = function () {
      if (!usePushNotifications) return;

      window.plugins.pushNotification.register(() => {},
        (e) => {
          alert(`err= ${e}`);
        }, {
          senderID: projectNumber,
          ecb: 'onNotification',
        });

      configService.set({ pushNotifications: { enabled: true } }, (err) => {
        if (err) $log.debug(err);
      });
    };

    function disableNotification() {
      storageService.getPushInfo((err, pushInfo) => {
        storageService.removePushInfo(() => {
          const network = require('byteballcore/network.js');
          network.sendRequest(wsLocal, 'hub/disable_notification', pushInfo.registrationId, false, (ws, request, response) => {
            if (!response || (response && response !== 'ok')) {
              return $log.error('Error sending push info');
            }
          });
        });
      });
      configService.set({ pushNotifications: { enabled: false } }, (err) => {
        if (err) $log.debug(err);
      });
    }

    root.pushNotificationsUnregister = function () {
      if (!usePushNotifications) return;
      window.plugins.pushNotification.unregister(() => {
        disableNotification();
      }, () => {
        disableNotification();
      });
    };

    return root;
  });
}());
