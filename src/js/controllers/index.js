/* eslint-disable no-unused-vars,no-mixed-operators,no-use-before-define,new-cap,no-nested-ternary,no-shadow,no-plusplus,consistent-return,import/no-extraneous-dependencies,import/no-unresolved */
(function () {
  'use strict';

  angular.module('copayApp.controllers')
  .controller('indexController',
    function (
      $rootScope,
      $scope,
      $log,
      $filter,
      $timeout,
      $interval,
      lodash,
      go,
      profileService,
      configService,
      isCordova,
      storageService,
      addressService,
      gettext,
      gettextCatalog,
      amMoment,
      nodeWebkit,
      addonManager,
      txFormatService,
      uxLanguage,
      $state, isMobile,
      addressbookService,
      notification,
      animationService,
      fundingNodeService,
      $modal,
      bwcService,
      backButton,
      chooseFeeTypeService,
      autoRefreshClientService) {
      const async = require('async');
      const constants = require('byteballcore/constants.js');
      const mutex = require('byteballcore/mutex.js');
      const eventBus = require('byteballcore/event_bus.js');
      const objectHash = require('byteballcore/object_hash.js');
      const ecdsaSig = require('byteballcore/signature.js');
      const breadcrumbs = require('byteballcore/breadcrumbs.js');
      const Bitcore = require('bitcore-lib');
      const _ = require('lodash');
      // const EventEmitter = require('events').EventEmitter;
      breadcrumbs.add('index.js');
      const self = this;
      const isTestnet = constants.version.match(/t$/);
      self.DAGCOIN_ASSET = isTestnet ? 'B9dw3C3gMC+AODL/XqWjFh9jFe31jS08yf2C3zl8XGg=' : 'j5brqzPhQ0H2VNYi3i59PmlV15p54yAiSzacrQ2KqQQ=';
      self.isCordova = isCordova;
      self.isSafari = isMobile.Safari();
      self.onGoingProcess = {};
      self.historyShowLimit = 10;
      self.updatingTxHistory = true;
      self.bSwipeSuspended = false;
      self.$state = $state;
      self.usePushNotifications = isCordova && !isMobile.Windows() && isMobile.Android();
      /*
       console.log("process", process.env);
       var os = require('os');
       console.log("os", os);
       //console.log("os homedir="+os.homedir());
       console.log("release="+os.release());
       console.log("hostname="+os.hostname());
       //console.log(os.userInfo());
       */

      function updatePublicKeyRing(walletClient, onDone) {
        const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
        walletDefinedByKeys.readCosigners(walletClient.credentials.walletId, (arrCosigners) => {
          const arrApprovedDevices = arrCosigners
          .filter(cosigner => cosigner.approval_date)
          .map(cosigner => cosigner.device_address);
          console.log(`approved devices: ${arrApprovedDevices.join(', ')}`);
          walletClient.credentials.addPublicKeyRing(arrApprovedDevices);

          // save it to profile
          const credentialsIndex = lodash.findIndex(profileService.profile.credentials, { walletId: walletClient.credentials.walletId });
          if (credentialsIndex < 0) {
            throw Error('failed to find our credentials in profile');
          }
          profileService.profile.credentials[credentialsIndex] = JSON.parse(walletClient.export());
          console.log(`saving profile: ${JSON.stringify(profileService.profile)}`);
          storageService.storeProfile(profileService.profile, () => {
            if (onDone) {
              onDone();
            }
          });
        });
      }

      function sendBugReport(errorMessage, errorObject) {
        const conf = require('byteballcore/conf.js');
        const network = require('byteballcore/network.js');
        const bugSinkUrl = conf.WS_PROTOCOL + (conf.bug_sink_url || configService.getSync().hub);
        network.findOutboundPeerOrConnect(bugSinkUrl, (err, ws) => {
          if (err) {
            return;
          }
          breadcrumbs.add('bugreport');
          let description = errorObject.stack || JSON.stringify(errorObject, null, '\t');
          if (errorObject.bIgnore) {
            description += '\n(ignored)';
          }
          description += `\n\nBreadcrumbs:\n${breadcrumbs.get().join('\n')}\n\n`;
          description += `UA: ${navigator.userAgent}\n`;
          description += `Program: ${conf.program} ${conf.program_version}\n`;
          network.sendJustsaying(ws, 'bugreport', { message: errorMessage, exception: description });
        });
      }

      self.sendBugReport = sendBugReport;

      if (isCordova && constants.version === '1.0') {
        const db = require('byteballcore/db.js');
        db.query('SELECT 1 FROM units WHERE version!=? LIMIT 1', [constants.version], (rows) => {
          if (rows.length > 0) {
            self.showErrorPopup('Looks like you have testnet data.  Please remove the app and reinstall.', () => {
              if (navigator && navigator.app) {
                // android
                navigator.app.exitApp();
              }
              // ios doesn't exit
            });
          }
        });
      }

      eventBus.on('nonfatal_error', (errorMessage, errorObject) => {
        console.log('nonfatal error stack', errorObject.stack);
        errorObject.bIgnore = true;
        sendBugReport(errorMessage, errorObject);
      });

      eventBus.on('uncaught_error', (errorMessage, errorObject) => {
        if (errorMessage.indexOf('ECONNREFUSED') >= 0 || errorMessage.indexOf('host is unreachable') >= 0) {
          $rootScope.$emit('Local/ShowAlert', 'Error connecting to TOR', 'fi-alert', () => {
            go.path('preferencesTor');
          });
          return;
        }
        if (errorMessage.indexOf('ttl expired') >= 0 || errorMessage.indexOf('general SOCKS server failure') >= 0) {
          // TOR error after wakeup from sleep
          return;
        }
        console.log('stack', errorObject.stack);
        sendBugReport(errorMessage, errorObject);
        if (errorObject && errorObject.bIgnore) {
          return;
        }
        self.showErrorPopup(errorMessage, () => {
          if (self.isCordova && navigator && navigator.app) {
            // android
            navigator.app.exitApp();
          } else if (process.exit) {
            // nwjs
            process.exit();
          }
          // ios doesn't exit
        });
      });

      let catchupBallsAtStart = -1;
      eventBus.on('catching_up_started', () => {
        self.setOngoingProcess('Syncing', true);
        self.syncProgress = '0% of new units';
      });
      eventBus.on('catchup_balls_left', (countLeft) => {
        if (catchupBallsAtStart === -1) {
          catchupBallsAtStart = countLeft;
        }
        const percent = Math.round(((catchupBallsAtStart - countLeft) / catchupBallsAtStart) * 100);
        self.syncProgress = `${percent}% of new units`;
        $timeout(() => {
          $rootScope.$apply();
        });
      });
      eventBus.on('catching_up_done', () => {
        catchupBallsAtStart = -1;
        self.setOngoingProcess('Syncing', false);
        self.syncProgress = '';
      });
      eventBus.on('refresh_light_started', () => {
        console.log('refresh_light_started');
        self.setOngoingProcess('Syncing', true);
      });
      eventBus.on('refresh_light_done', () => {
        console.log('refresh_light_done');
        self.setOngoingProcess('Syncing', false);
      });

      eventBus.on('confirm_on_other_devices', () => {
        $rootScope.$emit('Local/ShowAlert', 'Transaction created.\nPlease approve it on the other devices.', 'fi-key', () => {
          go.walletHome();
        });
      });

      eventBus.on('refused_to_sign', (deviceAddress) => {
        const device = require('byteballcore/device.js');
        device.readCorrespondent(deviceAddress, (correspondent) => {
          notification.success(gettextCatalog.getString('Refused'), `${correspondent.name} refused to sign the transaction`);
        });
      });

      /*
       eventBus.on("transaction_sent", function(){
       self.updateAll();
       self.updateTxHistory();
       });
      */

      eventBus.on('new_my_transactions', () => {
        breadcrumbs.add('new_my_transactions');
        self.updateAll();
        self.updateTxHistory();
      });

      eventBus.on('my_transactions_became_stable', () => {
        breadcrumbs.add('my_transactions_became_stable');
        self.updateAll();
        self.updateTxHistory();
      });

      eventBus.on('mci_became_stable', () => {
        breadcrumbs.add('mci_became_stable');
        self.updateAll();
        self.updateTxHistory();
      });

      eventBus.on('maybe_new_transactions', () => {
        breadcrumbs.add('maybe_new_transactions');
        self.updateAll();
        self.updateTxHistory();
      });

      eventBus.on('wallet_approved', (walletId, deviceAddress) => {
        console.log(`wallet_approved ${walletId} by ${deviceAddress}`);
        const client = profileService.walletClients[walletId];
        // already deleted (maybe declined by another device) or not present yet
        if (!client) {
          return;
        }
        const walletName = client.credentials.walletName;
        updatePublicKeyRing(client);
        const device = require('byteballcore/device.js');
        device.readCorrespondent(deviceAddress, (correspondent) => {
          notification.success(gettextCatalog.getString('Success'), `Wallet ${walletName} approved by ${correspondent.name}`);
        });
      });

      eventBus.on('wallet_declined', (walletId, deviceAddress) => {
        const client = profileService.walletClients[walletId];
        // already deleted (maybe declined by another device)
        if (!client) {
          return;
        }
        const walletName = client.credentials.walletName;
        const device = require('byteballcore/device.js');
        device.readCorrespondent(deviceAddress, (correspondent) => {
          notification.info(gettextCatalog.getString('Declined'), `Wallet ${walletName} declined by ${correspondent.name}`);
        });
        profileService.deleteWallet({ client }, (err) => {
          if (err) {
            console.log(err);
          }
        });
      });

      eventBus.on('wallet_completed', (walletId) => {
        console.log(`wallet_completed ${walletId}`);
        const client = profileService.walletClients[walletId];
        if (!client) {
          return;
        } // impossible
        const walletName = client.credentials.walletName;
        updatePublicKeyRing(client, () => {
          if (!client.isComplete()) {
            throw Error('not complete');
          }
          notification.success(gettextCatalog.getString('Success'), `Wallet ${walletName} is ready`);
          $rootScope.$emit('Local/WalletCompleted');
        });
      });

      const acceptMessage = gettextCatalog.getString('Yes');
      const cancelMessage = gettextCatalog.getString('No');
      const confirmMessage = gettextCatalog.getString('Confirm');

      const modalRequestApproval = function (question, callbacks) {
        const ModalInstanceCtrl = function ($scope, $modalInstance, $sce) {
          $scope.title = $sce.trustAsHtml(question);
          $scope.yes_icon = 'fi-check';
          $scope.yes_button_class = 'primary';
          $scope.cancel_button_class = 'warning';
          $scope.cancel_label = 'No';
          $scope.loading = false;

          $scope.ok = function () {
            $scope.loading = true;
            $modalInstance.close(acceptMessage);
          };
          $scope.cancel = function () {
            $modalInstance.dismiss(cancelMessage);
          };
        };

        const modalInstance = $modal.open({
          templateUrl: 'views/modals/confirmation.html',
          windowClass: animationService.modalAnimated.slideUp,
          controller: ModalInstanceCtrl,
        });

        modalInstance.result.finally(() => {
          const m = angular.element(document.getElementsByClassName('reveal-modal'));
          m.addClass(animationService.modalAnimated.slideOutDown);
        });

        modalInstance.result.then(callbacks.ifYes, callbacks.ifNo);
      };

      const requestApproval = function (question, callbacks) {
        if (isCordova) {
          navigator.notification.confirm(
            question,
            (buttonIndex) => {
              if (buttonIndex === 1) {
                callbacks.ifYes();
              } else {
                callbacks.ifNo();
              }
            },
            confirmMessage, [acceptMessage, cancelMessage]);
        } else {
          modalRequestApproval(question, callbacks);
        }
      };

      // in arrOtherCosigners, 'other' is relative to the initiator
      eventBus.on('create_new_wallet', (walletId, arrWalletDefinitionTemplate, arrDeviceAddresses, walletName, arrOtherCosigners) => {
        const device = require('byteballcore/device.js');
        const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
        device.readCorrespondentsByDeviceAddresses(arrDeviceAddresses, (arrCorrespondentInfos) => {
          // my own address is not included in arrCorrespondentInfos because I'm not my correspondent
          const arrNames = arrCorrespondentInfos.map(correspondent => correspondent.name);
          const nameList = arrNames.join(', ');
          const question = gettextCatalog.getString(`Create new wallet ${walletName} together with ${nameList} ?`);
          requestApproval(question, {
            ifYes() {
              console.log('===== YES CLICKED');
              const createNewWallet = function () {
                walletDefinedByKeys.readNextAccount((account) => {
                  const walletClient = bwcService.getClient();
                  if (!profileService.focusedClient.credentials.xPrivKey) {
                    throw Error('no profileService.focusedClient.credentials.xPrivKeyin createNewWallet');
                  }
                  walletClient.seedFromExtendedPrivateKey(profileService.focusedClient.credentials.xPrivKey, account);
                  // walletClient.seedFromMnemonic(profileService.profile.mnemonic, {account: account});
                  walletDefinedByKeys.approveWallet(
                    walletId,
                    walletClient.credentials.xPubKey,
                    account,
                    arrWalletDefinitionTemplate,
                    arrOtherCosigners, () => {
                      walletClient.credentials.walletId = walletId;
                      walletClient.credentials.network = 'livenet';
                      const n = arrDeviceAddresses.length;
                      const m = arrWalletDefinitionTemplate[1].required || n;
                      walletClient.credentials.addWalletInfo(walletName, m, n);
                      updatePublicKeyRing(walletClient);
                      profileService.addWalletClient(walletClient, {}, () => {
                        console.log(`switched to newly approved wallet ${walletId}`);
                      });
                    });
                });
              };
              if (profileService.focusedClient.credentials.xPrivKey) {
                createNewWallet();
              } else {
                profileService.insistUnlockFC(null, createNewWallet);
              }
            },
            ifNo() {
              console.log('===== NO CLICKED');
              walletDefinedByKeys.cancelWallet(walletId, arrDeviceAddresses, arrOtherCosigners);
            },
          });
        });
      });

      // units that were already approved or rejected by user.
      // if there are more than one addresses to sign from,
      // we won't pop up confirmation dialog for each address,
      // instead we'll use the already obtained approval
      const assocChoicesByUnit = {};

      // objAddress is local wallet address, top_address is the address that requested the signature,
      // it may be different from objAddress if it is a shared address
      eventBus.on('signing_request', (objAddress, topAddress, objUnit, assocPrivatePayloads, fromAddress, signingPath) => {
        function createAndSendSignature() {
          const coin = '0';
          const path = `m/44'/${coin}'/${objAddress.account}'/${objAddress.is_change}/${objAddress.address_index}`;
          console.log(`path ${path}`);
          // focused client might be different from the wallet this signature is for, but it doesn't matter as we have a single key for all wallets
          if (profileService.focusedClient.isPrivKeyEncrypted()) {
            console.log('priv key is encrypted, will be back after password request');
            return profileService.insistUnlockFC(null, () => {
              createAndSendSignature();
            });
          }
          const xPrivKey = new Bitcore.HDPrivateKey.fromString(profileService.focusedClient.credentials.xPrivKey);
          const privateKey = xPrivKey.derive(path).privateKey;
          console.log('priv key:', privateKey);
          // var privKeyBuf = privateKey.toBuffer();
          const privKeyBuf = privateKey.bn.toBuffer({ size: 32 }); // https://github.com/bitpay/bitcore-lib/issues/47
          console.log('priv key buf:', privKeyBuf);
          const bufToSign = objectHash.getUnitHashToSign(objUnit);
          const signature = ecdsaSig.sign(bufToSign, privKeyBuf);
          console.log(`sent signature ${signature}`);
          const bbWallet = require('byteballcore/wallet.js');
          return bbWallet.sendSignature(fromAddress, bufToSign.toString('base64'), signature, signingPath, topAddress);
        }

        function refuseSignature() {
          const bufToSign = objectHash.getUnitHashToSign(objUnit);
          const bbWallet = require('byteballcore/wallet.js');
          bbWallet.sendSignature(fromAddress, bufToSign.toString('base64'), '[refused]', signingPath, topAddress);
          console.log('refused signature');
        }

        const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
        const unit = objUnit.unit;
        const credentials = lodash.find(profileService.profile.credentials, { walletId: objAddress.wallet });
        mutex.lock([`signing_request-${unit}`], (unlock) => {
          // apply the previously obtained decision.
          // Unless the priv key is encrypted in which case the password
          // request would have appeared from nowhere
          if (assocChoicesByUnit[unit] && !profileService.focusedClient.isPrivKeyEncrypted()) {
            if (assocChoicesByUnit[unit] === 'approve') {
              createAndSendSignature();
            } else if (assocChoicesByUnit[unit] === 'refuse') {
              refuseSignature();
            }
            return unlock();
          }

          return walletDefinedByKeys.readChangeAddresses(objAddress.wallet, (arrChangeAddressInfos) => {
            const arrAuthorAddresses = objUnit.authors.map(author => author.address);
            let arrChangeAddresses = arrChangeAddressInfos.map(info => info.address);
            arrChangeAddresses = arrChangeAddresses.concat(arrAuthorAddresses);
            arrChangeAddresses.push(topAddress);
            const arrPaymentMessages = objUnit.messages.filter(objMessage => (objMessage.app === 'payment'));
            if (arrPaymentMessages.length === 0) {
              throw Error('no payment message found');
            }
            const assocAmountByAssetAndAddress = {};
            // exclude outputs paying to my change addresses
            async.eachSeries(
              arrPaymentMessages,
              (objMessage, cb) => {
                let payload = objMessage.payload;
                if (!payload) {
                  payload = assocPrivatePayloads[objMessage.payload_hash];
                }
                if (!payload) {
                  throw Error(`no inline payload and no private payload either, message=${JSON.stringify(objMessage)}`);
                }
                const asset = payload.asset || 'base';
                if (!payload.outputs) {
                  throw Error('no outputs');
                }
                if (!assocAmountByAssetAndAddress[asset]) {
                  assocAmountByAssetAndAddress[asset] = {};
                }
                payload.outputs.forEach((output) => {
                  if (arrChangeAddresses.indexOf(output.address) === -1) {
                    if (!assocAmountByAssetAndAddress[asset][output.address]) {
                      assocAmountByAssetAndAddress[asset][output.address] = 0;
                    }
                    assocAmountByAssetAndAddress[asset][output.address] += output.amount;
                  }
                });
                cb();
              },
              () => {
                const arrDestinations = [];
                Object.keys(assocAmountByAssetAndAddress).forEach((asset) => {
                  const walletSettings = configService.getSync().wallet.settings;
                  const formattedAsset = isCordova ? asset : (`<span class='small'>${asset}</span><br/>`);
                  let currency;
                  let value;

                  Object.keys(assocAmountByAssetAndAddress[asset]).forEach((address) => {
                    if (asset !== 'base') {
                      currency = asset === constants.DAGCOIN_ASSET ? 'dag' : `of asset ${formattedAsset}`;
                      value = assocAmountByAssetAndAddress[asset][address] / walletSettings.dagUnitValue;
                    } else {
                      currency = 'bytes';
                      value = assocAmountByAssetAndAddress[asset][address] / walletSettings.unitValue;
                    }
                    arrDestinations.push(`${value} ${currency} to ${address}`);
                  });
                });
                const dest = (arrDestinations.length > 0) ? arrDestinations.join(', ') : 'to myself';
                const question = gettextCatalog.getString(`Sign transaction spending ${dest} from wallet ${credentials.walletName}?`);
                requestApproval(question, {
                  ifYes() {
                    createAndSendSignature();
                    assocChoicesByUnit[unit] = 'approve';
                    unlock();
                  },
                  ifNo() {
                    // do nothing
                    console.log('===== NO CLICKED');
                    refuseSignature();
                    assocChoicesByUnit[unit] = 'refuse';
                    unlock();
                  },
                });
              }); // eachSeries
          });
        });
      });

      self.openSubwalletModal = function () {
        $rootScope.modalOpened = true;
        const fc = profileService.focusedClient;

        const ModalInstanceCtrl = function ($scope, $modalInstance) {
          $scope.color = fc.backgroundColor;
          $scope.indexCtl = self;
          const arrSharedWallets = [];
          $scope.mainWalletBalanceInfo = self.arrMainWalletBalances[self.assetIndex];
          $scope.asset = $scope.mainWalletBalanceInfo.asset;
          const assocSharedByAddress = self.arrBalances[self.assetIndex].assocSharedByAddress;
          Object.keys(assocSharedByAddress).forEach((sa) => {
            const objSharedWallet = {};
            objSharedWallet.shared_address = sa;
            objSharedWallet.total = assocSharedByAddress[sa];
            if ($scope.asset === 'base') {
              objSharedWallet.totalStr = `${profileService.formatAmount(assocSharedByAddress[sa], 'base')} ${self.unitName}`;
            } else if ($scope.asset === self.DAGCOIN_ASSET) {
              objSharedWallet.totalStr = `${profileService.formatAmount(assocSharedByAddress[sa], 'DAG')} ${self.dagUnitName}`;
            }
            arrSharedWallets.push(objSharedWallet);
          });
          $scope.arrSharedWallets = arrSharedWallets;

          $scope.cancel = function () {
            breadcrumbs.add('openSubwalletModal cancel');
            $modalInstance.dismiss('cancel');
          };

          $scope.selectSubwallet = function (sharedAddress) {
            self.shared_address = sharedAddress;
            if (sharedAddress) {
              const walletDefinedByAddresses = require('byteballcore/wallet_defined_by_addresses.js');
              walletDefinedByAddresses.determineIfHasMerkle(sharedAddress, (bHasMerkle) => {
                self.bHasMerkle = bHasMerkle;
                $rootScope.$apply();
              });
            } else {
              self.bHasMerkle = false;
            }
            self.updateAll();
            self.updateTxHistory();
            $modalInstance.close();
          };
        };

        const modalInstance = $modal.open({
          templateUrl: 'views/modals/select-subwallet.html',
          windowClass: animationService.modalAnimated.slideUp,
          controller: ModalInstanceCtrl,
        });

        const disableCloseModal = $rootScope.$on('closeModal', () => {
          breadcrumbs.add('openSubwalletModal on closeModal');
          modalInstance.dismiss('cancel');
        });

        modalInstance.result.finally(() => {
          $rootScope.modalOpened = false;
          disableCloseModal();
          const m = angular.element(document.getElementsByClassName('reveal-modal'));
          m.addClass(animationService.modalAnimated.slideOutDown);
        });
      };

      self.goHome = function () {
        go.walletHome();
      };

      self.menu = [{
        title: gettext('Home'),
        icon: 'icon-home',
        link: 'walletHome',
      }, {
        title: gettext('Receive'),
        icon: 'icon-recieve',
        link: 'receive',
      }, {
        title: gettext('Send'),
        icon: 'icon-send',
        link: 'send',
      }/* , {
        title: gettext('History'),
        icon: 'icon-history',
        link: 'history',
      } */];

      self.getSvgSrc = function (id) {
        return `img/svg/symbol-defs.svg#${id}`;
      };

      self.addonViews = addonManager.addonViews();
      self.menu = self.menu.concat(addonManager.addonMenuItems());
      self.menuItemSize = self.menu.length > 5 ? 2 : 3;
      self.txTemplateUrl = addonManager.txTemplateUrl() || 'views/includes/transaction.html';

      self.tab = 'walletHome';


      self.setOngoingProcess = function (processName, isOn) {
        $log.debug('onGoingProcess', processName, isOn);
        self[processName] = isOn;
        self.onGoingProcess[processName] = isOn;

        let name;
        self.anyOnGoingProcess = lodash.any(self.onGoingProcess, (isOn, processName) => {
          if (isOn) {
            name = name || processName;
          }
          return isOn;
        });
        // The first one
        self.onGoingProcessName = name;
        $timeout(() => {
          $rootScope.$apply();
        });
      };

      self.setFocusedWallet = function () {
        const fc = profileService.focusedClient;
        if (!fc) return;

        breadcrumbs.add(`setFocusedWallet ${fc.credentials.walletId}`);

        // Clean status
        self.totalBalanceBytes = null;
        self.lockedBalanceBytes = null;
        self.availableBalanceBytes = null;
        self.pendingAmount = null;
        self.spendUnconfirmed = null;

        self.totalBalanceStr = null;
        self.availableBalanceStr = null;
        self.lockedBalanceStr = null;

        self.arrBalances = [];
        self.assetIndex = 0;
        self.shared_address = null;
        self.bHasMerkle = false;

        self.txHistory = [];
        self.completeHistory = [];
        self.txProgress = 0;
        self.historyShowShowAll = false;
        self.balanceByAddress = null;
        self.pendingTxProposalsCountForUs = null;
        self.setSpendUnconfirmed();

        $timeout(() => {
          // $rootScope.$apply();
          self.hasProfile = true;
          self.noFocusedWallet = false;
          self.onGoingProcess = {};

          // Credentials Shortcuts
          self.m = fc.credentials.m;
          self.n = fc.credentials.n;
          self.network = fc.credentials.network;
          self.requiresMultipleSignatures = fc.credentials.m > 1;
          // self.isShared = fc.credentials.n > 1;
          self.walletName = fc.credentials.walletName;
          self.walletId = fc.credentials.walletId;
          self.isComplete = fc.isComplete();
          self.canSign = fc.canSign();
          self.isPrivKeyExternal = fc.isPrivKeyExternal();
          self.isPrivKeyEncrypted = fc.isPrivKeyEncrypted();
          self.externalSource = fc.getPrivKeyExternalSourceName();
          self.account = fc.credentials.account;

          self.txps = [];
          self.copayers = [];
          self.updateColor();
          self.updateAlias();
          self.setAddressbook();

          console.log('reading cosigners');
          const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
          walletDefinedByKeys.readCosigners(self.walletId, (arrCosignerInfos) => {
            self.copayers = arrCosignerInfos;
            $timeout(() => {
              $rootScope.$digest();
            });
          });

          self.needsBackup = false;
          self.openWallet();
          /* if (fc.isPrivKeyExternal()) {
           self.needsBackup = false;
           self.openWallet();
           } else {
           storageService.getBackupFlag('all', function(err, val) {
           self.needsBackup = self.network == 'testnet' ? false : !val;
           self.openWallet();
           });
           } */
        });
      };


      self.setTab = function (tab, reset, tries, switchState) {
        console.log('setTab', tab, reset, tries, switchState);
        let setTabTries = tries || 0;

        const changeTab = function (tab) {
          if (document.querySelector('.tab-in.tab-view')) {
            const el = angular.element(document.querySelector('.tab-in.tab-view'));
            el.removeClass('tab-in').addClass('tab-out');
            const old = document.getElementById(`menu-${self.tab}`);
            if (old) {
              old.className = '';
            }
          }

          if (document.getElementById(tab)) {
            const el = angular.element(document.getElementById(tab));
            el.removeClass('tab-out').addClass('tab-in');
            const newe = document.getElementById(`menu-${tab}`);
            if (newe) {
              newe.className = 'active';
            }
          }

          $rootScope.tab = tab;
          self.tab = tab;
          $rootScope.$emit('Local/TabChanged', tab);
        };

        // check if the whole menu item passed
        if (typeof tab === 'object') {
          if (!tab.new_state) backButton.clearHistory();
          if (tab.open) {
            if (tab.link) {
              $rootScope.tab = tab.link;
              self.tab = tab.link;
            }
            tab.open();
            return;
          } else if (tab.new_state) {
            changeTab(tab.link);
            $rootScope.tab = tab.link;
            self.tab = tab.link;
            go.path(tab.new_state);
            return;
          }
          return self.setTab(tab.link, reset, setTabTries, switchState);
        }
        console.log(`current tab ${self.tab}, requested to set tab ${tab}, reset=${reset}`);
        if (self.tab === tab && !reset) {
          return;
        }
        setTabTries += 1;
        if (!document.getElementById(`menu-${tab}`) && setTabTries < 5) {
          console.log('will retry setTab later:', tab, reset, setTabTries, switchState);
          return $timeout(() => {
            self.setTab(tab, reset, setTabTries, switchState);
          }, (setTabTries === 1) ? 10 : 300);
        }

        if (!self.tab || !$state.is('walletHome')) {
          $rootScope.tab = 'walletHome';
          self.tab = 'walletHome';
        }

        if (switchState && !$state.is('walletHome')) {
          go.path('walletHome', () => {
            changeTab(tab);
          });
          return;
        }

        changeTab(tab);
      };


      self.updateAll = function (opts) {
        const options = opts || {};

        const fc = profileService.focusedClient;
        if (!fc) {
          return breadcrumbs.add('updateAll no fc');
        }

        if (!fc.isComplete()) {
          return breadcrumbs.add('updateAll not complete yet');
        }

        // reconnect if lost connection
        const device = require('byteballcore/device.js');
        device.loginToHub();

        return $timeout(() => {
          if (!options.quiet) {
            self.setOngoingProcess('updatingStatus', true);
          }

          $log.debug('Updating Status:', fc.credentials.walletName);
          if (!options.quiet) {
            self.setOngoingProcess('updatingStatus', false);
          }


          fc.getBalance(self.shared_address, (err, assocBalances, assocSharedBalances) => {
            if (err) {
              throw Error('impossible getBal');
            }
            $log.debug('updateAll Wallet Balance:', assocBalances, assocSharedBalances);
            self.setBalance(assocBalances, assocSharedBalances);
            // Notify external addons or plugins
            $rootScope.$emit('Local/BalanceUpdated', assocBalances);
            if (!self.isPrivKeyEncrypted) {
              $rootScope.$emit('Local/BalanceUpdatedAndWalletUnlocked', assocBalances);
            }
          });

          self.otherWallets = lodash.filter(profileService.getWallets(self.network), w => (w.id !== self.walletId || self.shared_address));

          // $rootScope.$apply();

          if (options.triggerTxUpdate) {
            $timeout(() => {
              breadcrumbs.add('triggerTxUpdate');
              self.updateTxHistory();
            }, 1);
          }
        });
      };

      self.setSpendUnconfirmed = function () {
        self.spendUnconfirmed = configService.getSync().wallet.spendUnconfirmed;
      };


      self.updateBalance = function () {
        const fc = profileService.focusedClient;
        $timeout(() => {
          self.setOngoingProcess('updatingBalance', true);
          $log.debug('Updating Balance');
          fc.getBalance(self.shared_address, (err, assocBalances, assocSharedBalances) => {
            self.setOngoingProcess('updatingBalance', false);
            if (err) {
              throw Error('impossible error from getBalance');
            }
            $log.debug('updateBalance Wallet Balance:', assocBalances, assocSharedBalances);
            self.setBalance(assocBalances, assocSharedBalances);
          });
        });
      };


      self.openWallet = function () {
        console.log('index.openWallet called');
        const fc = profileService.focusedClient;
        breadcrumbs.add(`openWallet ${fc.credentials.walletId}`);
        $timeout(() => {
          // $rootScope.$apply();
          self.setOngoingProcess('openingWallet', true);
          self.updateError = false;
          fc.openWallet((err, walletStatus) => {
            self.setOngoingProcess('openingWallet', false);
            if (err) {
              throw Error('impossible error from openWallet');
            }
            $log.debug('Wallet Opened');
            self.updateAll(lodash.isObject(walletStatus) ? {
              walletStatus,
            } : null);
            // $rootScope.$apply();
          });
        });
      };


      self.processNewTxs = function (txs) {
        // const config = configService.getSync().wallet.settings;
        const now = Math.floor(Date.now() / 1000);
        const ret = [];

        lodash.each(txs, (tx) => {
          const transaction = txFormatService.processTx(tx);

          // no future transactions...
          if (transaction.time > now) {
            transaction.time = now;
          }
          ret.push(transaction);
        });

        return ret;
      };

      self.updateAlias = function () {
        const config = configService.getSync();
        config.aliasFor = config.aliasFor || {};
        self.alias = config.aliasFor[self.walletId];
        const fc = profileService.focusedClient;
        fc.alias = self.alias;
      };

      self.updateColor = function () {
        const config = configService.getSync();
        config.colorFor = config.colorFor || {};
        self.backgroundColor = config.colorFor[self.walletId] || '#4A90E2';
        const fc = profileService.focusedClient;
        fc.backgroundColor = self.backgroundColor;
      };

      self.setBalance = function (assocBalances, assocSharedBalances) {
        if (!assocBalances) return;
        const config = configService.getSync().wallet.settings;

        // Selected unit
        self.unitValue = config.unitValue;
        self.unitName = config.unitName;
        self.dagUnitName = config.dagUnitName;

        self.arrBalances = [];
        Object.keys(assocBalances).forEach((asset) => {
          const balanceInfo = assocBalances[asset];
          balanceInfo.asset = asset;
          balanceInfo.total = balanceInfo.stable + balanceInfo.pending;
          if (assocSharedBalances[asset]) {
            balanceInfo.shared = 0;
            balanceInfo.assocSharedByAddress = {};
            Object.keys(assocSharedBalances[asset]).forEach((sa) => {
              const totalOnSharedAddress = (assocSharedBalances[asset][sa].stable || 0) + (assocSharedBalances[asset][sa].pending || 0);
              balanceInfo.shared += totalOnSharedAddress;
              balanceInfo.assocSharedByAddress[sa] = totalOnSharedAddress;
            });
          }
          if (asset === 'base' || asset === self.DAGCOIN_ASSET) {
            const assetName = asset !== 'base' ? 'DAG' : 'base';
            balanceInfo.totalStr = profileService.formatAmount(balanceInfo.total, assetName);
            balanceInfo.stableStr = profileService.formatAmount(balanceInfo.stable, assetName);
            balanceInfo.pendingStr = `${profileService.formatAmount(balanceInfo.pending, assetName)} ${config.dagUnitName}`;
            if (balanceInfo.shared) {
              balanceInfo.sharedStr = profileService.formatAmount(balanceInfo.shared, assetName);
            }
          }
          self.arrBalances.push(balanceInfo);
        });
        self.assetIndex = self.assetIndex || 0;
        if (!self.arrBalances[self.assetIndex]) {
          // if no such index in the subwallet, reset to bytes
          self.assetIndex = 0;
        }
        if (!self.shared_address) {
          self.arrMainWalletBalances = self.arrBalances;
        }
        self.dagBalance = _.find(self.arrBalances, { asset: self.DAGCOIN_ASSET });
        self.baseBalance = _.find(self.arrBalances, { asset: 'base' });
        console.log(`========= setBalance done, balances: ${JSON.stringify(self.arrBalances)}`);
        breadcrumbs.add(`setBalance done, balances: ${JSON.stringify(self.arrBalances)}`);

        /*
         // SAT
         if (self.spendUnconfirmed) {
         self.totalBalanceBytes = balance.totalAmount;
         self.lockedBalanceBytes = balance.lockedAmount || 0;
         self.availableBalanceBytes = balance.availableAmount || 0;
         self.pendingAmount = null;
         } else {
         self.totalBalanceBytes = balance.totalConfirmedAmount;
         self.lockedBalanceBytes = balance.lockedConfirmedAmount || 0;
         self.availableBalanceBytes = balance.availableConfirmedAmount || 0;
         self.pendingAmount = balance.totalAmount - balance.totalConfirmedAmount;
         }

         //STR
         self.totalBalanceStr = profileService.formatAmount(self.totalBalanceBytes) + ' ' + self.unitName;
         self.lockedBalanceStr = profileService.formatAmount(self.lockedBalanceBytes) + ' ' + self.unitName;
         self.availableBalanceStr = profileService.formatAmount(self.availableBalanceBytes) + ' ' + self.unitName;

         if (self.pendingAmount) {
         self.pendingAmountStr = profileService.formatAmount(self.pendingAmount) + ' ' + self.unitName;
         } else {
         self.pendingAmountStr = null;
         }
         */
        $timeout(() => {
          $rootScope.$apply();
        });
      };

      this.csvHistory = function () {
        function saveFile(name, data) {
          const chooser = document.querySelector(name);
          chooser.addEventListener('change', function (evt) {
            const fs = require('fs');
            fs.writeFile(this.value, data, (err) => {
              if (err) {
                $log.debug(evt, err);
              }
            });
          }, false);
          chooser.click();
        }

        function formatDate(date) {
          const dateObj = new Date(date);
          if (!dateObj) {
            $log.debug('Error formating a date');
            return 'DateError';
          }
          if (!dateObj.toJSON()) {
            return '';
          }

          return dateObj.toJSON();
        }

        function formatString(str) {
          let formatString = str;
          if (!formatString) {
            return '';
          }

          if (formatString.indexOf('"') !== -1) {
            // replace all
            formatString = formatString.replace(new RegExp('"', 'g'), '\'');
          }

          // escaping commas
          formatString = `\"${formatString}\"`;

          return formatString;
        }

        const step = 6;
        // const unique = {};

        if (isCordova) {
          $log.info('CSV generation not available in mobile');
          return;
        }
        const isNode = nodeWebkit.isDefined();
        const fc = profileService.focusedClient;
        const c = fc.credentials;
        if (!fc.isComplete()) return;
        const self = this;
        const allTxs = [];

        $log.debug('Generating CSV from History');
        self.setOngoingProcess('generatingCSV', true);

        $timeout(() => {
          fc.getTxHistory(self.arrBalances[self.assetIndex].asset, self.shared_address, (txs) => {
            self.setOngoingProcess('generatingCSV', false);
            $log.debug('Wallet Transaction History:', txs);

            const data = txs;
            const filename = `Byteball-${self.alias || self.walletName}.csv`;
            let csvContent = '';

            if (!isNode) csvContent = 'data:text/csv;charset=utf-8,';
            csvContent += 'Date,Destination,Note,Amount,Currency,Spot Value,Total Value,Tax Type,Category\n';

            let amount;
            let note;
            let dataString;
            data.forEach((it, index) => {
              console.log('Processing transactions number', index);
              let amount = it.amount;

              if (it.action === 'moved') {
                amount = 0;
              }

              amount = (it.action === 'sent' ? '-' : '') + amount;
              note = formatString(`${it.message ? it.message : ''} unit: ${it.unit}`);

              if (it.action === 'moved') {
                note += ` Moved:${it.amount}`;
              }

              dataString = `${formatDate(it.time * 1000)},${formatString(it.addressTo)},${note},${amount},byte,,,,`;
              csvContent += `${dataString}\n`;
            });

            if (isNode) {
              saveFile('#export_file', csvContent);
            } else {
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', filename);
              link.click();
            }
            $rootScope.$apply();
          });
        });
      };


      self.updateLocalTxHistory = function (client, cb) {
        const walletId = client.credentials.walletId;
        if (self.arrBalances.length === 0) {
          return console.log('updateLocalTxHistory: no balances yet');
        }
        breadcrumbs.add(`index: ${self.assetIndex}; balances: ${JSON.stringify(self.arrBalances)}`);
        if (!client.isComplete()) {
          return console.log('fc incomplete yet');
        }
        return client.getTxHistory(self.DAGCOIN_ASSET, self.shared_address, (txs) => {
          const newHistory = self.processNewTxs(txs);
          $log.debug(`Tx History synced. Total Txs: ${newHistory.length}`);

          if (walletId === profileService.focusedClient.credentials.walletId) {
            self.completeHistory = newHistory;
            self.txHistory = newHistory.slice(0, self.historyShowLimit);
            self.historyShowShowAll = newHistory.length >= self.historyShowLimit;
          }

          return cb();
        });
      };

      self.showAllHistory = function () {
        self.historyShowShowAll = false;
        self.historyRendering = true;
        $timeout(() => {
          $rootScope.$apply();
          $timeout(() => {
            self.historyRendering = false;
            self.txHistory = self.completeHistory;
          }, 100);
        }, 100);
      };


      self.updateHistory = function () {
        const fc = profileService.focusedClient;
        const walletId = fc.credentials.walletId;

        if (!fc.isComplete()) return;

        $log.debug('Updating Transaction History for walletId', walletId);
        self.txHistoryError = false;
        self.updatingTxHistory = true;

        $timeout(() => {
          self.updateLocalTxHistory(fc, (err) => {
            self.updatingTxHistory = false;
            if (err) {
              self.txHistoryError = true;
            }

            $rootScope.$apply();
          });
        });
      };

      self.updateTxHistory = lodash.debounce(() => {
        self.updateHistory();
      }, 1000);

//  self.throttledUpdateHistory = lodash.throttle(function() {
//    self.updateHistory();
//  }, 5000);

//    self.onMouseDown = function(){
//        console.log('== mousedown');
//        self.oldAssetIndex = self.assetIndex;
//    };

      self.onClick = function () {
        console.log('== click');
        self.oldAssetIndex = self.assetIndex;
      };

      // for light clients only
      self.updateHistoryFromNetwork = lodash.throttle(() => {
        setTimeout(() => {
          if (self.assetIndex !== self.oldAssetIndex) {
            // it was a swipe
            console.log('== swipe');
            return;
          }
          console.log('== updateHistoryFromNetwork');
          const lightWallet = require('byteballcore/light_wallet.js');
          lightWallet.refreshLightClientHistory();
        }, 500);
      }, 5000);

      self.showPopup = function (msg, msgIcon, cb) {
        $log.warn(`Showing ${msgIcon} popup:${msg}`);
        self.showAlert = {
          msg: msg.toString(),
          msg_icon: msgIcon,
          close(err) {
            self.showAlert = null;
            return cb(err) || null;
          },
        };
        $timeout(() => {
          $rootScope.$apply();
        });
      };

      self.showErrorPopup = function (msg, cb) {
        $log.warn(`Showing err popup:${msg}`);
        self.showPopup(msg, 'fi-alert', cb);
      };

      self.recreate = function () {
        const fc = profileService.focusedClient;
        self.setOngoingProcess('recreating', true);
        fc.recreateWallet((err) => {
          self.setOngoingProcess('recreating', false);

          if (err) {
            throw Error('impossible err from recreateWallet');
          }

          profileService.setWalletClients();
          $timeout(() => {
            $rootScope.$emit('Local/WalletImported', self.walletId);
          }, 100);
        });
      };

      self.openMenu = function () {
        backButton.menuOpened = true;
        go.swipe(true);
      };

      self.closeMenu = function () {
        backButton.menuOpened = false;
        go.swipe();
      };

      self.swipeRight = function () {
        if (!self.bSwipeSuspended) {
          self.openMenu();
        } else {
          console.log('ignoring swipe');
        }
      };

      self.suspendSwipe = function () {
        if (self.arrBalances.length <= 1) {
          return;
        }
        self.bSwipeSuspended = true;
        console.log('suspending swipe');
        $timeout(() => {
          self.bSwipeSuspended = false;
          console.log('resuming swipe');
        }, 100);
      };

      self.retryScan = function () {
        const self = this;
        self.startScan(self.walletId);
      };
      self.onQrCodeScanned = function (data) {
        go.handleUri(data);
        // $rootScope.$emit('dataScanned', data);
      };

      self.openSendScreen = function () {
        go.send();
      };

      self.startScan = function (walletId) {
        $log.debug(`Scanning wallet ${walletId}`);
        // const c = profileService.walletClients[walletId];
        // if (!c.isComplete()) {
        //   return;
        // }
        /*
         if (self.walletId == walletId)
         self.setOngoingProcess('scanning', true);

         c.startScan({
         includeCopayerBranches: true,
         }, function(err) {
         if (err && self.walletId == walletId) {
         self.setOngoingProcess('scanning', false);
         self.handleError(err);
         $rootScope.$apply();
         }
         });
         */
      };

      self.setUxLanguage = function () {
        const userLang = uxLanguage.update();
        self.defaultLanguageIsoCode = userLang;
        self.defaultLanguageName = uxLanguage.getName(userLang);
      };


      self.setAddressbook = function (ab) {
        if (ab) {
          self.addressbook = ab;
          return;
        }

        addressbookService.list((err, ab) => {
          if (err) {
            $log.error('Error getting the addressbook');
            return;
          }
          self.addressbook = ab;
        });
      };


      function getNumberOfSelectedSigners() {
        let count = 1; // self
        self.copayers.forEach((copayer) => {
          if (copayer.signs) {
            count += 1;
          }
        });
        return count;
      }

      self.isEnoughSignersSelected = function () {
        if (self.m === self.n) {
          return true;
        }
        return (getNumberOfSelectedSigners() >= self.m);
      };

      self.getWallets = function () {
        return profileService.getWallets('livenet');
      };


      $rootScope.$on('Local/ClearHistory', (event) => {
        $log.debug('The wallet transaction history has been deleted', event);
        self.txHistory = [];
        self.completeHistory = [];
        self.updateHistory();
      });

      $rootScope.$on('Local/AddressbookUpdated', (event, ab) => {
        self.setAddressbook(ab);
      });

      // UX event handlers
      $rootScope.$on('Local/ColorUpdated', () => {
        self.updateColor();
        $timeout(() => {
          $rootScope.$apply();
        });
      });

      $rootScope.$on('Local/AliasUpdated', () => {
        self.updateAlias();
        $timeout(() => {
          $rootScope.$apply();
        });
      });

      $rootScope.$on('Local/SpendUnconfirmedUpdated', () => {
        self.setSpendUnconfirmed();
        self.updateAll();
      });

      $rootScope.$on('Local/ProfileBound', () => {
      });

      $rootScope.$on('Local/NewFocusedWallet', () => {
        self.setUxLanguage();
      });

      $rootScope.$on('Local/LanguageSettingUpdated', () => {
        self.setUxLanguage();
      });

      $rootScope.$on('Local/UnitSettingUpdated', () => {
        breadcrumbs.add('UnitSettingUpdated');
        self.updateAll();
        self.updateTxHistory();
      });

      $rootScope.$on('Local/NeedFreshHistory', () => {
        breadcrumbs.add('NeedFreshHistory');
        self.updateHistory();
      });


      $rootScope.$on('Local/WalletCompleted', () => {
        self.setFocusedWallet();
        go.walletHome();
      });

//  self.debouncedUpdate = lodash.throttle(function() {
//    self.updateAll({
//      quiet: true
//    });
//    self.updateTxHistory();
//  }, 4000, {
//    leading: false,
//    trailing: true
//  });

      $rootScope.$on('Local/Resume', () => {
        $log.debug('### Resume event');
        const lightWallet = require('byteballcore/light_wallet.js');
        lightWallet.refreshLightClientHistory();
        // self.debouncedUpdate();
      });

      $rootScope.$on('Local/BackupDone', () => {
        self.needsBackup = false;
        $log.debug('Backup done');
        storageService.setBackupFlag('all', (err) => {
          if (err) {
            $log.warn(`setBackupFlag failed: ${JSON.stringify(err)}`);
            return;
          }
          $log.debug('Backup done stored');
        });
      });

      $rootScope.$on('Local/DeviceError', (event, err) => {
        self.showErrorPopup(err, () => {
          if (self.isCordova && navigator && navigator.app) {
            navigator.app.exitApp();
          }
        });
      });


      $rootScope.$on('Local/WalletImported', (event, walletId) => {
        self.needsBackup = false;
        storageService.setBackupFlag(walletId, () => {
          $log.debug('Backup done stored');
          addressService.expireAddress(walletId, (err) => {
            $log.debug('Expire address error', err);
            $timeout(() => {
              self.txHistory = [];
              self.completeHistory = [];
              self.startScan(walletId);
            }, 500);
          });
        });
      });

      $rootScope.$on('NewIncomingTx', () => {
        self.updateAll({
          walletStatus: null,
          untilItChanges: true,
          triggerTxUpdate: true,
        });
      });


      $rootScope.$on('NewOutgoingTx', () => {
        breadcrumbs.add('NewOutgoingTx');
        self.updateAll({
          walletStatus: null,
          untilItChanges: true,
          triggerTxUpdate: true,
        });
      });

      lodash.each(['NewTxProposal', 'TxProposalFinallyRejected', 'TxProposalRemoved', 'NewOutgoingTxByThirdParty',
        'Local/NewTxProposal', 'Local/TxProposalAction',
      ], (eventName) => {
        $rootScope.$on(eventName, (event, untilItChanges) => {
          self.updateAll({
            walletStatus: null,
            untilItChanges,
            triggerTxUpdate: true,
          });
        });
      });

      $rootScope.$on('ScanFinished', () => {
        $log.debug('Scan Finished. Updating history');
        self.updateAll({
          walletStatus: null,
          triggerTxUpdate: true,
        });
      });


      $rootScope.$on('Local/NoWallets', () => {
        $timeout(() => {
          self.hasProfile = true;
          self.noFocusedWallet = true;
          self.isComplete = null;
          self.walletName = null;
          go.path('import');
        });
      });

      $rootScope.$on('Local/NewFocusedWallet', () => {
        self.setFocusedWallet();
        self.updatingTxHistory = true;
        self.updateTxHistory();
        go.walletHome();
      });

      $rootScope.$on('Local/SetTab', (event, tab, reset) => {
        console.log(`SetTab ${tab}, reset ${reset}`);
        self.setTab(tab, reset);
      });

      $rootScope.$on('Local/RequestTouchid', (event, cb) => {
        window.plugins.touchid.verifyFingerprint(
          gettextCatalog.getString('Scan your fingerprint please'),
          (msg) => {
            $log.debug('Scan Finished. Ok', msg);
            // OK
            cb();
          },
          (msg) => {
            // ERROR
            $log.debug('Invalid Touch ID', msg);
            cb(gettext('Invalid Touch ID'));
          });
      });

      $rootScope.$on('Local/ShowAlert', (event, msg, msgIcon, cb) => {
        self.showPopup(msg, msgIcon, cb);
      });

      $rootScope.$on('Local/ShowErrorAlert', (event, msg, cb) => {
        self.showErrorPopup(msg, cb);
      });

      $rootScope.$on('Local/NeedsPassword', (event, isSetup, errorMessage, cb) => {
        console.log('NeedsPassword');
        self.askPassword = {
          isSetup,
          error: errorMessage,
          callback(err, pass) {
            self.askPassword = null;
            return cb(err, pass);
          },
        };
        $timeout(() => {
          $rootScope.$apply();
        });
      });

      lodash.each(['NewCopayer', 'CopayerUpdated'], (eventName) => {
        $rootScope.$on(eventName, () => {
          // Re try to open wallet (will triggers)
          self.setFocusedWallet();
        });
      });

      $rootScope.$on('Local/NewEncryptionSetting', () => {
        const fc = profileService.focusedClient;
        self.isPrivKeyEncrypted = fc.isPrivKeyEncrypted();
        $timeout(() => {
          $rootScope.$apply();
        });
      });

      $rootScope.$on('Local/pushNotificationsReady', () => {
        self.usePushNotifications = true;
        $timeout(() => {
          $rootScope.$apply();
        });
      });

      if (autoRefreshClientService) {
        autoRefreshClientService.initHistoryAutoRefresh();
      }

      let gui;
      try {
        gui = require('nw.gui');
      } catch (e) {
        // continue regardless of error
      }

      if (gui) { // nwjs
        const win = gui.Window.get();
        win.on('close', function () {
          fundingNodeService.deactivate()
            .then(() => {
              this.close(true);
            });
        });
        win.on('closed', function () {
          fundingNodeService.deactivate()
            .then(() => {
              this.close(true);
            });
        });
      } else if (window.cordova) {
        document.addEventListener('resume', () => {
          fundingNodeService.init()
            .then(() => { });
        }, false);
        document.addEventListener('pause', () => {
          fundingNodeService.deactivate()
            .then(() => { });
        }, false);
      }
    });
}());
