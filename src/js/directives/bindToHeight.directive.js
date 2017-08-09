(function () {
  'use strict';

  angular
    .module('copayApp.directives')
    .directive('bindToHeight', () => {
      console.log('bindToHeight directive');
      return {
        restrict: 'A',
        link: (scope, elem, attrs) => {
          const attributes = scope.$eval(attrs.bindToHeight);
          const targetElem = angular.element(document.querySelector(attributes[1]));

          // Watch for changes
          scope.$watch(() => targetElem[0].clientHeight, (newValue, oldValue) => {
            if (newValue !== oldValue && newValue !== 0) {
              elem.css(attributes[0], `${newValue}px`);
              // elem[0].scrollTop = elem[0].scrollHeight;
            }
          });
        },
      };
    });
}());
