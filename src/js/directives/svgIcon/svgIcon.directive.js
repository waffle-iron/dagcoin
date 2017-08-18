/* global angular */

(() => {
  'use strict';

  /**
   * @desc custome icon directive
   * @example <svg-icon name="name"></svg-icon>
   */
  angular
      .module('copayApp.directives')
      .directive('svgIcon', svgIcon);

  svgIcon.$inject = ['$sce', '$templateRequest', '$templateCache'];

  function svgIcon($sce, $templateRequest, $templateCache) {
    return {
      restrict: 'E',
      scope: {
        name: '@',
      },
      link: ($scope, element) => {
        /* istanbul ignore next */
        if (!$scope.name) {
          return false;
        }

        const svgFile = `${$scope.name}.svg`;

        function loadTemplate() {
          const templateUrl = $sce.getTrustedResourceUrl(`/public/css/svg/${svgFile}`);

          $templateRequest(templateUrl).then((template) => {
            $templateCache.put(svgFile, template);
            renderSVG();
          });
        }

        function renderSVG() {
          if ($templateCache.get(svgFile)) {
            element.html($templateCache.get(svgFile)).addClass(`icon-${$scope.name}`);
          } else {
            loadTemplate();
          }
        }

        return renderSVG();
      },
    };
  }
})();
