(function () {
  'use strict';

  angular.module('copayApp.services').factory('txFormatService', (profileService, configService, lodash) => {
    const constants = require('byteballcore/constants.js');
    const root = {};
    const formatAmountStr = function (amount, asset) {
      if (!amount) {
        return;
      }
      if (asset !== 'base' && asset !== constants.DAGCOIN_ASSET) {
        return amount;
      }
      const assetName = asset !== 'base' ? 'dag' : 'base';
      return profileService.formatAmount(amount, assetName);
    };

    const formatFeeStr = function (fee) {
      if (!fee) {
        return;
      }
      return `${fee} bytes`;
    };

    root.processTx = function (tx) {
      if (!tx) {
        return '';
      }

      const outputs = tx.outputs ? tx.outputs.length : 0;
      if (outputs > 1 && tx.action !== 'received') {
        tx.hasMultiplesOutputs = true;
        tx.recipientCount = outputs;
        tx.amount = lodash.reduce(tx.outputs, (total, o) => {
          o.amountStr = formatAmountStr(o.amount, tx.asset);
          return total + o.amount;
        }, 0);
      }

      tx.amountStr = formatAmountStr(tx.amount, tx.asset);
      tx.feeStr = formatFeeStr(tx.fee || tx.fees);

      return tx;
    };

    return root;
  });
}());
