(() => {
  'use strict';

  /**
   * @desc custome icon directive
   * @example <dag-bottom-bar></dag-bottom-bar>
   */
  angular
    .module('copayApp.directives')
    .directive('dagBottomBar', dagBottomBar);

  dagBottomBar.$inject = ['menuLinks'];

  function dagBottomBar(menuLinks) {
    return {
      restrict: 'E',
      templateUrl: 'directives/dagBottomBar/dagBottomBar.template.html',
      replace: true,
      link: ($scope) => {
        $scope.links = [];

        menuLinks.forEach((category) => {
          category.links.forEach((link) => {
            if (link.menuBar) {
              $scope.links.push(link);
            }
          });
        });
      }
    };
  }
})();
