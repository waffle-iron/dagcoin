/* eslint-disable no-shadow */
(function () {
  angular.module('copayApp.controllers').controller('preferencesDeleteWalletController',
    function ($scope, $rootScope, $filter, $timeout, $modal, $log, storageService, notification, profileService, isCordova, go, gettext, gettextCatalog, animationService) {
      this.isCordova = isCordova;
      this.error = null;

      const deleteMessage = gettextCatalog.getString('Are you sure you want to delete this wallet?');
      const acceptMessage = gettextCatalog.getString('Accept');
      const cancelMessage = gettextCatalog.getString('Cancel');
      const confirmMessage = gettextCatalog.getString('Confirm');

      const deleteWallet = function () {
        const fc = profileService.focusedClient;
        const name = fc.credentials.walletName;
        const walletName = `${fc.alias || ''} [${name}]`;
        const self = this;

        profileService.deleteWallet({}, (err) => {
          if (err) {
            self.error = err.message || err;
          } else {
            notification.success(gettextCatalog.getString('Success'), gettextCatalog.getString('The wallet "{{walletName}}" was deleted', {
              walletName,
            }));
          }
        });
      };

      const modalDeleteWallet = function () {
        const ModalInstanceCtrl = function ($scope, $modalInstance, $sce) {
          $scope.title = $sce.trustAsHtml(deleteMessage);
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

      this.deleteWallet = function () {
        if (profileService.profile.credentials.length === 1 || profileService.getWallets().length === 1) {
          return $rootScope.$emit('Local/ShowErrorAlert', "Can't delete the last remaining wallet");
        }
        if (isCordova) {
          return navigator.notification.confirm(
            deleteMessage,
            (buttonIndex) => {
              if (buttonIndex === 1) {
                deleteWallet();
              }
            },
            confirmMessage, [acceptMessage, cancelMessage]);
        }
        return modalDeleteWallet();
      };
    });
}());
