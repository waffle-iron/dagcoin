

angular.module('copayApp.services').factory('nodeWebkit', () => {
  const root = {};

  const isNodeWebkit = function () {
    const isNode = (typeof process !== 'undefined' && typeof require !== 'undefined');
    if (isNode) {
      try {
        return (typeof require('nw.gui') !== 'undefined');
      } catch (e) {
        return false;
      }
    }
  };


  root.isDefined = function () {
    return isNodeWebkit();
  };

  root.readFromClipboard = function () {
    if (!isNodeWebkit()) return;
    const gui = require('nw.gui');
    const clipboard = gui.Clipboard.get();
    return clipboard.get();
  };

  root.writeToClipboard = function (text) {
    if (!isNodeWebkit()) return;
    const gui = require('nw.gui');
    const clipboard = gui.Clipboard.get();
    return clipboard.set(text);
  };

  root.openExternalLink = function (url) {
    if (!isNodeWebkit()) return;
    const gui = require('nw.gui');
    return gui.Shell.openExternal(url);
  };

  return root;
});
