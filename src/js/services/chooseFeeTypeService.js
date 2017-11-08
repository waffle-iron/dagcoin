(function () {
  'use strict';

  angular
    .module('copayApp.services')
    .factory('chooseFeeTypeService', chooseFeeTypeService);

  chooseFeeTypeService.$inject = ['$modal', 'go', 'animationService', 'fundingExchangeProviderService', '$rootScope', '$q', 'fileSystemService', 'configService'];

  /* @ngInject */
  function chooseFeeTypeService($modal, go, animationService, fundingExchangeProviderService, $rootScope, $q, fileSystemService, configService) {
    const service = {
      getFeeDefaultMethod,
      setUpFeeDefaultMethod,
      openNotPossibleToExchangeModal
    };

    $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', () => {
      getFeeDefaultMethod()
        .then((res) => {
          if (!res) {
            setUpFeeDefaultMethod('hub').then(() => {});
          }
        });
    });

    return service;

    function getFeeDefaultMethod() {
      const deferred = $q.defer();
      const config = configService.getSync();

      if (config && config.feeMethod) {
        deferred.resolve(config.feeMethod);
      } else {
        deferred.resolve(false);
      }

      return deferred.promise;
    }

    function setUpFeeDefaultMethod(way) {
      const deferred = $q.defer();
      const config = { feeMethod: way };

      configService.set(config, (err) => {
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

