/* eslint-disable import/no-unresolved,import/no-extraneous-dependencies */
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
    } else {
      return false;
    }
  };


  root.isDefined = function () {
    return isNodeWebkit();
  };

  root.readFromClipboard = function () {
    if (!isNodeWebkit()) return;
    const gui = require('nw.gui');
    const clipboard = gui.Clipboard.get();
    clipboard.get();
  };

  root.writeToClipboard = function (text) {
    if (!isNodeWebkit()) return;
    const gui = require('nw.gui');
    const clipboard = gui.Clipboard.get();
    clipboard.set(text);
  };

  root.openExternalLink = function (url) {
    if (!isNodeWebkit()) return;
    const gui = require('nw.gui');
    gui.Shell.openExternal(url);
  };

  return root;
});
