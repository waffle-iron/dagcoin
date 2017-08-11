/* eslint-disable import/no-extraneous-dependencies,import/no-unresolved */
(function () {
  'use strict';

  let unsupported;
  let isaosp;

  if (window && window.navigator) {
    const rxaosp = window.navigator.userAgent.match(/Android.*AppleWebKit\/([\d.]+)/);
    isaosp = (rxaosp && rxaosp[1] < 537);
    if (!window.cordova && isaosp) {
      unsupported = true;
    }
    if (unsupported) {
      window.location = '#/unsupported';
    }
  }


// Setting up route
  angular
  .module('copayApp')
  .config((historicLogProvider, $provide, $logProvider, $stateProvider, $urlRouterProvider, $compileProvider) => {
    $urlRouterProvider.otherwise('/');

    $logProvider.debugEnabled(true);
    $provide.decorator('$log', ['$delegate',
      function ($delegate) {
        const historicLog = historicLogProvider.$get();

        ['debug', 'info', 'warn', 'error', 'log'].forEach((level) => {
          const orig = $delegate[level];
          $delegate[level] = function (...argz) {
            if (level === 'error') {
              console.log(argz);
            }

            let args = [].slice.call(argz);
            if (!Array.isArray(args)) args = [args];
            args = args.map((v) => {
              let value = v;
              try {
                if (typeof value === 'undefined') {
                  value = 'undefined';
                }
                if (!value) {
                  value = 'null';
                }
                if (typeof value === 'object') {
                  if (value.message) {
                    value = value.message;
                  } else {
                    value = JSON.stringify(value);
                  }
                }
                // Trim output in mobile
                if (window.cordova) {
                  value = value.toString();
                  if (value.length > 1000) {
                    value = `${value.substr(0, 997)}...`;
                  }
                }
              } catch (e) {
                console.log('Error at log decorator:', e);
                value = 'undefined';
              }
              return value;
            });
            try {
              if (window.cordova) {
                console.log(args.join(' '));
              }
              historicLog.add(level, args.join(' '));
              orig(...args);
            } catch (e) {
              console.log('ERROR (at log decorator):', e, args[0]);
            }
          };
        });
        return $delegate;
      },
    ]);

    // whitelist 'chrome-extension:' for chromeApp to work with image URLs processed by Angular
    // link: http://stackoverflow.com/questions/15606751/angular-changes-urls-to-unsafe-in-extension-page?lq=1
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*((https?|ftp|file|blob|chrome-extension):|data:image\/)/);

    $stateProvider
    .state('splash', {
      url: '/splash',
      needProfile: false,
      views: {
        main: {
          templateUrl: 'views/splash.html',
        },
      },
    });

    $stateProvider
    .state('translators', {
      url: '/translators',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/translators.html',
        },
      },
    })
    .state('disclaimer', {
      url: '/disclaimer',
      needProfile: false,
      views: {
        main: {
          templateUrl: 'views/disclaimer.html',
        },
      },
    })
    .state('walletHome', {
      url: '/',
      walletShouldBeComplete: true,
      needProfile: true,
      deepStateRedirect: true,
      sticky: true,
      views: {
        main: {
          templateUrl: 'views/walletHome.html',
        },
      },
    })
    .state('unsupported', {
      url: '/unsupported',
      needProfile: false,
      views: {
        main: {
          templateUrl: 'views/unsupported.html',
        },
      },
    })
    .state('payment', {
      url: '/uri-payment/:data',
      templateUrl: 'views/paymentUri.html',
      views: {
        main: {
          templateUrl: 'views/paymentUri.html',
        },
      },
      needProfile: true,
    })
    .state('selectWalletForPayment', {
      url: '/selectWalletForPayment',
      controller: 'walletForPaymentController',
      needProfile: true,
    })
    .state('import', {
      url: '/import',
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/import.html',
        },
      },
    })
    .state('importProfile', {
      url: '/importProfile',
      templateUrl: 'views/importProfile.html',
      needProfile: false,
    })
    .state('importLegacy', {
      url: '/importLegacy',
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/importLegacy.html',
        },
      },

    })
    .state('create', {
      url: '/create',
      templateUrl: 'views/create.html',
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/create.html',
        },
      },
    })
    .state('copayers', {
      url: '/copayers',
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/copayers.html',
        },
      },
    })
    .state('preferences', {
      url: '/preferences',
      templateUrl: 'views/preferences.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferences.html',
        },
      },
    })
    .state('correspondentDevices', {
      url: '/correspondentDevices',
      walletShouldBeComplete: false,
      needProfile: true,
      deepStateRedirect: true,
      sticky: true,
      views: {
        chat: {
          templateUrl: 'views/correspondentDevices.html',
        },
      },
    })
    .state('correspondentDevices.correspondentDevice', {
      url: '/correspondentDevice',
      walletShouldBeComplete: false,
      needProfile: true,
      views: {
        dialog: {
          templateUrl: 'views/correspondentDevice.html',
        },
      },
    })
    .state('correspondentDevices.editCorrespondentDevice', {
      url: '/editCorrespondentDevice',
      walletShouldBeComplete: false,
      needProfile: true,
      views: {
        dialog: {
          templateUrl: 'views/editCorrespondentDevice.html',
        },
      },
    })
    .state('correspondentDevices.addCorrespondentDevice', {
      url: '/addCorrespondentDevice',
      needProfile: true,
      views: {
        dialog: {
          templateUrl: 'views/addCorrespondentDevice.html',
        },
      },
    })
    .state('correspondentDevices.inviteCorrespondentDevice', {
      url: '/inviteCorrespondentDevice',
      walletShouldBeComplete: false,
      needProfile: true,
      views: {
        dialog: {
          templateUrl: 'views/inviteCorrespondentDevice.html',
        },
      },
    })
    .state('correspondentDevices.acceptCorrespondentInvitation', {
      url: '/acceptCorrespondentInvitation',
      walletShouldBeComplete: false,
      needProfile: true,
      views: {
        dialog: {
          templateUrl: 'views/acceptCorrespondentInvitation.html',
        },
      },
    })
    .state('authConfirmation', {
      url: '/authConfirmation',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/authConfirmation.html',
        },
      },
    })
    .state('preferencesDeviceName', {
      url: '/preferencesDeviceName',
      walletShouldBeComplete: false,
      needProfile: false,
      views: {
        main: {
          templateUrl: 'views/preferencesDeviceName.html',
        },
      },
    })
    .state('preferencesLanguage', {
      url: '/preferencesLanguage',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesLanguage.html',
        },
      },
    })


    .state('preferencesAdvanced', {
      url: '/preferencesAdvanced',
      templateUrl: 'views/preferencesAdvanced.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesAdvanced.html',
        },
      },
    })
    .state('preferencesDeleteWallet', {
      url: '/delete',
      templateUrl: 'views/preferencesDeleteWallet.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        'main@': {
          templateUrl: 'views/preferencesDeleteWallet.html'
        },
      }
    })
    .state('preferencesColor', {
      url: '/preferencesColor',
      templateUrl: 'views/preferencesColor.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesColor.html',
        },
      },
    })

    .state('preferencesAlias', {
      url: '/preferencesAlias',
      templateUrl: 'views/preferencesAlias.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesAlias.html',
        },

      },
    })
    .state('preferencesEmail', {
      url: '/preferencesEmail',
      templateUrl: 'views/preferencesEmail.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesEmail.html',
        },

      },
    })
    .state('information', {
      url: '/information',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesInformation.html',
        },
      },
    })

    .state('about', {
      url: '/about',
      templateUrl: 'views/preferencesAbout.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesAbout.html',
        },
      },
    })
    .state('logs', {
      url: '/logs',
      templateUrl: 'views/preferencesLogs.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesLogs.html',
        },
      },
    })
    .state('export', {
      url: '/export',
      templateUrl: 'views/export.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/export.html',
        },
      },
    })
    .state('paperWallet', {
      url: '/paperWallet',
      templateUrl: 'views/paperWallet.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/paperWallet.html',
        },
      },
    })
    .state('backup', {
      url: '/backup',
      templateUrl: 'views/backup.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/backup.html',
        },
      },
    })
    .state('recoveryFromSeed', {
      url: '/recoveryFromSeed',
      templateUrl: 'views/recoveryFromSeed.html',
      walletShouldBeComplete: true,
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/recoveryFromSeed.html',
        },
      },
    })
    .state('preferencesGlobal', {
      url: '/preferencesGlobal',
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/preferencesGlobal.html',
        },
      },
    })
    .state('settings', {
      url: '/settings',
      controller: 'settingsController',
      templateUrl: 'views/settings.html',
      needProfile: false,
    })
    .state('warning', {
      url: '/warning',
      controller: 'warningController',
      templateUrl: 'views/warning.html',
      needProfile: false,
    })

    .state('add', {
      url: '/add',
      needProfile: true,
      views: {
        main: {
          templateUrl: 'views/add.html',
        },
      },
    })
    .state('cordova', { // never used
      url: '/cordova/:status/:isHome',
      views: {
        main: {
          controller($rootScope, $state, $stateParams, $timeout, go, isCordova) {
            console.log(`cordova status: ${$stateParams.status}`);
            switch ($stateParams.status) {
              case 'resume':
                $rootScope.$emit('Local/Resume');
                break;
              case 'backbutton':
                if (isCordova && $stateParams.isHome === 'true' && !$rootScope.modalOpened) {
                  navigator.app.exitApp();
                } else {
                  $rootScope.$emit('closeModal');
                }
                break;
              default:
                // Error handler should be here
            }
            // why should we go home on resume or backbutton?
            /*
             $timeout(function() {
             $rootScope.$emit('Local/SetTab', 'walletHome', true);
             }, 100);
             go.walletHome();
             */
          },
        },
      },
      needProfile: false,
    });
  })
  .run(($rootScope, $state, $log, uriHandler, isCordova, profileService, $timeout, nodeWebkit, uxLanguage, animationService) => {
    FastClick.attach(document.body);

    uxLanguage.init();

    // Register URI handler, not for mobileApp
    if (!isCordova) {
      uriHandler.register();
    }

    if (nodeWebkit.isDefined()) {
      const gui = require('nw.gui');
      const win = gui.Window.get();
      win.setResizable(false);
      const nativeMenuBar = new gui.Menu({
        type: 'menubar',
      });
      try {
        nativeMenuBar.createMacBuiltin('DAGCOIN');
      } catch (e) {
        $log.debug('This is not OSX');
      }
      win.menu = nativeMenuBar;
    }

    $rootScope.$on('$stateChangeStart', (event, toState, toParams, fromState) => {
      if (!profileService.profile && toState.needProfile) {
        // Give us time to open / create the profile
        event.preventDefault();

        // Try to open local profile
        profileService.loadAndBindProfile((err) => {
          if (err) {
            if (err.message && err.message.match('NOPROFILE')) {
              $log.debug('No profile... redirecting');
              $state.transitionTo('splash');
            } else if (err.message && err.message.match('NONAGREEDDISCLAIMER')) {
              $log.debug('Display disclaimer... redirecting');
              $state.transitionTo('disclaimer');
            } else {
              throw new Error(err); // TODO
            }
          } else {
            $log.debug('Profile loaded ... Starting UX.');
            $state.transitionTo(toState.name || toState, toParams);
          }
        });
      }

      if (
        profileService.focusedClient &&
        !profileService.focusedClient.isComplete() &&
        toState.walletShouldBeComplete
      ) {
        $state.transitionTo('copayers');
        event.preventDefault();
      }

      if (!animationService.transitionAnimated(fromState, toState)) {
        event.preventDefault();
        // Time for the backpane to render
        setTimeout(() => {
          $state.transitionTo(toState);
        }, 50);
      }
    });
  });
}());
