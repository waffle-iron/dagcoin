(function () {
  angular.module('copayApp.controllers').controller('preferencesAliasController',
    function ($scope, $timeout, configService, profileService, go) {
      const config = configService.getSync();
      const fc = profileService.focusedClient;
      const walletId = fc.credentials.walletId;
      config.aliasFor = config.aliasFor || {};
      this.alias = config.aliasFor[walletId] || fc.credentials.walletName;

      this.save = function () {
        const self = this;
        const opts = {
          aliasFor: {},
        };
        opts.aliasFor[walletId] = self.alias;

        configService.set(opts, (err) => {
          if (err) {
            $scope.$emit('Local/DeviceError', err);
            return;
          }
          $scope.$emit('Local/AliasUpdated');
          $timeout(() => {
            go.path('preferences');
          }, 50);
        });
      };
    });
}());
