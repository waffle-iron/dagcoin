(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('preferencesGlobalController',
    function ($scope, $q, $rootScope, $timeout, $log, configService, uxLanguage, pushNotificationsService, profileService, fundingNodeService, $modal, animationService, chooseFeeTypeService) {
      const conf = require('byteballcore/conf.js');
      const self = this;
      self.fundingNodeSettings = {};

      $scope.encrypt = !!profileService.profile.xPrivKeyEncrypted;

      self.initFundingNode = () => {
        self.fundingNode = fundingNodeService.isActivated();
        self.fundingNodeSettings = fundingNodeService.getSettings();
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
            self.fundingNodeSettings = fundingNodeService.getSettings();
          });
        }, () => {
          self.fundingNode = false;
        });
      }, true);

      function getCorrectValue(oldValue, newValue, isFloat) {
        const newValueParsed = isFloat ? parseFloat(newValue) : parseInt(newValue, 10);
        if (newValue && newValueParsed.toString() === newValue.toString() && newValueParsed >= 0) {
          return newValueParsed;
        }
        return oldValue;
      }

      self.onFundingNodeSettingBlur = function () {
        const oldSettings = fundingNodeService.getSettings();
        const newSettings = {
          exchangeFee: getCorrectValue(oldSettings.exchangeFee, self.fundingNodeSettings.exchangeFee, true),
          totalBytes: getCorrectValue(oldSettings.totalBytes, self.fundingNodeSettings.totalBytes, false),
          bytesPerAddress: getCorrectValue(oldSettings.bytesPerAddress, self.fundingNodeSettings.bytesPerAddress, false),
          maxEndUserCapacity: getCorrectValue(oldSettings.maxEndUserCapacity, self.fundingNodeSettings.maxEndUserCapacity, false)
        };

        fundingNodeService.setSettings(newSettings).then(() => {
          self.fundingNodeSettings = fundingNodeService.getSettings();
        }, () => {
          self.fundingNodeSettings = fundingNodeService.getSettings();
        });
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
        if (model === 'hub' && !self.enableHubOption) {
          self.typeOfPaymentFee = 'bytes';
        } else {
          self.typeOfPaymentFee = model;
        }

        chooseFeeTypeService.setUpFeeDefaultMethod(self.typeOfPaymentFee).then(() => {});
      }
    });
}());
