(function () {
  'use strict';

  angular.module('copayApp.services').service('addonManager', function (lodash) {
    const addons = [];

    this.registerAddon = function (addonSpec) {
      addons.push(addonSpec);
    };

    this.addonMenuItems = function () {
      return lodash.map(addons, addonSpec => addonSpec.menuItem);
    };

    this.addonViews = function () {
      return lodash.map(addons, addonSpec => addonSpec.view);
    };

    this.formatPendingTxp = function (txp) {
      lodash.each(addons, (addon) => {
        if (addon.formatPendingTxp) {
          addon.formatPendingTxp(txp);
        }
      });
    };

    this.txTemplateUrl = function () {
      const addon = lodash.find(addons, 'txTemplateUrl');
      return addon ? addon.txTemplateUrl() : null;
    };
  });
}());
