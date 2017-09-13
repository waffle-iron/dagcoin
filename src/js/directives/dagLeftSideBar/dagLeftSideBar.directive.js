/* global angular */

(() => {
  'use strict';

  /**
   * @desc custome icon directive
   * @example <dag-left-side-bar></dag-left-side-bar>
   */
  angular
    .module('copayApp.directives')
    .directive('dagLeftSideBar', dagLeftSideBar);

  dagLeftSideBar.$inject = ['menuLinks'];

  function dagLeftSideBar(menuLinks) {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'directives/dagLeftSideBar/dagLeftSideBar.template.html',
      scope: {},
      link: ($scope) => {
        $scope.lists = menuLinks;
      }
    };
  }
})();
