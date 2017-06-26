

angular.module('copayApp.controllers').controller('preferencesDeleteWalletController',
  function ($scope, $rootScope, $filter, $timeout, $modal, $log, storageService, notification, profileService, isCordova, go, gettext, gettextCatalog, animationService) {
    this.isCordova = isCordova;
    this.error = null;

    const delete_msg = gettextCatalog.getString('Are you sure you want to delete this wallet?');
    const accept_msg = gettextCatalog.getString('Accept');
    const cancel_msg = gettextCatalog.getString('Cancel');
    const confirm_msg = gettextCatalog.getString('Confirm');

    const _modalDeleteWallet = function () {
      const ModalInstanceCtrl = function ($scope, $modalInstance, $sce, gettext) {
        $scope.title = $sce.trustAsHtml(delete_msg);
        $scope.loading = false;

        $scope.ok = function () {
          $scope.loading = true;
          $modalInstance.close(accept_msg);
        };
        $scope.cancel = function () {
          $modalInstance.dismiss(cancel_msg);
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
          _deleteWallet();
        }
      });
    };

    var _deleteWallet = function () {
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

    this.deleteWallet = function () {
	  if (profileService.profile.credentials.length === 1 || profileService.getWallets().length === 1)		  { return $rootScope.$emit('Local/ShowErrorAlert', "Can't delete the last remaining wallet"); }
      if (isCordova) {
        navigator.notification.confirm(
          delete_msg,
          (buttonIndex) => {
            if (buttonIndex == 1) {
              _deleteWallet();
            }
          },
          confirm_msg, [accept_msg, cancel_msg],
        );
      } else {
        _modalDeleteWallet();
      }
    };
  });
