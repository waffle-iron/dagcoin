(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('preferencesController',
    function ($scope, $rootScope, $filter, $timeout, $modal, $log, lodash, configService, profileService, uxLanguage) {
      this.init = function () {
        const config = configService.getSync();
        this.unitName = config.wallet.settings.unitName;
        this.currentLanguageName = uxLanguage.getCurrentLanguageName();
        $scope.spendUnconfirmed = config.wallet.spendUnconfirmed;
        const fc = profileService.focusedClient;
        if (fc) {
          // $scope.encrypt = fc.hasPrivKeyEncrypted();
          this.externalSource = null;
          const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
          walletDefinedByKeys.readAddresses(fc.credentials.walletId, {}, (addresses) => {
            $scope.numAddresses = addresses.length;
            $rootScope.$apply();
          });
          $scope.numCosigners = fc.credentials.n;
          // TODO externalAccount
          // this.externalIndex = fc.getExternalIndex();
        }

        if (window.touchidAvailable) {
          const walletId = fc.credentials.walletId;
          this.touchidAvailable = true;
          config.touchIdFor = config.touchIdFor || {};
          $scope.touchid = config.touchIdFor[walletId];
        }
      };

      const unwatchSpendUnconfirmed = $scope.$watch('spendUnconfirmed', (newVal, oldVal) => {
        if (newVal === oldVal) {
          return;
        }
        const opts = {
          wallet: {
            spendUnconfirmed: newVal,
          },
        };
        configService.set(opts, (err) => {
          $rootScope.$emit('Local/SpendUnconfirmedUpdated');
          if (err) {
            $log.debug(err);
          }
        });
      });


      const unwatchRequestTouchid = $scope.$watch('touchid', (newVal, oldVal) => {
        if (newVal === oldVal || $scope.touchidError) {
          $scope.touchidError = false;
          return;
        }
        const walletId = profileService.focusedClient.credentials.walletId;

        const opts = {
          touchIdFor: {},
        };
        opts.touchIdFor[walletId] = newVal;

        $rootScope.$emit('Local/RequestTouchid', (err) => {
          if (err) {
            $log.debug(err);
            $timeout(() => {
              $scope.touchidError = true;
              $scope.touchid = oldVal;
            }, 100);
          } else {
            configService.set(opts, (configServiceError) => {
              if (configServiceError) {
                $log.debug(configServiceError);
                $scope.touchidError = true;
                $scope.touchid = oldVal;
              }
            });
          }
        });
      });

      $scope.$on('$destroy', () => {
        unwatchSpendUnconfirmed();
        unwatchRequestTouchid();
      });

      $scope.$watch('index.isSingleAddress', (newValue, oldValue) => {
        if (oldValue === newValue) { return; }
          profileService.setSingleAddressFlag(newValue);
        });
    });
}());
