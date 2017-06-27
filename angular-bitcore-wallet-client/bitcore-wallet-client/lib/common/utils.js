

const _ = require('lodash');
const $ = require('preconditions').singleton();


const Constants = require('./constants');

function Utils() {}


Utils.formatAmount = function (bytes, unit, opts) {
  $.shouldBeNumber(bytes);
  $.checkArgument(_.includes(_.keys(Constants.UNITS), unit));

  function addSeparators(nStr, thousands, decimal, minDecimals) {
    nStr = nStr.replace('.', decimal);
    const x = nStr.split(decimal);
    let x0 = x[0];
    let x1 = x[1];

    x1 = _.dropRightWhile(x1, (n, i) => n === '0' && i >= minDecimals).join('');
    const x2 = x.length > 1 && parseInt(x[1]) ? decimal + x1 : '';

    // in safari, toLocaleString doesn't add thousands separators
    if (navigator && navigator.vendor && navigator.vendor.indexOf('Apple') >= 0) {
      x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return x0 + x2;
    }

    return parseFloat(x0 + x2).toLocaleString([], { maximumFractionDigits: 20 });
  }

  opts = opts || {};

  const u = Constants.UNITS[unit];
  const intAmountLength = Math.floor(bytes / u.value).toString().length;
  const digits = intAmountLength >= 6 ? 0 : 6 - intAmountLength;
  const amount = opts.dontRound ? (bytes / u.value).toString() : (bytes / u.value).toFixed(digits);
  return addSeparators(amount, opts.thousandsSeparator || ',', opts.decimalSeparator || '.', u.minDecimals);
};

module.exports = Utils;
