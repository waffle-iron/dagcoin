(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('preferencesAdvancedController',
    function (
      $scope,
      $rootScope,
      profileService,
      addressService
    ) {
      const indexScope = $scope.index;

      this.setAddress = function () {
        const fc = profileService.focusedClient;
        if (!fc) {
          return;
        }

        if (indexScope.shared_address) {
          throw Error('attempt to generate for shared address');
        }

        addressService.getAddress(fc.credentials.walletId, true, (err, addr) => {
          if (err) {
            $rootScope.$emit('Local/ShowAlert', err, 'fi-alert', () => { });
          } else if (addr) {
            $rootScope.$emit('Local/ShowAlert', 'New Address successfully generated.', 'fi-check', () => { });
          }
        });
      };
    });
}());
