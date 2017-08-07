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
      openNoDagCoinsModal,
      openPendingModal
    };

    const DAGCOIN_ASSET = 'B9dw3C3gMC+AODL/XqWjFh9jFe31jS08yf2C3zl8XGg=';

    let currentBalance = null;

    $rootScope.$on('Local/BalanceUpdated', (event, ab) => {
      currentBalance = ab;
      // get current conf file check for prop feeMethod
      getFeeDefaultMethod()
        .then((res) => {
          // set up only we dont have in config yet
          if (!res && currentBalance[DAGCOIN_ASSET] && currentBalance[DAGCOIN_ASSET].stable === 0) {
            setUpFeeDefaultMethod('bytes')
              .then(() => {
              });
          } else if (!res && currentBalance[DAGCOIN_ASSET] && currentBalance[DAGCOIN_ASSET].stable > 0) {
            setUpFeeDefaultMethod('hub')
              .then(() => {
              });
          }
        });
    });

    return service;


    function getCanBeSwitchedToHub() {
      return (currentBalance && currentBalance[DAGCOIN_ASSET] && currentBalance[DAGCOIN_ASSET].stable > 0);
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


    // appear modal if user dont have dagcoins
    function openNoDagCoinsModal() {
      $modal.open({
        templateUrl: 'views/modals/no-bytes.html',
        windowClass: animationService.modalAnimated.slideUp,
        controller: noDagcoinsModalController
      });
    }


    function noDagcoinsModalController($scope) {
      $scope.data = {};
      $scope.data.siteUrl = 'https://www.dagcoin.org/';
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


    function pendingModalController($scope) {
      $scope.pending = true;
      $scope.closeModal = closeModal;


      function closeModal() {
        $scope.$close();
      }
    }


    function openPendingModal() {
      $modal.open({
        templateUrl: 'views/modals/pending-modal.html',
        windowClass: animationService.modalAnimated.slideUp,
        controller: pendingModalController
      });
    }
  }
}());

