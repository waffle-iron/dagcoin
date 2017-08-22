(function () {
  'use strict';

  angular
    .module('copayApp.services')
    .factory('chooseFeeTypeService', chooseFeeTypeService);

  chooseFeeTypeService.$inject = ['$modal', 'go', 'animationService', 'fundingNodeService', '$rootScope', '$q'];

  /* @ngInject */
  function chooseFeeTypeService($modal, go, animationService, fundingNodeService, $rootScope, $q) {
    const service = {
      getFeeDefaultMethod,
      getCanBeSwitchedToHub,
      setUpFeeDefaultMethod,
      openNotPossibleToExchangeModal
    };

    let currentBalance = null;

    $rootScope.$on('Local/BalanceUpdated', (event, ab) => {
      currentBalance = ab;

      getFeeDefaultMethod()
        .then((res) => {
          if (!res) {
            const constants = require('byteballcore/constants.js');
            const hasDags = (currentBalance && currentBalance[constants.DAGCOIN_ASSET] && currentBalance[constants.DAGCOIN_ASSET].stable > 0);
            const hasBytes = (currentBalance && currentBalance.base && currentBalance.base.stable > 0);

            if (hasBytes) {
              setUpFeeDefaultMethod('bytes').then(() => {});
            }

            if (hasDags && !hasBytes) {
              openNotPossibleToExchangeModal();
            }
          }
        });
    });

    return service;

    function getCanBeSwitchedToHub() {
      const constants = require('byteballcore/constants.js');

      return (currentBalance && currentBalance[constants.DAGCOIN_ASSET] && currentBalance[constants.DAGCOIN_ASSET].stable > 0);
    }

    function getFeeDefaultMethod() {
      const deferred = $q.defer();
      const desktopApp = require('byteballcore/desktop_app.js');
      const appDataDir = desktopApp.getAppDataDir();
      const userConfFile = `${appDataDir}/conf.json`;
      const userConf = fundingNodeService.requireUncached(userConfFile);

      if (userConf && userConf.feeMethod) {
        deferred.resolve(userConf.feeMethod);
      } else {
        deferred.resolve(false);
      }

      return deferred.promise;
    }

    function setUpFeeDefaultMethod(way) {
      const deferred = $q.defer();
      const fs = require('fs');
      const desktopApp = require('byteballcore/desktop_app.js');
      const appDataDir = desktopApp.getAppDataDir();
      const userConfFile = `${appDataDir}/conf.json`;
      const userConf = fundingNodeService.requireUncached(userConfFile);

      userConf.feeMethod = way;

      fs.writeFile(userConfFile, JSON.stringify(userConf, null, '\t'), 'utf8', (err) => {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve();
        }
      });
      return deferred.promise;
    }

    function openNotPossibleToExchangeModal() {
      $modal.open({
        templateUrl: 'views/modals/no-bytes.html',
        windowClass: animationService.modalAnimated.slideUp,
        controller: noDagcoinsModalController
      });
    }


    function noDagcoinsModalController($scope) {
      $scope.data = {};
      $scope.data.siteUrl = 'https://dagcoin.org/public/Dagcoin_whitepaper.pdf';
      $scope.data.nw = window.nw;

      $scope.closeModal = closeModal;

      function closeModal() {
        $scope.$close();
      }

      $scope.openSite = openSite;

      function openSite() {
        $scope.data.nw.Shell.openExternal($scope.data.siteUrl);
      }

      $scope.goChooseFeeType = goChooseFeeType;

      function goChooseFeeType() {
        closeModal();
        go.preferencesGlobal();
      }
    }
  }
}());

