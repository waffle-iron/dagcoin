

angular.module('copayApp.controllers').controller('preferencesColorController',
  function ($scope, configService, profileService, go) {
    var config = configService.getSync();
    this.colorOpts = configService.colorOpts;

    const fc = profileService.focusedClient;
    const walletId = fc.credentials.walletId;

    var config = configService.getSync();
    config.colorFor = config.colorFor || {};
    this.color = config.colorFor[walletId] || '#4A90E2';

    this.save = function (color) {
      const self = this;
      const opts = {
        colorFor: {},
      };
      opts.colorFor[walletId] = color;

      configService.set(opts, (err) => {
        if (err) {
          $scope.$emit('Local/DeviceError', err);
          return;
        }
        self.color = color;
        $scope.$emit('Local/ColorUpdated');
      });
    };
  });
