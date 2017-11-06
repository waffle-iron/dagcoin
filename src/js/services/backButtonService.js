(function () {
  'use strict';

  angular.module('copayApp.services').factory('backButton', ($log, $rootScope, gettextCatalog, $deepStateRedirect, $document, $timeout, go, lodash, $state) => {
    const root = {};

    root.menuOpened = false;
    root.dontDeletePath = false;

    let arrHistory = [];
    const body = $document.find('body').eq(0);
    let shownExitMessage = false;

    $rootScope.$on('$stateChangeSuccess', (event, to, toParams, from, fromParams) => {
      const lastState = arrHistory.length ? arrHistory[arrHistory.length - 1] : null;
      if (from.name === '' || (lastState && !(to.name === lastState.to && lodash.isEqual(toParams, lastState.toParams)))) {
        arrHistory.push({ to: to.name, toParams, from: from.name, fromParams });
      }
      if (to.name === 'walletHome') {
        $rootScope.$emit('Local/SetTab', 'walletHome', true);
      }
      root.menuOpened = false;
    });

    function back() {
      if (body.hasClass('modal-open')) {
        $rootScope.$emit('closeModal');
      } else if (root.menuOpened) {
        go.swipe();
        root.menuOpened = false;
      } else {
        const currentState = arrHistory.pop();
        if (!currentState || currentState.from === '') {
          arrHistory.push(currentState);
          askAndExit();
        } else {
          const parentState = $state.get('^');
          if (parentState.name) { // go up on state tree
            $deepStateRedirect.reset(parentState.name);
            $state.go(parentState);
          } else { // go back across history
            const targetState = $state.get(currentState.from);
            if (targetState.modal || (currentState.to === 'walletHome' && $rootScope.tab === 'walletHome')) { // don't go to modal and don't go to anywhere wfom home screen
              arrHistory.push(currentState);
              askAndExit();
            } else if (currentState.from.indexOf(currentState.to) !== -1) { // prev state is a child of current one
              go.walletHome();
            } else {
              $state.go(currentState.from, currentState.fromParams);
            }
          }
        }
      }
    }

    function askAndExit() {
      if (shownExitMessage) {
        navigator.app.exitApp();
      } else {
        shownExitMessage = true;
        window.plugins.toast.showShortBottom(gettextCatalog.getString('Press again to exit'));
        $timeout(() => {
          shownExitMessage = false;
        }, 2000);
      }
    }

    function clearHistory() {
      arrHistory = [];
    }

    document.addEventListener('backbutton', () => {
      back();
    }, false);

    root.back = back;
    root.arrHistory = arrHistory;
    root.clearHistory = clearHistory;
    return root;
  });
}());
