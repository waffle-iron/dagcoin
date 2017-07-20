(function () {
  'use strict';

  angular
    .module('copayApp.directives')
    .directive('dynamic', ($compile) => {
      console.log('dynamic directive');
      return {
        restrict: 'A',
        replace: true,
        link: (scope, ele, attrs) => {
          scope.$watch(attrs.dynamic, (html) => {
            ele.html(html);
            $compile(ele.contents())(scope);
          });
        },
      };
    });
}());
