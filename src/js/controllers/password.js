(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('passwordController',
    function ($rootScope, $scope, $timeout, profileService, notification, go, gettext) {
      const self = this;

      self.validationErrors = [];
      let pass1;

      self.isVerification = false;

      document.getElementById('passwordInput').focus();

      self.close = function (cb) {
        return cb('No password given');
      };

      self.set = function (isSetup, cb) {
        self.error = false;

        if (isSetup && !self.isVerification) {
          document.getElementById('passwordInput').focus();
          self.isVerification = true;
          pass1 = self.password;
          self.password = null;
          $timeout(() => {
            $rootScope.$apply();
          });
          return;
        }
        if (isSetup) {
          if (pass1 !== self.password) {
            self.error = gettext('Passwords do not match');
            self.isVerification = false;
            self.password = null;
            pass1 = null;

            return;
          }
        }
        cb(null, self.password);
      };

      self.validate = function () {
        self.validationErrors = [];

        if (self.password.length < 8) {
            self.validationErrors.push('Password must be at least 8 characters long');
        }
        if (self.password.search(/[a-z]/i) < 0) {
            self.validationErrors.push('Password must contain at least one letter');
        }
        if (self.password.search(/[0-9]/) < 0) {
            self.validationErrors.push('Password must contain at least one digit');
        }
        if (self.password.search(/[!@#$%^&*]/) < 0) {
            self.validationErrors.push('Password must contain at least one special character');
        }
        if (self.validationErrors.length > 0) {
            return false;
        }

        return true;
      };
    });
}());
