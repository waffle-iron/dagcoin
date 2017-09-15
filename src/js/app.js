/* eslint-disable no-unused-vars, no-undef */
const modules = [
  'ui.router',
  'angularMoment',
  'angular-carousel',
  'mm.foundation',
  'monospaced.qrcode',
  'monospaced.elastic',
  'gettext',
  'ngLodash',
  'uiSwitch',
  'bwcModule',
  'copayApp.filters',
  'copayApp.services',
  'copayApp.controllers',
  'copayApp.directives',
  'copayApp.addons',
  'ct.ui.router.extras',
  'ngRaven',
  'ngDialog',
  'ngAnimate',
  'swipe',
  'ksSwiper'
];

const copayApp = angular.module('copayApp', modules);
window.copayApp = angular.module('copayApp', modules);

angular.module('copayApp.filters', []);
angular.module('copayApp.services', []);
angular.module('copayApp.controllers', []);
angular.module('copayApp.directives', []);
angular.module('copayApp.addons', []);

const constants = require('byteballcore/constants.js');

// Assumes that in generated production package.json doesn't have env object
const isProduction = !constants.version.match(/t$/);

Raven
  .config('https://2b16cb28f5864d1db14e1db9cc2407ef@sentry.io/215634', {
    shouldSendCallback: () => isProduction,
    release: constants.version
  })
  .addPlugin(Raven.Plugins.Angular)
  .install();

if (!isProduction) {
  Raven.uninstall();
}
