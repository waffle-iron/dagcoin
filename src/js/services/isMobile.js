

// Detect mobile devices
var isMobile = {
  Android() {
    return !!navigator.userAgent.match(/Android/i);
  },
  BlackBerry() {
    return !!navigator.userAgent.match(/BlackBerry/i);
  },
  iOS() {
    return !!navigator.userAgent.match(/iPhone|iPad|iPod/i);
  },
  Opera() {
    return !!navigator.userAgent.match(/Opera Mini/i);
  },
  Windows() {
    return !!navigator.userAgent.match(/IEMobile/i);
  },
  Safari() {
    return Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
  },
  any() {
    return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
  },
};


angular.module('copayApp.services').value('isMobile', isMobile);
