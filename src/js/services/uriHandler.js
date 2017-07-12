(function () {
  'use strict';

  const UriHandler = function () {
  };

  UriHandler.prototype.register = function () {
    const base = `${window.location.origin}/`;
    const url = `${base}#/uri-payment/%s`;

    if (navigator.registerProtocolHandler) {
      navigator.registerProtocolHandler('bitcoin', url, 'Copay');
    }
  };

  angular.module('copayApp.services').value('uriHandler', new UriHandler());
}());
