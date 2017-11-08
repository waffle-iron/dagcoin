(() => {
  'use strict';

  /**
   * @desc custome icon directive
   * @example <svg-icon name="name"></svg-icon>
   */
  angular
      .module('copayApp.directives')
      .directive('svgIcon', svgIcon);

  svgIcon.$inject = ['$sce', '$templateRequest', '$templateCache', 'isCordova'];

  function svgIcon($sce, $templateRequest, $templateCache, isCordova) {
    return {
      restrict: 'E',
      scope: {
        name: '@',
        title: '@'
      },
      link: ($scope, element) => {
        /* istanbul ignore next */
        if (!$scope.name && !$scope.title) {
          return false;
        }

        const svgFile = `${$scope.name || $scope.title}.svg`;

        function loadTemplate() {
          const svgPath = isCordova ? `css/svg/${svgFile}` : `/public/css/svg/${svgFile}`;
          const templateUrl = $sce.getTrustedResourceUrl(svgPath);

          $templateRequest(templateUrl).then((template) => {
            $templateCache.put(svgFile, template);
            renderSVG();
          });
        }

        function renderSVG() {
          if ($templateCache.get(svgFile)) {
            element.html($templateCache.get(svgFile)).addClass(`svg-icon-${$scope.name || $scope.title}`);
          } else {
            loadTemplate();
          }
        }

        return renderSVG();
      }
    };
  }
})();
