

angular.module('copayApp.controllers').controller('disclaimerController',
  ($scope, $timeout, storageService, applicationService, gettextCatalog, isCordova, uxLanguage, go, $rootScope) => {
    if (!isCordova && process.platform === 'win32' && navigator.userAgent.indexOf('Windows NT 5.1') >= 0) {
      $rootScope.$emit('Local/ShowAlert', 'Windows XP is not supported', 'fi-alert', () => {
        process.exit();
      });
    }

    $scope.agree = function () {
      if (isCordova) {
        window.plugins.spinnerDialog.show(null, gettextCatalog.getString('Loading...'), true);
      }
      $scope.loading = true;
      $timeout(() => {
        storageService.setDisclaimerFlag((err) => {
          $timeout(() => {
            if (isCordova) { window.plugins.spinnerDialog.hide(); }
                // why reload the page?
                // applicationService.restart();
            go.walletHome();
          }, 1000);
        });
      }, 100);
    };

    $scope.init = function () {
      storageService.getDisclaimerFlag((err, val) => {
        $scope.lang = uxLanguage.currentLanguage;
        $scope.agreed = val;
        $timeout(() => {
          $scope.$digest();
        }, 1);
      });
    };
  });
