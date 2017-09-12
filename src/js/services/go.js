/* eslint-disable import/no-extraneous-dependencies,import/no-unresolved */
(function () {
  'use strinct';

  const eventBus = require('byteballcore/event_bus.js');
  angular.module('copayApp.services')
  .factory('go',
    ($window,
     $rootScope,
     $location,
     $state,
     profileService,
     nodeWebkit,
     notification,
     gettextCatalog,
     authService,
     $deepStateRedirect,
     $stickyState) => {
      const root = {};
      let removeListener;
      const hideSidebars = function () {
        if (typeof document === 'undefined') {
          return;
        }
        const elem = document.getElementById('off-canvas-wrap');
        elem.className = 'off-canvas-wrap';
      };

      const toggleSidebar = function (invert) {
        if (typeof document === 'undefined') {
          return;
        }

        const elem = document.getElementById('off-canvas-wrap');
        const leftbarActive = elem.className.indexOf('move-right') >= 0;

        if (invert) {
          if (profileService.profile && !$rootScope.hideNavigation) {
            elem.className = 'off-canvas-wrap move-right';
          }
        } else if (leftbarActive) {
          hideSidebars();
        }
      };

      root.openExternalLink = function (url, target) {
        if (nodeWebkit.isDefined()) {
          nodeWebkit.openExternalLink(url);
        } else {
          const targetElement = target || '_blank';
          window.open(url, targetElement, 'location=no');
        }
      };

      root.path = function (path, cb) {
        $state.transitionTo(path)
        .then(() => {
          console.log(`transition done ${path}`);
          if (cb) {
            return cb();
          }
        }, () => {
          console.log(`transition failed ${path}`);
          if (cb) {
            return cb('animation in progress');
          }
        });
        hideSidebars();
      };

      root.swipe = function (invert) {
        toggleSidebar(invert);
      };

      root.walletHome = function () {
        const fc = profileService.focusedClient;
        if (fc && !fc.isComplete()) {
          root.path('copayers');
        } else {
          root.path('walletHome', () => {
            $rootScope.$emit('Local/SetTab', 'walletHome', true);
          });
        }
      };

      root.send = function (cb) {
        $stickyState.reset('walletHome');
        root.path('walletHome', () => {
          $rootScope.$emit('Local/SetTab', 'send');
          if (cb) {
            cb();
          }
        });
      };

      root.history = function (cb) {
        root.path('walletHome', () => {
          $rootScope.$emit('Local/SetTab', 'history');
          if (cb) {
            cb();
          }
        });
      };

      root.addWallet = function () {
        $state.go('add');
      };

      root.preferences = function () {
        $state.go('preferences');
      };

      root.preferencesGlobal = function () {
        $state.go('preferencesGlobal');
      };

      root.reload = function () {
        $state.reload();
      };

      // Global go. This should be in a better place TODO
      // We dont do a 'go' directive, to use the benefits of ng-touch with ng-click
      $rootScope.go = function (path, resetState) {
        if (resetState) $deepStateRedirect.reset(resetState);
        root.path(path);
      };

      $rootScope.openExternalLink = function (url, target) {
        root.openExternalLink(url, target);
      };

      function handleUri(uri) {
        const conf = require('byteballcore/conf.js');
        this.protocol = conf.program_version.match(/t$/) ? 'byteball-tn' : 'byteball';
        const tmpUri = uri.replace(`${this.protocol}`, conf.program);
        console.log(`handleUri ${tmpUri}`);
        require('byteballcore/uri.js').parseUri(tmpUri, {
          ifError(err) {
            console.log(err);
            notification.error(err);
            // notification.success(gettextCatalog.getString('Success'), err);
          },
          ifOk(objRequest) {
            console.log(`request: ${JSON.stringify(objRequest)}`);
            if (objRequest.type === 'address') {
              root.send(() => {
                $rootScope.$emit('paymentRequest', objRequest.address, objRequest.amount, objRequest.asset);
              });
            } else if (objRequest.type === 'pairing') {
              $rootScope.$emit('Local/CorrespondentInvitation', objRequest.pubkey, objRequest.hub, objRequest.pairing_secret);
            } else if (objRequest.type === 'auth') {
              authService.objRequest = objRequest;
              root.path('authConfirmation');
            } else {
              throw Error(`unknown url type: ${objRequest.type}`);
            }
          },
        });
      }

      function extractByteballArgFromCommandLine(commandLine) {
        const conf = require('byteballcore/conf.js');
        const re = new RegExp(`^${conf.program}:`, 'i');
        const arrParts = commandLine.split(' '); // on windows includes exe and all args, on mac just our arg
        for (let i = 0; i < arrParts.length; i += 1) {
          const part = arrParts[i].trim();
          if (part.match(re)) {
            return part;
          }
        }
        return null;
      }

      function registerWindowsProtocolHandler() {
        // now we do it in inno setup
      }

      function createLinuxDesktopFile() {
        console.log('will write .desktop file');
        const fs = require('fs');
        const path = require('path');
        const childProcess = require('child_process');
        const pack = require('../package.json'); // relative to html root
        const applicationsDir = `${process.env.HOME}/.local/share/applications`;
        fs.mkdir(applicationsDir, 0o700, (err) => {
          console.log(`mkdir applications: ${err}`);
          fs.writeFile(`${applicationsDir}/${pack.name}.desktop`, `[Desktop Entry]\n\
            Type=Application\n\
            Version=1.0\n\
            Name=${pack.name}\n\
            Comment=${pack.description}\n\
            Exec=${process.execPath.replace(/ /g, '\\ ')} %u\n\
            Icon=${path.dirname(process.execPath)}/public/img/icons/icon-white-outline.iconset/icon_256x256.png\n\
            Terminal=false\n\
            Categories=Office;Finance;\n\
            MimeType=x-scheme-handler/${pack.name};\n\
            X-Ubuntu-Touch=true\n\
            X-Ubuntu-StageHint=SideStage\n`, { mode: '0755' }, (error) => {
              if (error) {
                throw Error(`failed to write desktop file: ${error}`);
              }
              childProcess.exec('update-desktop-database ~/.local/share/applications', (childProcessError) => {
                if (childProcessError) {
                  throw Error(`failed to exec update-desktop-database: ${childProcessError}`);
                }
                console.log('.desktop done');
              });
            });
        });
      }

      let gui;
      try {
        gui = require('nw.gui');
      } catch (e) {
        // continue regardless of error
      }

      if (gui) { // nwjs
        const removeListenerForOnopen = $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', () => {
          removeListenerForOnopen();
          gui.App.on('open', (commandLine) => {
            console.log(`Open url: ${commandLine}`);
            if (commandLine) {
              const file = extractByteballArgFromCommandLine(commandLine);
              if (!file) {
                return console.log('no byteball: arg found');
              }
              handleUri(file);
              gui.Window.get().focus();
            }
          });
        });
        console.log(`argv: ${gui.App.argv}`);
        if (gui.App.argv[0]) {
          // wait till the wallet fully loads
          removeListener = $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', () => {
            setTimeout(() => {
              handleUri(gui.App.argv[0]);
            }, 100);
            removeListener();
          });
        }
        if (process.platform === 'win32' || process.platform === 'linux') {
          // wait till the wallet fully loads
          const removeRegListener = $rootScope.$on('Local/BalanceUpdated', () => {
            setTimeout(() => {
              if (process.platform === 'win32') {
                registerWindowsProtocolHandler();
              } else {
                createLinuxDesktopFile();
              }
              gui.desktop = `${process.env.HOME}/.local/share/applications`;
            }, 200);
            removeRegListener();
          });
        }
        /* var win = gui.Window.get();
         win.on('close', function(){
         console.log('close event');
         var db = require('byteballcore/db.js');
         db.close(function(err){
         console.log('close err: '+err);
         });
         this.close(true);
         }); */
      } else if (window.cordova) {
        // console.log("go service: setting temp handleOpenURL");
        // window.handleOpenURL = tempHandleUri;
        // wait till the wallet fully loads
        removeListener = $rootScope.$on('Local/BalanceUpdatedAndWalletUnlocked', () => {
          console.log('setting permanent handleOpenURL');
          window.handleOpenURL = handleUri;
          if (window.open_url) { // use cached url at startup
            console.log(`using cached open url ${window.open_url}`);
            setTimeout(() => {
              handleUri(window.open_url);
            }, 100);
          }
          removeListener();
        });
        /*
         document.addEventListener('backbutton', function() {
         console.log('doc backbutton');
         if (root.onBackButton)
         root.onBackButton();
         }); */
        document.addEventListener('resume', () => {
          console.log('resume');
          $rootScope.$emit('Local/Resume');
        }, false);
      }

      root.handleUri = handleUri;

      return root;
    }).factory('$exceptionHandler', ($log) => {
      return (exception, cause) => {
        console.log('angular $exceptionHandler');
        $log.error(exception, cause);
        eventBus.emit('uncaught_error', `An e xception occurred: ${exception}; cause: ${cause}`, exception);
      };
    });

  function tempHandleUri(url) {
    console.log(`saving open url ${url}`);
    window.open_url = url;
  }

  console.log('parsing go.js');
  if (window.cordova) {
    // this is temporary, before angular starts
    console.log('go file: setting temp handleOpenURL');
    window.handleOpenURL = tempHandleUri;
  }

  process.on('uncaughtException', (e) => {
    eventBus.emit('uncaught_error', `Uncaught exception: ${e}`, e);
  });
}());
