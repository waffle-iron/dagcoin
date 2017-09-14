(() => {
  'use strict';

  angular
    .module('copayApp.controllers')
    .controller('IntroController', IntroController);

  IntroController.$inject = ['$scope'];
  function IntroController($scope) {
    $scope.swiper = {};
    $scope.active_index = 0;

    $scope.isLastSlide = () => {
      return ($scope.active_index === 2 ? true : false);
    };

    $scope.next = () => {
      $scope.swiper.slideNext();
    };
    activate();

    function activate() {
      $scope.onReadySwiper = (swiper) => {
        $scope.swiper = swiper;

        swiper.on('transitionEnd', () => {
          $scope.$apply(() => {
            $scope.active_index = swiper.activeIndex;
          });
        });
      };
    }
  }
})();
