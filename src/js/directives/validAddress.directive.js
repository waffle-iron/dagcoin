/* global angular */
(function () {
  'use strict';

  const ValidationUtils = require('byteballcore/validation_utils.js');

// byteball uri
  const conf = require('byteballcore/conf.js');

  /**
   * @desc validating DAG address
   * @example <input valid-address></div>
   */
  angular
    .module('copayApp.directives')
    .directive('validAddress', validAddress);

  validAddress.$inject = ['$rootScope', 'profileService'];

  function validAddress($rootScope, profileService) {
    return {
      restrict: 'A',
      require: 'ngModel',
      link(scope, elem, attrs, ctrl) {
        const validator = (value) => {
          if (!profileService.focusedClient) {
            return false;
          }

          if (typeof value === 'undefined') {
            ctrl.$pristine = true;
            return false;
          }

          // Regular url
          if (/^https?:\/\//.test(value)) {
            ctrl.$setValidity('validAddress', true);
            return value;
          }

          const re = new RegExp(`^${conf.program}:([A-Z2-7]{32})\b`, 'i');
          const arrMatches = value.match(re);
          if (arrMatches) {
            ctrl.$setValidity('validAddress', ValidationUtils.isValidAddress(arrMatches[1]));
            return value;
          }

          // Regular Address
          ctrl.$setValidity('validAddress', ValidationUtils.isValidAddress(value));
          return value;
        };

        ctrl.$parsers.unshift(validator);
        ctrl.$formatters.unshift(validator);
      },
    };
  }
}());
