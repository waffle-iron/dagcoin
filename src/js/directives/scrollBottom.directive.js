(function () {
  'use strict';

  angular
    .module('copayApp.directives')
    .directive('scrollBottom', ($timeout) => { // based on http://plnkr.co/edit/H6tFjw1590jHT28Uihcx?p=preview
      console.log('scrollBottom directive');
      return {
        link: (scope, element) => {
          scope.$watchCollection('messageEvents', (newCollection) => {
            if (newCollection) {
              $timeout(() => {
                if (scope.autoScrollEnabled) {
                  element[0].scrollTop = element[0].scrollHeight;
                }
              }, 100);
            }
          });
        },
      };
    });
}());
