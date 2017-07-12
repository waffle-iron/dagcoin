(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('preferencesLanguageController',
    function ($scope, $log, $timeout, configService, go, uxLanguage) {
      this.availableLanguages = uxLanguage.getLanguages();

      this.save = function (newLang) {
        const opts = {
          wallet: {
            settings: {
              defaultLanguage: newLang,
            },
          },
        };

        configService.set(opts, (err) => {
          if (err) $log.warn(err);
          $scope.$emit('Local/LanguageSettingUpdated');
          $timeout(() => {
            go.preferencesGlobal();
          }, 100);
        });
      };
    });
}());
