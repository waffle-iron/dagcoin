

angular.module('copayApp.services').factory('confirmDialog', ($log, $timeout, gettextCatalog, isCordova) => {
  const root = {};


  const acceptMsg = gettextCatalog.getString('Accept');
  const cancelMsg = gettextCatalog.getString('Cancel');
  const confirmMsg = gettextCatalog.getString('Confirm');

  root.show = function (msg, cb) {
    if (isCordova) {
      navigator.notification.confirm(
        msg,
        (buttonIndex) => {
          if (buttonIndex == 1) {
            $timeout(() => cb(true), 1);
          } else {
            return cb(false);
          }
        },
        confirmMsg, [acceptMsg, cancelMsg]);
    } else {
      return cb(confirm(msg));
    }
  };

  return root;
});
