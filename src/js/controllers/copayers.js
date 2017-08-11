/* eslint-disable no-shadow */
(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('copayersController',
    function ($scope, $rootScope, $timeout, $log, $modal, profileService, go, notification, isCordova, gettext, gettextCatalog, animationService) {
      const self = this;

      const deleteMessage = gettextCatalog.getString('Are you sure you want to delete this wallet?');
      const acceptMessage = gettextCatalog.getString('Accept');
      const cancelMessage = gettextCatalog.getString('Cancel');
      const confirmMessage = gettextCatalog.getString('Confirm');

      self.init = function () {
        const fc = profileService.focusedClient;
        if (fc.isComplete()) {
          $log.debug('Wallet Complete...redirecting');
          go.walletHome();
          return;
        }
        self.loading = false;
        self.isCordova = isCordova;
      };

      const deleteWallet = function () {
        $timeout(() => {
          const fc = profileService.focusedClient;
          const walletName = fc.credentials.walletName;

          profileService.deleteWallet({}, function (err) {
            if (err) {
              this.error = err.message || err;
              console.log(err);
              $timeout(() => {
                $scope.$digest();
              });
            } else {
              go.walletHome();
              $timeout(() => {
                notification.success(gettextCatalog.getString('Success'), gettextCatalog.getString('The wallet "{{walletName}}" was deleted', { walletName }));
              });
            }
          });
        }, 100);
      };

      const modalDeleteWallet = function () {
        const ModalInstanceCtrl = function ($scope, $modalInstance, $sce) {
          $scope.title = $sce.trustAsHtml(deleteMessage);
          $scope.yes_icon = 'fi-trash';
          $scope.yes_button_class = 'warning';
          $scope.cancel_button_class = 'light-gray outline';
          $scope.loading = false;

          $scope.ok = function () {
            $scope.loading = true;
            $modalInstance.close(acceptMessage);
          };
          $scope.cancel = function () {
            $modalInstance.dismiss(cancelMessage);
          };
        };

        const modalInstance = $modal.open({
          templateUrl: 'views/modals/confirmation.html',
          windowClass: animationService.modalAnimated.slideUp,
          controller: ModalInstanceCtrl,
        });

        modalInstance.result.finally(() => {
          const m = angular.element(document.getElementsByClassName('reveal-modal'));
          m.addClass(animationService.modalAnimated.slideOutDown);
        });

        modalInstance.result.then((ok) => {
          if (ok) {
            deleteWallet();
          }
        });
      };

      self.deleteWallet = function () {
        if (isCordova) {
          navigator.notification.confirm(
            deleteMessage,
            (buttonIndex) => {
              if (buttonIndex === 1) {
                deleteWallet();
              }
            },
            confirmMessage, [acceptMessage, cancelMessage]);
        } else {
          modalDeleteWallet();
        }
      };
    });
}());
