
angular.module('copayApp.services')
.factory('pushNotificationsService', ($http, $rootScope, $log, isMobile, storageService, configService, lodash, isCordova) => {
  const root = {};
  const defaults = configService.getDefaults();
  const usePushNotifications = isCordova && !isMobile.Windows();
  let projectNumber;
  let _ws;

  const eventBus = require('byteballcore/event_bus.js');

  function sendRequestEnableNotification(ws, registrationId) {
    const network = require('byteballcore/network.js');
    network.sendRequest(ws, 'hub/enable_notification', registrationId, false, (ws, request, response) => {
      if (!response || (response && response !== 'ok')) return $log.error('Error sending push info');
    });
  }

  window.onNotification = function (data) {
    if (data.event === 'registered') {
      storageService.setPushInfo(projectNumber, data.regid, true, () => {
        sendRequestEnableNotification(_ws, data.regid);
      });
    }		else {
      return false;
    }
  };

  eventBus.on('receivedPushProjectNumber', (ws, data) => {
    _ws = ws;
    if (data && data.projectNumber !== undefined) {
      storageService.getPushInfo((err, pushInfo) => {
        const config = configService.getSync();
        projectNumber = `${data.projectNumber}`;
        if (pushInfo && projectNumber === '0') {
          root.pushNotificationsUnregister(() => {

          });
        }				else if (projectNumber && config.pushNotifications.enabled) {
          root.pushNotificationsInit();
        }
      });
    }
  });

  root.pushNotificationsInit = function () {
    if (!usePushNotifications) return;

    window.plugins.pushNotification.register((data) => {
    },
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

  function disable_notification() {
    storageService.getPushInfo((err, pushInfo) => {
      storageService.removePushInfo(() => {
        const network = require('byteballcore/network.js');
        network.sendRequest(_ws, 'hub/disable_notification', pushInfo.registrationId, false, (ws, request, response) => {
          if (!response || (response && response !== 'ok')) return $log.error('Error sending push info');
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
      disable_notification();
    }, () => {
      disable_notification();
    });
  };

  return root;
});
