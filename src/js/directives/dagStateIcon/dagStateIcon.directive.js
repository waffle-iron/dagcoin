(() => {
  'use strict';

  /**
   * @desc directive to display state icons
   * @example <dag-state-icon icon="home"></dag-state-icon>
   */
  angular
    .module('copayApp.directives')
    .directive('dagStateIcon', dagStateIcon);

  dagStateIcon.$inject = [];

  function dagStateIcon() {
    return {
      restrict: 'E',
      replace: true,
      scope: {
        title: '@',
        icon: '@'
      },
      template: '<div class="state_icon"><svg-icon title="{{icon}}"></svg-icon><svg class="background"><use xlink:href="img/svg/symbol-defs.svg#icon-BG-shape-1"></use></svg></div>',
      link: ($scope) => {
        $scope.icon = $scope.icon || $scope.title || 'wallet';
      }
    };
  }
})();
