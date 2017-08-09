(function () {
  'use strict';

  angular
    .module('copayApp.directives')
    .directive('sendPayment', () => {
      console.log('sendPayment directive');
      return {
        replace: true,
        link($scope, element, attrs) {
          console.log('link called', attrs, element);
          element.bind('click', () => {
            console.log('clicked', attrs);
            $scope.sendPayment(attrs.address);
          });
        },
      };
    });
}());
