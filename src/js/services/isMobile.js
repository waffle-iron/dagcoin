(function () {
  'use strict';

// Detect mobile devices
  const isMobile = {
    /**
     * @return {boolean}
     */
    Android() {
      return !!navigator.userAgent.match(/Android/i);
    },
    /**
     * @return {boolean}
     */
    BlackBerry() {
      return !!navigator.userAgent.match(/BlackBerry/i);
    },
    iOS() {
      return !!navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    /**
     * @return {boolean}
     */
    Opera() {
      return !!navigator.userAgent.match(/Opera Mini/i);
    },
    /**
     * @return {boolean}
     */
    Windows() {
      return !!navigator.userAgent.match(/IEMobile/i);
    },
    /**
     * @return {boolean}
     */
    Safari() {
      return Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
    },
    any() {
      return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
    },
  };


  angular.module('copayApp.services').value('isMobile', isMobile);
}());
