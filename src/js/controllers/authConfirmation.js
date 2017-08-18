/* eslint-disable new-cap, no-undef */
(function () {
  'use strict';

  /*

   This is incomplete!
   Todo:
   - modify bitcore to accept string indexes
   - add app column to my_addresses table
   - add choice of cosigners when m<n
   - implement signAuthRequest()
   - update handling of "sign" command in cosigners so that they accept auth requests, not just payments
   - post the result to site url
   - allow to change keys of the wallet, update definitions for all apps/domains saved so far
   - send the chain of key changes with the response

   */
  const Bitcore = require('bitcore-lib');

  angular.module('copayApp.controllers').controller('authConfirmationController',
    ($scope, $timeout, configService, profileService, go, authService, lodash) => {
      const ecdsaSig = require('byteballcore/signature.js');
      function extractDomainFromUrl(url) {
        const domainWithPath = url.replace(/^https?:\/\//i, '');
        let domain = domainWithPath.replace(/\/.*$/, '');
        domain = domain.replace(/^www\./i, '');
        return domain;
      }

      const bbWallet = require('byteballcore/wallet.js');

      // the wallet to sign with
      $scope.walletId = profileService.focusedClient.credentials.walletId;

      const objRequest = authService.objRequest;
      if (!objRequest) {
        throw Error('no request');
      }

      let appName;
      if (objRequest.app) {
        appName = objRequest.app;
      } else if (objRequest.url) {
        appName = extractDomainFromUrl(objRequest.url);
      } else {
        throw Error('neither app nor url');
      }

      if (objRequest.question) {
        $scope.question = objRequest.question;
      } else {
        $scope.question = `Log in to ${appName}?`;
      }

      const arrSigningDeviceAddresses = []; // todo allow to choose the devices that are to sign

      $scope.yes = function () {
        console.log('yes');
        const credentials = lodash.find(profileService.profile.credentials, { walletId: $scope.walletId });
        if (!credentials) {
          throw Error(`unknown wallet: ${$scope.walletId}`);
        }
        const coin = (credentials.network === 'livenet' ? '0' : '1');

        const signWithLocalPrivateKey = function (walletId, account, isChange, addressIndex, textToSign, handleSig) {
          const path = `m/44'/${coin}'/${account}'/${isChange}/${addressIndex}`;
          const xPrivKey = new Bitcore.HDPrivateKey.fromString(profileService.focusedClient.credentials.xPrivKey); // todo unlock the key if encrypted
          const privateKey = xPrivKey.derive(path).privateKey;
          // var privKeyBuf = privateKey.toBuffer();
          const privKeyBuf = privateKey.bn.toBuffer({ size: 32 }); // https://github.com/bitpay/bitcore-lib/issues/47
          handleSig(ecdsaSig.sign(textToSign, privKeyBuf));
        };

        // create a new app/domain-bound address if not created already
        bbWallet.issueOrSelectAddressForApp(credentials.walletId, app_name, () => {
          bbWallet.signAuthRequest(credentials.walletId, objRequest, arrSigningDeviceAddresses, signWithLocalPrivateKey, () => {
            go.walletHome();
          });
        });
      };

      $scope.no = function () {
        // do nothing
        console.log('no');
        go.walletHome();
      };
    });
}());
