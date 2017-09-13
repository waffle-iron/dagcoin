(() => {
  'use strict';

  /**
   * @desc dagNavBar directive
   * @example <dag-nav-bar></dag-nav-bar>
   */
  angular
    .module('copayApp.directives')
    .directive('dagNavBar', dagNavBar);

  dagNavBar.$inject = ['go', '$rootScope', '$state'];

  function dagNavBar(go, $rootScope, $state) {
    return {
      restrict: 'E',
      templateUrl: 'directives/dagNavBar/dagNavBar.template.html',
      replace: true,
      scope: {
        stateTitle: '@',
        title: '@',
        triggerIcon: '@',
        triggerState: '@'
      },
      link: ($scope, element, attr) => {
        if ('invert' in attr) {
          element.addClass('invert');
        }

        if ('goBack' in attr) {
          $scope.showBack = true;
        }

        $scope.triggerUrl = () => {
          $state.go($scope.triggerState);
        };

        $scope.showBackTitle = false;

        if ($rootScope.previousState && $rootScope.previousState.title) {
          $scope.showBackTitle = $rootScope.previousState.title;
        }

        $scope.openLeftMenu = () => {
          go.swipe(true);
        };
      }
    };
  }
})();
