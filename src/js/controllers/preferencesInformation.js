(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('preferencesInformation',
    function ($scope, $log, $timeout, isMobile, gettextCatalog, lodash, profileService, storageService, go, configService) {
      const constants = require('byteballcore/constants.js');
      const fc = profileService.focusedClient;
      const c = fc.credentials;

      this.init = function () {
        const basePath = c.getBaseAddressDerivationPath();
        const config = configService.getSync().wallet.settings;

        $scope.walletName = c.walletName;
        $scope.walletId = c.walletId;
        $scope.network = c.network;
        $scope.derivationStrategy = c.derivationStrategy || 'BIP44';
        $scope.basePath = basePath;
        $scope.M = c.m;
        $scope.N = c.n;
        $scope.addrs = null;

        fc.getAddresses({
          doNotVerify: true,
        }, (err, addrs) => {
          if (err) {
            $log.warn(err);
            return;
          }
          /* var last10 = [],
           i = 0,
           e = addrs.pop();
           while (i++ < 10 && e) {
           e.path = e.path;
           last10.push(e);
           e = addrs.pop();
           }
           $scope.addrs = last10; */
          $scope.addrs = addrs;
          $timeout(() => {
            $scope.$apply();
          });
        });

        fc.getListOfBalancesOnAddresses((listOfBalances) => {
          const balanceList = listOfBalances.map((row) => {
            if (row.asset === 'base' || row.asset === constants.DAGCOIN_ASSET) {
              const assetName = row.asset !== 'base' ? 'DAG' : 'base';
              const unitName = row.asset !== 'base' ? config.dagUnitName : config.unitName;
              row.amount = `${profileService.formatAmount(row.amount, assetName, { dontRound: true })} ${unitName}`;
              return row;
            }
            return row;
          });
          // groupBy address
          const assocListOfBalances = {};
          balanceList.forEach((row) => {
            if (assocListOfBalances[row.address] === undefined) assocListOfBalances[row.address] = [];
            assocListOfBalances[row.address].push(row);
          });
          $scope.assocListOfBalances = assocListOfBalances;
          $timeout(() => {
            $scope.$apply();
          });
        });
      };

      $scope.hasListOfBalances = function () {
        return !!Object.keys($scope.assocListOfBalances || {}).length;
      };

      this.sendAddrs = function () {
        const self = this;

        if (isMobile.Android() || isMobile.Windows()) {
          window.ignoreMobilePause = true;
        }

        self.loading = true;

        function formatDate(ts) {
          const dateObj = new Date(ts * 1000);
          if (!dateObj) {
            $log.debug('Error formating a date');
            return 'DateError';
          }
          if (!dateObj.toJSON()) {
            return '';
          }
          return dateObj.toJSON();
        }

        $timeout(() => {
          fc.getAddresses({
            doNotVerify: true,
          }, (err, addrs) => {
            self.loading = false;
            if (err) {
              $log.warn(err);
              return;
            }

            let body = `Byteball Wallet "${$scope.walletName}" Addresses.\n\n`;
            body += '\n';
            body += addrs.map(v => (`* ${v.address} ${v.path} ${formatDate(v.createdOn)}`)).join('\n');

            window.plugins.socialsharing.shareViaEmail(
              body,
              'Byteball Addresses',
              null, // TO: must be null or an array
              null, // CC: must be null or an array
              null, // BCC: must be null or an array
              null, // FILES: can be null, a string, or an array
              () => {},
              () => {}
            );

            $timeout(() => {
              $scope.$apply();
            }, 1000);
          });
        }, 100);
      };

      this.clearTransactionHistory = function () {
        $scope.$emit('Local/ClearHistory');

        $timeout(() => {
          go.walletHome();
        }, 100);
      };
    });
}());
