(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('paymentUriController',
    function ($rootScope, $stateParams, $location, $timeout, profileService, configService, lodash, bitcore, go) {
      function strip(number) {
        return (parseFloat(number.toPrecision(12)));
      }

      // Build bitcoinURI with querystring
      this.checkBitcoinUri = function () {
        const query = [];
        angular.forEach($location.search(), (value, key) => {
          query.push(`${key}=${value}`);
        });
        const queryString = query ? query.join('&') : null;
        this.bitcoinURI = $stateParams.data + (queryString ? `?${queryString}` : '');

        const URI = bitcore.URI;
        // const isUriValid = URI.isValid(this.bitcoinURI);
        if (!URI.isValid(this.bitcoinURI)) {
          this.error = true;
          return;
        }
        const uri = new URI(this.bitcoinURI);

        if (uri && uri.address) {
          const config = configService.getSync().wallet.settings;
          const unitValue = config.unitValue;
          const unitName = config.unitName;

          if (uri.amount) {
            uri.amount = `${strip(uri.amount / unitValue)} ${unitName}`;
          }
          uri.network = uri.address.network.name;
          this.uri = uri;
        }
      };

      this.getWallets = function (network) {
        return profileService.getWallets(network);
      };

      this.selectWallet = function (wid) {
        const self = this;
        if (wid !== profileService.focusedClient.credentials.walletId) {
          profileService.setAndStoreFocus(wid, () => {
          });
        }
        go.send();
        $timeout(() => {
          $rootScope.$emit('paymentUri', self.bitcoinURI);
        }, 100);
      };
    });
}());
