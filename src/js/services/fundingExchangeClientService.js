/* eslint-disable import/no-dynamic-require */
(function () {
  'use strict';

  angular.module('copayApp.services')
    .factory('fundingExchangeClientService', (discoveryService, configService, dagcoinProtocolService, promiseService, fileSystemService) => {
      const eventBus = require('byteballcore/event_bus.js');

      const self = {};

      function clearRequireCache(module) {
        if (typeof require.resolve === 'function') {
          delete require.cache[require.resolve(module)];
        }
      }

      function requireUncached(module) {
        clearRequireCache(module);
        return require(module.toString());
      }

      function getConfiguration() {
        return new Promise((resolve, reject) => {
          configService.get((err, config) => {
            if (err) {
              reject(err);
            }

            try {
              const userConfFile = fileSystemService.getUserConfFilePath();
              resolve(Object.assign({}, config, requireUncached(userConfFile)));
            } catch (e) {
              reject(e);
            }
          });
        });
      }

      function isFundingPairPresent() {
        return getConfiguration().then((config) => {
          let fundingPairAvailable = true;

          if (!config.bytesProviderDeviceAddress) {
            console.log('MISSING bytesProviderDeviceAddress IN THE CONFIGURATION');
            fundingPairAvailable = false;
          }

          if (!config.byteOrigin) {
            console.log('MISSING byteOrigin IN THE CONFIGURATION');
            fundingPairAvailable = false;
          }

          if (!config.dagcoinDestination) {
            console.log('MISSING dagcoinDestination IN THE CONFIGURATION');
            fundingPairAvailable = false;
          }

          return Promise.resolve(fundingPairAvailable);
        });
      }

      function askForFundingNode() {
        const promise = new Promise((resolve, reject) => {
          const listener = function (message, fromAddress) {
            if (!discoveryService.isDiscoveryServiceAddress(fromAddress)) {
              console.log(`RECEIVED A LIST OF TRADERS FROM AN ADDRESS THAT IS NOT MY DISCOVERY SERVICE: ${fromAddress}`);
              eventBus.once(`dagcoin.response.${discoveryService.messages.listTraders}`, listener);
              return;
            }

            console.log(`THE DISCOVERY SERVICE (${fromAddress}) SENT A MESSAGE: ${JSON.stringify(message)}`);

            const body = message.messageBody;

            if (!body) {
              reject(`DISCOVERY SERVICE (${fromAddress}) SENT A TRADERS LIST WITH NO BODY`);
            }

            const traders = body.traders;

            if (!traders) {
              reject(`DISCOVERY SERVICE (${fromAddress}) SENT A TRADERS LIST MESSAGE BODY WITH NO TRADERS' SECTION`);
            }

            if (traders.length === 0) {
              reject(`DISCOVERY SERVICE (${fromAddress}) HAS NO TRADERS AVAILABLE`);
            }

            traders.sort((a, b) => {
              if (a.exchangeFee > b.exchangeFee) {
                return 1;
              }
              return -1;
            });

            resolve(traders[0]);
          };

          eventBus.once(`dagcoin.response.${discoveryService.messages.listTraders}`, listener);
        });

        discoveryService.sendMessage(discoveryService.messages.listTraders);

        const timeoutInSeconds = 30;

        return promiseService.timedPromise(
          promise,
          timeoutInSeconds * 1000,
          `NO REPLY FROM THE DISCOVERY SERVICE AFTER ${timeoutInSeconds}s`
        );
      }

      function activate() {
        let appConfig = null;

        getConfiguration()
        .then((config) => {
          console.log(JSON.stringify(config));

          if (!config.canUseExternalBytesProvider) {
            return Promise.reject('NOT POSSIBLE TO ACTIVATE THE FUNDING EXCHANGE CLIENT. THE USER MUST FIRST AUTHORIZE IT.');
          }

          appConfig = config;

          return isFundingPairPresent();
        })
        .then((fundingPairAvailable) => {
          if (!fundingPairAvailable) {
            return askForFundingNode().then((result) => {
              console.log(`TRADERS AVAILABLE: ${result}`);
            });
          }

          return dagcoinProtocolService.pairAndConnectDevice(appConfig.bytesProviderDeviceAddress);
        })
        .catch((error) => {
          console.log(`COULD NOT ACTIVATE THE FUNDING EXCHANGE CLIENT: ${error}`);
        });
      }

      activate();

      self.activate = activate;

      return self;
    });
}());
