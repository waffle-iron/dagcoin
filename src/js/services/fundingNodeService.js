/* eslint-disable import/no-dynamic-require */
(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('fundingNodeService', ($q, $rootScope, discoveryService, fileSystemService, configService) => {
      const self = {};

      const settings = {
        exchangeFee: 0.001,
        totalBytes: 100000,
        bytesPerAddress: 10000,
        maxEndUserCapacity: 10
      };

      let messageIntervalTimeout = 5 * 60 * 1000;
      let fundingNode = false;

      let messageInterval = null;
      let assocBalances = null;
      let updatingConfing = false;

      self.update = update;
      self.isActivated = isActivated;
      self.canEnable = canEnable;
      self.deactivate = deactivate;
      self.activate = activate;
      self.init = init;
      self.getSettings = getSettings;
      self.setSettings = setSettings;
      self.getUserConfig = getUserConfig;

      $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', (event, ab) => {
        assocBalances = ab;

        self.init();
      });

      function init() {
        const conf = getUserConfig();

        settings.exchangeFee = conf.exchangeFee || settings.exchangeFee;
        settings.totalBytes = conf.totalBytes || settings.totalBytes;
        settings.bytesPerAddress = conf.bytesPerAddress || settings.bytesPerAddress;
        settings.maxEndUserCapacity = conf.maxEndUserCapacity || settings.maxEndUserCapacity;

        messageIntervalTimeout = conf.fundingNodeMessageInterval || messageIntervalTimeout;

        discoveryService.sendMessage(discoveryService.messages.listTraders).then(() => { });

        return self.canEnable().then(() => {
          self.update(conf.fundingNode || false);
        }, () => {
          if (fundingNode) {
            self.update(false).then(() => { }, err => console.log(err));
          }
        });
      }

      function getUserConfig() {
        try {
          const config = configService.getSync();
          return config;
        } catch (e) {
          return {}; // empty config
        }
      }

      function updateConfig() {
        if (updatingConfing) {
          return $q.resolve();
        }

        const deferred = $q.defer();
        const userConf = getUserConfig();

        if (userConf.fundingNode === fundingNode &&
          userConf.exchangeFee === settings.exchangeFee &&
          userConf.totalBytes === settings.totalBytes &&
          userConf.bytesPerAddress === settings.bytesPerAddress &&
          userConf.maxEndUserCapacity === settings.maxEndUserCapacity) {
          return $q.resolve();
        }

        userConf.fundingNode = fundingNode;
        userConf.exchangeFee = settings.exchangeFee;
        userConf.totalBytes = settings.totalBytes;
        userConf.bytesPerAddress = settings.bytesPerAddress;
        userConf.maxEndUserCapacity = settings.maxEndUserCapacity;

        updatingConfing = true;

        configService.setWithoutMergingOld(userConf, (err) => {
          if (err) {
            deferred.reject(err);
          } else {
            deferred.resolve();
            updatingConfing = false;
          }
        });

        return deferred.promise;
      }

      function isActivated() {
        return fundingNode;
      }

      function aliveAndWell() {
        const def = $q.defer();
        const device = require('byteballcore/device.js');

        device.startWaitingForPairing((pairingInfo) => {
          const code = `${pairingInfo.device_pubkey}@${pairingInfo.hub}#${pairingInfo.pairing_secret}`;

          discoveryService.sendMessage(discoveryService.messages.aliveAndWell, { pairCode: code }).then(def.resolve, def.reject);
        });

        return def.promise;
      }

      function activate() {
        if (fundingNode) {
          return $q.resolve();
        }

        const sendMessPromise = discoveryService.sendMessage(discoveryService.messages.startingTheBusiness);
        const setSettingsPromise = sendMessPromise.then(() => setSettings(settings));
        const aliveAndWellPromise = setSettingsPromise.then(() => aliveAndWell());

        return aliveAndWellPromise.then(() => {
          messageInterval = setInterval(() => {
            aliveAndWell().then(() => { }, err => console.log(err));
          }, messageIntervalTimeout);
        });
      }

      function deactivate() {
        if (fundingNode) {
          if (messageInterval) {
            clearInterval(messageInterval);
          }

          return discoveryService.sendMessage(discoveryService.messages.outOfBusiness);
        }

        return $q.resolve();
      }

      function canEnable() {
        const d = $q.defer();

        function isLatestVersion() {
          const def = $q.defer();

          // todo funding node is stub
          def.resolve(true);

          return def.promise;
        }

        function hasBytes() {
          const def = $q.defer();

          if (assocBalances && assocBalances.base && parseInt(assocBalances.base.stable, 10) > 0) {
            def.resolve(true);
          } else {
            def.resolve(false);
          }

          return def.promise;
        }

        const isLatestVersionPromise = isLatestVersion();
        const hasBytesPromise = hasBytes();

        $q.all([isLatestVersionPromise, hasBytesPromise]).then((results) => {
          const successResults = results.filter(item => item);
          if (successResults.length !== results.length) {
            d.reject();
            return;
          }

          d.resolve();
        });

        return d.promise;
      }

      function update(val) {
        let func;

        if (val) {
          func = activate;
        } else {
          func = deactivate;
        }

        return func().then(() => {
          fundingNode = val;

          return updateConfig();
        });
      }

      function getSettings() {
        return angular.copy(settings);
      }

      function setSettings(newSettings) {
        return discoveryService.sendMessage(discoveryService.messages.updateSettings, { settings: newSettings }).then(() => {
          settings.exchangeFee = newSettings.exchangeFee;
          settings.totalBytes = newSettings.totalBytes;
          settings.bytesPerAddress = newSettings.bytesPerAddress;
          settings.maxEndUserCapacity = newSettings.maxEndUserCapacity;

          updateConfig();
        });
      }

      return self;
    });
}());
