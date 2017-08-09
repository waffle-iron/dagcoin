(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('preferencesGlobalController',
    function ($scope, $q, $rootScope, $timeout, $log, configService, uxLanguage, pushNotificationsService, profileService, fundingNodeService, $modal, animationService, chooseFeeTypeService) {
      const conf = require('byteballcore/conf.js');
      const self = this;

      $scope.encrypt = !!profileService.profile.xPrivKeyEncrypted;

      self.initFundingNode = () => {
        self.fundingNode = fundingNodeService.isActivated();
        self.exchangeFee = fundingNodeService.getExchangeFee();
      };

      this.init = function () {
        const config = configService.getSync();
        this.unitName = config.wallet.settings.unitName;
        this.dagUnitName = config.wallet.settings.dagUnitName;
        this.deviceName = config.deviceName;
        this.myDeviceAddress = require('byteballcore/device.js').getMyDeviceAddress();
        this.hub = config.hub;
        this.currentLanguageName = uxLanguage.getCurrentLanguageName();
        this.torEnabled = conf.socksHost && conf.socksPort;
        $scope.pushNotifications = config.pushNotifications.enabled;

        self.initFundingNode();
      };

      const unwatchPushNotifications = $scope.$watch('pushNotifications', (newVal, oldVal) => {
        if (newVal === oldVal) return;
        const opts = {
          pushNotifications: {
            enabled: newVal,
          },
        };
        configService.set(opts, (err) => {
          if (opts.pushNotifications.enabled) {
            pushNotificationsService.pushNotificationsInit();
          } else {
            pushNotificationsService.pushNotificationsUnregister();
          }
          if (err) $log.debug(err);
        });
      });

      const unwatchEncrypt = $scope.$watch('encrypt', (val) => {
        const fc = profileService.focusedClient;
        if (!fc) return;

        if (val && !fc.hasPrivKeyEncrypted()) {
          $rootScope.$emit('Local/NeedsPassword', true, null, (err, password) => {
            if (err || !password) {
              $scope.encrypt = false;
              return;
            }
            profileService.setPrivateKeyEncryptionFC(password, () => {
              $rootScope.$emit('Local/NewEncryptionSetting');
              $scope.encrypt = true;
            });
          });
        } else if (!val && fc.hasPrivKeyEncrypted()) {
          profileService.unlockFC(null, (err) => {
            if (err) {
              $scope.encrypt = true;
              return;
            }
            profileService.disablePrivateKeyEncryptionFC((disablePrivateKeyEncryptionFCError) => {
              $rootScope.$emit('Local/NewEncryptionSetting');
              if (disablePrivateKeyEncryptionFCError) {
                $scope.encrypt = true;
                $log.error(disablePrivateKeyEncryptionFCError);
                return;
              }
              $scope.encrypt = false;
            });
          });
        }
      });

      const unwatchFundingNode = $scope.$watch(() => self.fundingNode, (newVal, oldVal) => {
        if (oldVal === null || oldVal === undefined || newVal === oldVal) {
          return;
        }

        fundingNodeService.canEnable().then(() => {
          fundingNodeService.update(newVal).then(() => {
            self.exchangeFee = fundingNodeService.getExchangeFee();
          });
        }, () => {
          self.fundingNode = false;
        });
      }, true);

      self.onExchangeFeeBlur = function () {
        const exchangeFeeVal = parseFloat(self.exchangeFee);
        if (self.exchangeFee && exchangeFeeVal.toString() === self.exchangeFee.toString() && exchangeFeeVal >= 0) {
          fundingNodeService.setExchangeFee(self.exchangeFee).then(() => {
          }, () => {
            self.exchangeFee = fundingNodeService.getExchangeFee();
          });
        } else {
          self.exchangeFee = fundingNodeService.getExchangeFee();
        }
      };

      $scope.$on('$destroy', () => {
        unwatchPushNotifications();
        unwatchEncrypt();
        unwatchFundingNode();
      });

      chooseFeeTypeService.getFeeDefaultMethod()
        .then((res) => {
          self.typeOfPaymentFee = res;
        });

      self.enableHubOption = chooseFeeTypeService.getCanBeSwitchedToHub();
      self.changeTypeOfPayment = changeTypeOfPayment;

      function changeTypeOfPayment(model) {
        self.enableHubOption = chooseFeeTypeService.getCanBeSwitchedToHub();

        if (self.enableHubOption) {
          chooseFeeTypeService.setUpFeeDefaultMethod(model)
            .then(() => {
            });
        } else if (model === 'hub' && !self.enableHubOption) {
          self.typeOfPaymentFee = 'bytes';
          chooseFeeTypeService.openNoBytesModal();
        }
      }
    });
}());
