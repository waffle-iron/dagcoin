(function () {
  angular.module('copayApp.controllers').controller('preferencesEmailController',
    function ($scope, go) {
      this.save = function () {
        const self = this;
        this.error = null;
        // const fc = profileService.focusedClient;
        this.saving = true;
        $scope.$emit('Local/EmailSettingUpdated', self.email, () => {
          self.saving = false;
          go.path('preferences');
        });
      };
    });
}());
