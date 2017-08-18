(function () {
  'use strict';

  angular.module('copayApp.filters', [])
  .filter('amTimeAgo', ['amMoment',
    function (amMoment) {
      return function (input) {
        return amMoment.preprocessDate(input).fromNow();
      };
    },
  ])
  .filter('paged', () => function (elements) {
    if (elements) {
      return elements.filter(Boolean);
    }

    return false;
  })
  .filter('removeEmpty', () => function (elements) {
    const elem = elements || [];
    // Hide empty change addresses from other copayers
    return elem.filter(e => !e.isChange || e.balance > 0);
  })

  .filter('noFractionNumber', ['$filter', '$locale', 'configService',
    function (filter, locale, configService) {
      const numberFilter = filter('number');
      const formats = locale.NUMBER_FORMATS;
      const config = configService.getSync().wallet.settings;
      return function (amount, n) {
        if (typeof (n) === 'undefined' && !config) return amount;

        const fractionSize = (typeof (n) !== 'undefined') ?
          n : config.unitValue.toString().length - 1;
        let value = numberFilter(amount, fractionSize);
        const sep = value.indexOf(formats.DECIMAL_SEP);
        const group = value.indexOf(formats.GROUP_SEP);
        if (amount >= 0) {
          if (group > 0) {
            if (sep < 0) {
              return value;
            }
            const intValue = value.substring(0, sep);
            let floatValue = parseFloat(value.substring(sep));
            if (floatValue === 0) {
              floatValue = '';
            } else {
              if (floatValue % 1 === 0) {
                floatValue = floatValue.toFixed(0);
              }
              floatValue = floatValue.toString().substring(1);
            }
            return intValue + floatValue;
          }
          value = parseFloat(value);
          if (value % 1 === 0) {
            value = value.toFixed(0);
          }
          return value;
        }
        return 0;
      };
    },
  ]);
}());
