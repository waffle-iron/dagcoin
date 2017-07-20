(function () {
  'use strict';

  angular
    .module('copayApp.directives')
    .directive('ngEnter', () => function (scope, element, attrs) {
      element.bind('keydown', (e) => {
        if (e.which === 13 && !e.shiftKey) {
          scope.$apply(() => {
            scope.$eval(attrs.ngEnter, { e });
          });
          e.preventDefault();
        }
      });
    });
}());
