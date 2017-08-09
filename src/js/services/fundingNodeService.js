/* eslint-disable import/no-dynamic-require */
(function () {
  'use strict';

  angular.module('copayApp.services')
      .factory('fundingNodeService', ($q, $rootScope, correspondentListService) => {
        const self = {};
        const device = require('byteballcore/device.js');

        let messageIntervalTimeout = 5 * 60 * 1000; // 5min
        let code = null;
        let fundingNode = false;

        let correspondent = null;
        let messageEvents = null;
        let messageInterval = null;
        let assocBalances = null;

        const messages = {
          startingTheBusiness: 'STARTING_THE_BUSINESS',
          aliveAndWell: 'ALIVE_AND_WELL',
          temporarilyUnavailable: 'TEMPORARILY_UNAVAILABLE',
          outOfBusiness: 'OUT_OF_BUSINESS',
          listTraders: 'LIST_TRADERS',
        };

        self.update = update;
        self.get = get;
        self.canEnable = canEnable;
        self.deactivate = deactivate;
        self.activate = activate;
        self.init = init;

        $rootScope.$on('Local/BalanceUpdated', (event, ab) => {
          assocBalances = ab;

          self.canEnable().then(
          () => { },
          () => {
            if (fundingNode) {
              self.update(false).then(
                () => { },
                (err) => {
                  console.log(err);
                }
              );
            }
          });
        });

        function init() {
          const conf = require('byteballcore/conf.js');

          messageIntervalTimeout = conf.fundingNodeMessageInterval || messageIntervalTimeout;
          code = conf.discoveryServiceCode || 'ApwhbsSyD7cF22UWxlZyH53y1vLpjsPk5gu4AW7AIdq0@byteball.org/bb-test#0000';

          return self.update(conf.fundingNode || false);
        }

        function requireUncached(module) {
          delete require.cache[require.resolve(module)];
          return require(module.toString());
        }

        function updateConfig(val) {
          const def = $q.defer();
          const fs = require('fs');
          const desktopApp = require('byteballcore/desktop_app.js');
          const appDataDir = desktopApp.getAppDataDir();
          const userConfFile = `${appDataDir}/conf.json`;
          const userConf = requireUncached(userConfFile);

          userConf.fundingNode = val;

          fs.writeFile(userConfFile, JSON.stringify(userConf, null, '\t'), 'utf8', (err) => {
            if (err) {
              def.reject(err);
            } else {
              def.resolve();
            }
          });

          return def.promise;
        }

        function setCorrespondent(cor) {
          correspondent = cor;
          messageEvents = correspondentListService.messageEventsByCorrespondent[cor.device_address];

          if (!messageEvents) {
            correspondentListService.messageEventsByCorrespondent[cor.device_address] = [];
            messageEvents = correspondentListService.messageEventsByCorrespondent[cor.device_address];
          }
        }

        function addDiscoveryService() {
          const defer = $q.defer();

          if (correspondent === null || correspondent === undefined) {
            const matches = code.match(/^([\w\/+]+)@([\w.:\/-]+)#([\w\/+-]+)$/);
            const pubkey = matches[1];
            const hub = matches[2];
            const pairingSecret = matches[3];

            device.addUnconfirmedCorrespondent(pubkey, hub, 'New', (deviceAddress) => {
              device.startWaitingForPairing((reversePairingInfo) => {
                device.sendPairingMessage(hub,
                  pubkey,
                  pairingSecret,
                  reversePairingInfo.pairing_secret,
                  {
                    ifOk: () => {
                    },
                    ifError: () => {
                    },
                  });
              });

              device.readCorrespondent(deviceAddress, (cor) => {
                setCorrespondent(cor);
                defer.resolve();
              });
            });
          } else {
            defer.resolve();
          }

          return defer.promise;
        }

        function sendMessageToDiscoveryService(message) {
          const def = $q.defer();

          device.sendMessageToDevice(correspondent.device_address, 'text', message, {
            ifOk() {
              def.resolve();
            },
            ifError(error) {
              def.reject(error);
            },
          });

          return def.promise;
        }

        function setFundnigNode(val) {
          const def = $q.defer();

          updateConfig(val).then(() => {
            fundingNode = val;

            def.resolve();
          }, (err) => {
            def.reject(err);
          });

          return def.promise;
        }

        function get() {
          return fundingNode;
        }

        function activate() {
          const def = $q.defer();

          if (fundingNode) {
            def.resolve();
          } else {
            sendMessageToDiscoveryService(messages.startingTheBusiness).then(() => {
              sendMessageToDiscoveryService(messages.aliveAndWell).then(() => {
                def.resolve();
              }, (err) => {
                def.reject(err);
              });

              messageInterval = setInterval(() => {
                sendMessageToDiscoveryService(messages.aliveAndWell).then(
                  () => { },
                  (err) => { console.log(err); }
                );
              }, messageIntervalTimeout);
            });
          }

          return def.promise;
        }

        function deactivate() {
          const def = $q.defer();

          if (fundingNode) {
            if (messageInterval) {
              clearInterval(messageInterval);
            }

            sendMessageToDiscoveryService(messages.outOfBusiness).then(() => {
              def.resolve();
            });
          } else {
            def.resolve();
          }

          return def.promise;
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
          const def = $q.defer();

          addDiscoveryService().then(() => {
            let func;

            if (val) {
              func = activate;
            } else {
              func = deactivate;
            }

            func().then(() => {
              setFundnigNode(val).then(() => {
                def.resolve();
              }, (err) => {
                def.reject(err);
              });
            });
          });

          return def.promise;
        }

        return self;
      });
}());
