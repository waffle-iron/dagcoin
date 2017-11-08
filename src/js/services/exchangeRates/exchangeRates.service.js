/* global angular */

(() => {
  'use strict';

  const request = require('request');

  angular
    .module('copayApp.services')
    .factory('exchangeRates', exchangeRates);

  exchangeRates.$inject = ['$http', '$q'];
  function exchangeRates($http, $q) {
    let ratesToUsd = false;

    const service = {
      dag,
      list
    };

    return service;

    function dag() {
      return $q((resolve, reject) => {
        request('https://api.coinmarketcap.com/v1/ticker/byteball/', (error, response, body) => {
          if (!error && response.statusCode === 200) {
            const json = JSON.parse(body);
            return resolve(json[0]);
          }
          return reject({});
        });
      });
    }

    function list() {
      return $q((resolve, reject) => {
        if (!ratesToUsd) {
          request('http://api.fixer.io/latest?base=USD', (error, response, body) => {
            if (!error && response.statusCode === 200) {
              const json = JSON.parse(body);

              if (json.constructor === Array) {
                ratesToUsd = json[0].rates;
              } else {
                ratesToUsd = json.rates;
              }

              return resolve(ratesToUsd);
            }
            return reject({});
          });
        } else {
          return resolve(ratesToUsd);
        }
      });
    }
  }
})();
