(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('newVersionIsAvailable', ($scope, $modalInstance, go, newVersion) => {
    $scope.version = newVersion.version;

    $scope.openDownloadLink = function () {
      let link = '';
      if (navigator && navigator.app) {
        link = 'https://play.google.com/store/apps/details?id=org.dagcoin';
        if (newVersion.version.match('t$')) {
          link += '.testnet';
        }
      } else {
        link = `https://github.com/dagcoin/dagcoin/releases/tag/v${newVersion.version}`;
      }
      go.openExternalLink(link);
      $modalInstance.close('closed result');
    };

    $scope.later = function () {
      $modalInstance.close('closed result');
    };
  });
}());
