(function () {
  'use strict';

  angular.module('copayApp.services')
  .factory('notification', ['$timeout',
    function ($timeout) {
      let notifications = [];

      /*
       ls.getItem('notifications', function(err, data) {
       if (data) {
       notifications = JSON.parse(data);
       }
       });
       */

      const queue = [];
      const settings = {
        info: {
          duration: 6000,
          enabled: true,
        },
        funds: {
          duration: 7000,
          enabled: true,
        },
        version: {
          duration: 60000,
          enabled: true,
        },
        warning: {
          duration: 7000,
          enabled: true,
        },
        error: {
          duration: 7000,
          enabled: true,
        },
        success: {
          duration: 5000,
          enabled: true,
        },
        progress: {
          duration: 0,
          enabled: true,
        },
        custom: {
          duration: 35000,
          enabled: true,
        },
        details: true,
        localStorage: false,
        html5Mode: false,
        html5DefaultIcon: 'img/icons/dagcoin.ico',
      };

      function html5Notify(icon, title, content, ondisplay, onclose) {
        if (window.webkitNotifications && window.webkitNotifications.checkPermission() === 0) {
          let notifyIcon = icon;
          if (!notifyIcon) {
            notifyIcon = 'img/icons/dagcoin.ico';
          }
          const noti = window.webkitNotifications.createNotification(notifyIcon, title, content);
          if (typeof ondisplay === 'function') {
            noti.ondisplay = ondisplay;
          }
          if (typeof onclose === 'function') {
            noti.onclose = onclose;
          }
          noti.show();
        } else {
          settings.html5Mode = false;
        }
      }


      return {

        /* ========== SETTINGS RELATED METHODS =============*/

        disableHtml5Mode() {
          settings.html5Mode = false;
        },

        disableType(notificationType) {
          settings[notificationType].enabled = false;
        },

        enableHtml5Mode() {
          // settings.html5Mode = true;
          settings.html5Mode = this.requestHtml5ModePermissions();
        },

        enableType(notificationType) {
          settings[notificationType].enabled = true;
        },

        getSettings() {
          return settings;
        },

        toggleType(notificationType) {
          settings[notificationType].enabled = !settings[notificationType].enabled;
        },

        toggleHtml5Mode() {
          settings.html5Mode = !settings.html5Mode;
        },

        requestHtml5ModePermissions() {
          if (window.webkitNotifications) {
            if (window.webkitNotifications.checkPermission() === 0) {
              return true;
            }
            window.webkitNotifications.requestPermission(() => {
              if (window.webkitNotifications.checkPermission() === 0) {
                settings.html5Mode = true;
              } else {
                settings.html5Mode = false;
              }
            });
            return false;
          }
          return false;
        },


        /* ============ QUERYING RELATED METHODS ============*/

        getAll() {
          // Returns all notifications that are currently stored
          return notifications;
        },

        getQueue() {
          return queue;
        },

        /* ============== NOTIFICATION METHODS ==============*/

        info(title, content, userData) {
          return this.awesomeNotify('info', 'fi-info', title, content, userData);
        },

        funds(title, content, userData) {
          return this.awesomeNotify('funds', 'icon-receive', title, content, userData);
        },

        version(title, content, severe) {
          return this.awesomeNotify('version', severe ? 'fi-alert' : 'fi-flag', title, content);
        },

        error(title, content, userData) {
          return this.awesomeNotify('error', 'fi-x', title, content, userData);
        },

        success(title, content, userData) {
          return this.awesomeNotify('success', 'fi-check', title, content, userData);
        },

        warning(title, content, userData) {
          return this.awesomeNotify('warning', 'fi-alert', title, content, userData);
        },

        new(title, content, userData) {
          return this.awesomeNotify('warning', 'fi-plus', title, content, userData);
        },

        sent(title, content, userData) {
          return this.awesomeNotify('warning', 'icon-paperplane', title, content, userData);
        },

        awesomeNotify(type, icon, title, content, userData) {
          /**
           * Supposed to wrap the makeNotification method for drawing icons using font-awesome
           * rather than an image.
           *
           * Need to find out how I'm going to make the API take either an image
           * resource, or a font-awesome icon and then display either of them.
           * Also should probably provide some bits of color, could do the coloring
           * through classes.
           */
          // image = '<i class="icon-' + image + '"></i>';
          return this.makeNotification(type, false, icon, title, content, userData);
        },

        notify(image, title, content, userData) {
          // Wraps the makeNotification method for displaying notifications with images
          // rather than icons
          return this.makeNotification('custom', image, true, title, content, userData);
        },

        makeNotification(type, image, icon, title, content, userData) {
          const notification = {
            type,
            image,
            icon,
            title,
            content,
            timestamp: +new Date(),
            userData,
          };

          notifications.push(notification);

          if (settings.html5Mode) {
            html5Notify(image, title, content, () => {
              // inner on display function
            }, () => {
              // inner on close function
            });
          }

          // this is done because html5Notify() changes the variable settings.html5Mode
          if (!settings.html5Mode) {
            queue.push(notification);
            $timeout(() => {
              queue.splice(queue.indexOf(notification), 1);
            }, settings[type].duration);
          }

          // Mobile notification
          if (window && window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([200, 100, 200]);
          }

          if (document.hidden && (type === 'info' || type === 'funds')) {
            window.Notification(title, {
              body: content,
              icon: 'img/notification.png',
            });
          }

          this.save();
          return notification;
        },


        /* ============ PERSISTENCE METHODS ============ */

        save() {
          // Save all the notifications into localStorage
          if (settings.localStorage) {
            localStorage.setItem('notifications', JSON.stringify(notifications));
          }
        },

        restore() {
          // Load all notifications from localStorage
        },

        clear() {
          notifications = [];
          this.save();
        },

      };
    },
  ]).directive('notifications', (notification) => {
    /**
     *
     * It should also parse the arguments passed to it that specify
     * its position on the screen like "bottom right" and apply those
     * positions as a class to the container element
     *
     * Finally, the directive should have its own controller for
     * handling all of the notifications from the notification service
     */
    function link(scope, element, attrs) {
      let position = attrs.notifications;
      position = position.split(' ');
      element.addClass('dr-notification-container');
      for (let i = 0; i < position.length; i += 1) {
        element.addClass(position[i]);
      }
    }

    return {
      restrict: 'A',
      scope: {},
      templateUrl: 'views/includes/notifications.html',
      link,
      controller: ['$scope',
        function NotificationsCtrl($scope) {
          $scope.queue = notification.getQueue();

          $scope.removeNotification = function (noti) {
            $scope.queue.splice($scope.queue.indexOf(noti), 1);
          };
        },
      ],

    };
  });
}());
