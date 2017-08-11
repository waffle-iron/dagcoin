(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('createController',
    function ($scope, $rootScope, $location, $timeout, $log, lodash, go, profileService, configService, isCordova, gettext, isMobile, derivationPathHelper, correspondentListService) {
      const self = this;
      const defaults = configService.getDefaults();
      this.isWindowsPhoneApp = isMobile.Windows() && isCordova;
      $scope.account = 1;
      $scope.derivationPath = derivationPathHelper.default;

      // ng-repeat defined number of times instead of repeating over array?
      this.getNumber = function (num) {
        return new Array(num);
      };

      const updateRCSelect = function (n) {
        $scope.totalCosigners = n;
        self.RCValues = lodash.range(1, n + 1);
        if ($scope.requiredCosigners > n || !$scope.requiredCosigners) {
          $scope.requiredCosigners = parseInt((n / 2) + 1, 10);
        }
      };

      const updateSeedSourceSelect = function () {
        self.seedOptions = [{
          id: 'new',
          label: gettext('New Random Seed'),
        }, {
          id: 'set',
          label: gettext('Specify Seed...'),
        }];
        $scope.seedSource = self.seedOptions[0];
      };

      this.TCValues = lodash.range(2, defaults.limits.totalCosigners + 1);
      $scope.totalCosigners = defaults.wallet.totalCosigners;
      this.cosigners = [];// Array($scope.totalCosigners);
      for (let i = 0; i < $scope.totalCosigners - 1; i += 1) {
        this.cosigners.push({});
      }
      correspondentListService.list((err, ab) => {
        self.candidate_cosigners = ab;
        $scope.$digest();
      });

      /*
       $scope.$watch(function(){return $scope.totalCosigners;}, function(newVal, oldVal){
       console.log("watch "+oldVal+" "+newVal);
       if (newVal > oldVal)
       for (var i=oldVal; i<newVal-1; i++)
       self.cosigners.push({});
       else
       self.cosigners.length = newVal-1;
       }, true); */

      this.setTotalCosigners = function (tc) {
        const oldLen = self.cosigners.length;
        const newLen = tc - 1;
        if (newLen > oldLen) {
          for (let i = oldLen; i < newLen; i += 1) {
            self.cosigners.push({});
          }
        } else if (newLen < oldLen) {
          self.cosigners.length = newLen;
        }

        updateRCSelect(tc);
        updateSeedSourceSelect(tc);
        self.seedSourceId = $scope.seedSource.id;
      };

      this.setMultisig = function () {
        this.setTotalCosigners(3);
        $scope.requiredCosigners = 2;
      };

      this.onCorrespondentSelected = function (deviceAddress) {
        console.log(deviceAddress);
        if (deviceAddress === 'new') {
          go.path('correspondentDevices.addCorrespondentDevice');
        }
      };


      this.setSeedSource = function () {
        self.seedSourceId = $scope.seedSource.id;

        $timeout(() => {
          $rootScope.$apply();
        });
      };

      function setError(error) {
        self.error = gettext(error);
      }

      this.createWallet = function (opts) {
        self.loading = true;
        $timeout(() => {
          profileService.createWallet(opts, (err, walletId) => {
            self.loading = false;
            if (err) {
              $log.warn(err);
              self.error = err;
              $timeout(() => {
                $rootScope.$apply();
              });
              return;
            }

            // if (opts.mnemonic || opts.externalSource || opts.extendedPrivateKey) {
            if (opts.externalSource) {
              if (opts.n === 1) {
                $rootScope.$emit('Local/WalletImported', walletId);
              }
            }
            /* if (opts.n > 1)
             $rootScope.$emit('Local/ShowAlert', "Please approve wallet creation on other devices", 'fi-key', function(){
             go.walletHome();
             }); */
          });
        }, 100);
      };

      this.create = function (form) {
        if (form && form.$invalid) {
          this.error = gettext('Please enter the required fields');
          return;
        }
        if (self.cosigners.length !== $scope.totalCosigners - 1) {
          setError('invalid number of cosigners');
          return;
        }

        const opts = {
          m: $scope.requiredCosigners,
          n: $scope.totalCosigners,
          name: form.walletName.$modelValue,
          networkName: 'livenet',
          cosigners: [],
        };
        if ($scope.totalCosigners > 1) {
          opts.cosigners = lodash.uniq(self.cosigners.map(cosigner => cosigner.device_address));
          if (opts.cosigners.length !== $scope.totalCosigners - 1) {
            setError('Please select different co-signers');
            return;
          }
          for (let i = 0; i < opts.cosigners.length; i += 1) {
            if (!opts.cosigners[i] || opts.cosigners[i].length !== 33) {
              setError('Please fill all co-signers');
              return;
            }
          }
        }
        /*
         var setSeed = self.seedSourceId == 'set';
         if (setSeed) {

         var words = form.privateKey.$modelValue || '';
         if (words.indexOf(' ') == -1 && words.indexOf('prv') == 1 && words.length > 108)
         opts.extendedPrivateKey = words;
         else
         opts.mnemonic = words;

         opts.passphrase = form.passphrase.$modelValue;

         var pathData = derivationPathHelper.parse($scope.derivationPath);
         if (!pathData) {
         this.error = gettext('Invalid derivation path');
         return;
         }

         opts.account = pathData.account;
         opts.networkName = pathData.networkName;
         opts.derivationStrategy = pathData.derivationStrategy;

         }
         else
         opts.passphrase = form.createPassphrase.$modelValue;

         if (setSeed && !opts.mnemonic && !opts.extendedPrivateKey) {
         this.error = gettext('Please enter the wallet seed');
         return;
         }
         */

        self.createWallet(opts);
      };

      this.formFocus = function (what) {
        if (!this.isWindowsPhoneApp) {
          return;
        }

        if (what && what === 'my-name') {
          this.hideWalletName = true;
          this.hideTabs = true;
        } else if (what && what === 'wallet-name') {
          this.hideTabs = true;
        } else {
          this.hideWalletName = false;
          this.hideTabs = false;
        }
        $timeout(() => {
          $rootScope.$digest();
        }, 1);
      };

      $scope.$on('$destroy', () => {
        $rootScope.hideWalletNavigation = false;
      });

      updateSeedSourceSelect(1);
      self.setSeedSource('new');
    });
}());
