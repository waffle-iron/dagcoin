(() => {
  'use strict';

  /**
   * @desc displaying "DAG => USD" exchange rate
   * @example <dag-exchange-rate-view></dag-exchange-rate-view>
   */
  angular
    .module('copayApp.directives')
    .directive('dagExchangeRateView', dagExchangeRateView);

  dagExchangeRateView.$inject = ['exchangeRates'];

  function dagExchangeRateView(exchangeRates) {
    return {
      restrict: 'E',
      templateUrl: 'directives/dagExchangeRate/dagExchangeRate.template.html',
      replace: true,
      scope: {},
      link: ($scope) => {
        exchangeRates.dag().then((json) => {
          $scope.price_usd = json.price_usd;
          $scope.percent_change = json.percent_change_24h;
          $scope.last_updated = json.last_updated;
        });

        $scope.stateClass = (percentChange) => {
          if (percentChange) {
            return percentChange.toString().indexOf('-') >= 0 ? 'negative' : 'positive';
          }
          return 'negative';
        };
      }
    };
  }
})();
