angular.module('copayApp.controllers').controller('correspondentDeviceController',
  ($scope, $rootScope, $timeout, $sce, $modal, configService, profileService, animationService, isCordova, go,
    correspondentListService, addressService, lodash, $deepStateRedirect, $state, backButton) => {
    const chatStorage = require('byteballcore/chat_storage.js');
    const constants = require('byteballcore/constants.js');
    console.log('correspondentDeviceController');
    const device = require('byteballcore/device.js');
    const eventBus = require('byteballcore/event_bus.js');
    const conf = require('byteballcore/conf.js');
    const storage = require('byteballcore/storage.js');
    const breadcrumbs = require('byteballcore/breadcrumbs.js');
    const chatScope = $scope;
    const indexScope = $scope.index;
    $scope.index.tab = 'chat';
    $rootScope.tab = $scope.index.tab;
    $scope.profileService = profileService;
    $scope.backgroundColor = profileService.focusedClient.backgroundColor;
    const correspondent = correspondentListService.currentCorrespondent;
    $scope.correspondent = correspondent;
    if (document.chatForm && document.chatForm.message) {
      document.chatForm.message.focus();
    }

    if (!correspondentListService.messageEventsByCorrespondent[correspondent.device_address]) {
      correspondentListService.messageEventsByCorrespondent[correspondent.device_address] = [];
    }
    $scope.messageEvents = correspondentListService.messageEventsByCorrespondent[correspondent.device_address];

    $scope.$watch('correspondent.my_record_pref', (pref, oldPref) => {
      if (pref === oldPref) return;
      const deviceReq = require('byteballcore/device.js');
      deviceReq.sendMessageToDevice(correspondent.device_address, 'chat_recording_pref', pref, {
        ifOk() {
          deviceReq.updateCorrespondentProps(correspondent);
          const oldState = (correspondent.peer_record_pref && !correspondent.my_record_pref);
          const newState = (correspondent.peer_record_pref && correspondent.my_record_pref);
          if (newState !== oldState) {
            const message = {
              type: 'system',
              message: JSON.stringify({ state: newState }),
              timestamp: Math.floor(Date.now() / 1000),
              chat_recording_status: true,
            };
            $scope.autoScrollEnabled = true;
            $scope.messageEvents.push(correspondentListService.parseMessage(message));
            $scope.$digest();
            chatStorage.store(correspondent.device_address, JSON.stringify({ state: newState }), 0, 'system');
          }
          /* if (!pref) {
                      chatStorage.purge(correspondent.device_address);
                  } */
        },
        ifError() {
          // ignore
        },
      });
    });

    const removeNewMessagesDelim = function () {
      Object.keys($scope.messageEvents).forEach((i) => {
        if ($scope.messageEvents[i] && $scope.messageEvents[i].new_message_delim) {
          $scope.messageEvents.splice(i, 1);
        }
      });
    };

    $scope.$watch(`newMessagesCount['${correspondent.device_address}']`, () => {
      if (!$scope.newMsgCounterEnabled && $state.is('correspondentDevices.correspondentDevice')) {
        $scope.newMessagesCount[$scope.correspondent.device_address] = 0;
      }
    });

    $scope.$on('$stateChangeStart', (evt, toState) => {
      if (toState.name === 'correspondentDevices.correspondentDevice') {
        $scope.index.tab = 'chat';
        $rootScope.tab = $scope.index.tab;
        $scope.newMessagesCount[correspondentListService.currentCorrespondent.device_address] = 0;
      } else {
        removeNewMessagesDelim();
      }
    });

    $scope.send = function () {
      $scope.error = null;
      if (!$scope.message) {
        return;
      }
      setOngoingProcess('sending');
      const message = lodash.clone($scope.message); // save in var as $scope.message may disappear while we are sending the message over the network
      device.sendMessageToDevice(correspondent.device_address, 'text', message, {
        ifOk() {
          setOngoingProcess();
          // $scope.messageEvents.push({bIncoming: false, message: $sce.trustAsHtml($scope.message)});
          $scope.autoScrollEnabled = true;
          const msgObj = {
            bIncoming: false,
            message: correspondentListService.formatOutgoingMessage(message),
            timestamp: Math.floor(Date.now() / 1000),
          };
          correspondentListService.checkAndInsertDate($scope.messageEvents, msgObj);
          $scope.messageEvents.push(msgObj);
          $scope.message = '';
          $scope.$apply();
          if (correspondent.my_record_pref && correspondent.peer_record_pref) chatStorage.store(correspondent.device_address, message, 0);
        },
        ifError(error) {
          setOngoingProcess();
          setError(error);
        },
      });
    };

    $scope.insertMyAddress = function () {
      if (!profileService.focusedClient.credentials.isComplete()) {
        return $rootScope.$emit('Local/ShowErrorAlert', 'The wallet is not approved yet');
      }
      return readMyPaymentAddress(appendMyPaymentAddress);
    };

    $scope.requestPayment = function () {
      if (!profileService.focusedClient.credentials.isComplete()) {
        return $rootScope.$emit('Local/ShowErrorAlert', 'The wallet is not approved yet');
      }
      return readMyPaymentAddress(showRequestPaymentModal);
    };

    $scope.sendPayment = function (address, amount, asset) {
      console.log(`will send payment to ${address}`);
      if (asset && $scope.index.arrBalances.filter(balance => (balance.asset === asset)).length === 0) {
        console.log(`i do not own anything of asset ${asset}`);
        return;
      }
      backButton.dontDeletePath = true;
      go.send(() => {
        // $rootScope.$emit('Local/SetTab', 'send', true);
        $rootScope.$emit('paymentRequest', address, amount, asset, correspondent.device_address);
      });
    };

    $scope.showPayment = function (asset) {
      console.log(`will show payment in asset ${asset}`);
      if (!asset) {
        throw Error('no asset in showPayment');
      }
      if (asset && $scope.index.arrBalances.filter(balance => (balance.asset === asset)).length === 0) {
        console.log(`i do not own anything of asset ${asset}`);
        return;
      }
      const assetIndex = lodash.findIndex($scope.index.arrBalances, { asset });
      if (assetIndex < 0) {
        throw Error(`failed to find asset index of asset ${asset}`);
      }
      $scope.index.assetIndex = assetIndex;
      go.history();
    };


    $scope.offerContract = function (address) {
      const walletDefinedByAddresses = require('byteballcore/wallet_defined_by_addresses.js');
      $rootScope.modalOpened = true;
      const fc = profileService.focusedClient;

      const ModalInstanceCtrl = function ($scopeModal, $modalInstance) {
        const config = configService.getSync();
        const configWallet = config.wallet;
        const walletSettings = configWallet.settings;
        $scopeModal.unitValue = walletSettings.unitValue;
        $scopeModal.unitName = walletSettings.unitName;
        $scopeModal.color = fc.backgroundColor;
        $scopeModal.bWorking = false;
        $scopeModal.arrRelations = ['=', '>', '<', '>=', '<=', '!='];
        $scopeModal.arrParties = [{ value: 'me', display_value: 'me' }, { value: 'peer', display_value: 'the peer' }];
        $scopeModal.arrPeerPaysTos = [{ value: 'me', display_value: 'me' }, {
          value: 'contract',
          display_value: 'this contract',
        }];
        $scopeModal.arrAssetInfos = indexScope.arrBalances.map((b) => {
          const info = { asset: b.asset, is_private: b.is_private };
          if (b.asset === 'base') {
            info.displayName = walletSettings.unitName;
          } else if (b.asset === constants.BLACKBYTES_ASSET) {
            info.displayName = walletSettings.bbUnitName;
          } else if (b.asset === constants.DAGCOIN_ASSET) {
            info.displayName = walletSettings.dagUnitName;
          } else {
            info.displayName = `of ${b.asset.substr(0, 4)}`;
          }
          return info;
        });
        $scopeModal.arrPublicAssetInfos = $scopeModal.arrAssetInfos.filter(b => !b.is_private);
        const contract = {
          timeout: 4,
          myAsset: 'base',
          peerAsset: 'base',
          peer_pays_to: 'contract',
          relation: '>',
          expiry: 7,
          data_party: 'me',
          expiry_party: 'peer',
        };
        $scopeModal.contract = contract;


        $scopeModal.onDataPartyUpdated = function () {
          console.log('onDataPartyUpdated');
          contract.expiry_party = (contract.data_party === 'me') ? 'peer' : 'me';
        };

        $scopeModal.onExpiryPartyUpdated = function () {
          console.log('onExpiryPartyUpdated');
          contract.data_party = (contract.expiry_party === 'me') ? 'peer' : 'me';
        };


        $scopeModal.payAndOffer = function () {
          console.log('payAndOffer');
          $scopeModal.error = '';

          if (fc.isPrivKeyEncrypted()) {
            profileService.unlockFC(null, (err) => {
              if (err) {
                $scopeModal.error = err.message;
                $scopeModal.$apply();
                return;
              }
              $scopeModal.payAndOffer();
            });
            return;
          }

          profileService.requestTouchid((err) => {
            if (err) {
              profileService.lockFC();
              $scopeModal.error = err;
              $timeout(() => {
                $scopeModal.$digest();
              }, 1);
              return null;
            }

            if ($scopeModal.bWorking) {
              return console.log('already working');
            }

            let myAmount = contract.myAmount;
            if (contract.myAsset === 'base') {
              myAmount *= walletSettings.unitValue;
            }
            if (contract.myAsset === constants.BLACKBYTES_ASSET) {
              myAmount *= walletSettings.bbUnitValue;
            }
            if (contract.myAsset === constants.DAGCOIN_ASSET) {
              myAmount *= walletSettings.dagUnitValue;
            }
            myAmount = Math.round(myAmount);

            let peerAmount = contract.peerAmount;
            if (contract.peerAsset === 'base') {
              peerAmount *= walletSettings.unitValue;
            }
            if (contract.peerAsset === constants.BLACKBYTES_ASSET) {
              throw Error('peer asset cannot be blackbytes');
            }
            peerAmount = Math.round(peerAmount);

            if (myAmount === peerAmount && contract.myAsset === contract.peerAsset && contract.peer_pays_to === 'contract') {
              $scopeModal.error = `The amounts are equal, you cannot require the peer to pay to the contract.  
              Please either change the amounts slightly or fund the entire contract yourself and require the peer to pay his half to you.`;
              $timeout(() => {
                $scopeModal.$digest();
              }, 1);
              return null;
            }

            const fnReadMyAddress = (contract.peer_pays_to === 'contract') ? readMyPaymentAddress : issueNextAddress;
            fnReadMyAddress((myAddress) => {
              const arrSeenCondition = ['seen', {
                what: 'output',
                address: (contract.peer_pays_to === 'contract') ? 'this address' : myAddress,
                asset: contract.peerAsset,
                amount: peerAmount,
              }];
              readLastMainChainIndex((errorMci, lastMci) => {
                if (errorMci) {
                  $scopeModal.error = errorMci;
                  $timeout(() => {
                    $scopeModal.$digest();
                  }, 1);
                  return;
                }
                const arrExplicitEventCondition =
                  ['in data feed', [[contract.oracle_address], contract.feed_name, contract.relation, `${contract.feed_value}`, lastMci]];
                const arrEventCondition = arrExplicitEventCondition;
                const dataAddress = (contract.data_party === 'me') ? myAddress : address;
                const expiryAddress = (contract.expiry_party === 'me') ? myAddress : address;
                const dataDeviceAddress = (contract.data_party === 'me') ? device.getMyDeviceAddress() : correspondent.device_address;
                const expiryDeviceAddress = (contract.expiry_party === 'me') ? device.getMyDeviceAddress() : correspondent.device_address;
                const arrDefinition = ['or', [
                  ['and', [
                    arrSeenCondition,
                    ['or', [
                      ['and', [
                        ['address', dataAddress],
                        arrEventCondition,
                      ]],
                      ['and', [
                        ['address', expiryAddress],
                        ['in data feed', [[configService.TIMESTAMPER_ADDRESS], 'timestamp', '>', Date.now() + Math.round(contract.expiry * 24 * 3600 * 1000)]],
                      ]],
                    ]],
                  ]],
                  ['and', [
                    ['address', myAddress],
                    ['not', arrSeenCondition],
                    ['in data feed', [[configService.TIMESTAMPER_ADDRESS], 'timestamp', '>', Date.now() + Math.round(contract.timeout * 3600 * 1000)]],
                  ]],
                ]];
                const assocSignersByPath = {
                  'r.0.1.0.0': {
                    address: dataAddress,
                    member_signing_path: 'r',
                    device_address: dataDeviceAddress,
                  },
                  'r.0.1.1.0': {
                    address: expiryAddress,
                    member_signing_path: 'r',
                    device_address: expiryDeviceAddress,
                  },
                  'r.1.0': {
                    address: myAddress,
                    member_signing_path: 'r',
                    device_address: device.getMyDeviceAddress(),
                  },
                };
                walletDefinedByAddresses.createNewSharedAddress(arrDefinition, assocSignersByPath, {
                  ifError(errNsa) {
                    $scopeModal.bWorking = false;
                    $scopeModal.error = errNsa;
                    $timeout(() => {
                      $scopeModal.$digest();
                    });
                  },
                  ifOk(sharedAddress) {
                    composeAndSend(sharedAddress, arrDefinition, assocSignersByPath, myAddress);
                  },
                });
              });
            });

            // compose and send
            function composeAndSend(sharedAddress, arrDefinition, assocSignersByPath, myAddress) {
              let arrSigningDeviceAddresses = []; // empty list means that all signatures are required (such as 2-of-2)
              if (fc.credentials.m < fc.credentials.n) {
                indexScope.copayers.forEach((copayer) => {
                  if (copayer.me || copayer.signs) {
                    arrSigningDeviceAddresses.push(copayer.device_address);
                  }
                });
              } else if (indexScope.shared_address) {
                arrSigningDeviceAddresses = indexScope.copayers.map(copayer => copayer.device_address);
              }
              profileService.bKeepUnlocked = true;
              const opts = {
                shared_address: indexScope.shared_address,
                asset: contract.myAsset,
                to_address: sharedAddress,
                amount: myAmount,
                arrSigningDeviceAddresses,
                recipient_device_address: correspondent.device_address,
              };
              fc.sendMultiPayment(opts, (errSmp) => {
                // if multisig, it might take very long before the callback is called
                // self.setOngoingProcess();
                $scopeModal.bWorking = false;
                let errorMsg = errSmp;
                profileService.bKeepUnlocked = false;
                if (errorMsg) {
                  if (errorMsg.match(/device address/)) {
                    errorMsg = 'This is a private asset, please send it only by clicking links from chat';
                  }
                  if (errorMsg.match(/no funded/)) {
                    errorMsg = 'Not enough confirmed funds';
                  }
                  if ($scopeModal) {
                    $scopeModal.error = errorMsg;
                  }
                  return;
                }
                $rootScope.$emit('NewOutgoingTx');
                eventBus.emit('sent_payment', correspondent.device_address, myAmount, contract.myAsset);
                let paymentRequestCode;
                if (contract.peer_pays_to === 'contract') {
                  const arrPayments = [{ address: sharedAddress, amount: peerAmount, asset: contract.peerAsset }];
                  const assocDefinitions = {};
                  assocDefinitions[sharedAddress] = {
                    definition: arrDefinition,
                    signers: assocSignersByPath,
                  };
                  const objPaymentRequest = { payments: arrPayments, definitions: assocDefinitions };
                  const paymentJson = JSON.stringify(objPaymentRequest);
                  const paymentJsonBase64 = Buffer(paymentJson).toString('base64');
                  paymentRequestCode = `payment:${paymentJsonBase64}`;
                } else {
                  paymentRequestCode = `byteball:${myAddress}?amount=${peerAmount}&asset=${encodeURIComponent(contract.peerAsset)}`;
                }
                const paymentRequestText = `[your share of payment to the contract](${paymentRequestCode})`;
                device.sendMessageToDevice(correspondent.device_address, 'text', paymentRequestText);
                correspondentListService.messageEventsByCorrespondent[correspondent.device_address].push({
                  bIncoming: false,
                  message: correspondentListService.formatOutgoingMessage(paymentRequestText),
                });
                if (contract.peer_pays_to === 'me') {
                  issueNextAddress();
                } // make sure the address is not reused
              });
              $modalInstance.dismiss('cancel');
            }
            return null;
          });
        }; // payAndOffer


        $scopeModal.cancel = function () {
          $modalInstance.dismiss('cancel');
        };
      };

      const modalInstance = $modal.open({
        templateUrl: 'views/modals/offer-contract.html',
        windowClass: animationService.modalAnimated.slideUp,
        controller: ['$scope', '$modalInstance', ModalInstanceCtrl],
        scope: $scope,
      });

      const disableCloseModal = $rootScope.$on('closeModal', () => {
        modalInstance.dismiss('cancel');
      });

      modalInstance.result.finally(() => {
        $rootScope.modalOpened = false;
        disableCloseModal();
        const m = angular.element(document.getElementsByClassName('reveal-modal'));
        m.addClass(animationService.modalAnimated.slideOutDown);
      });
    };


    $scope.sendMultiPayment = function (paymentJsonBase64) {
      const async = require('async');
      const db = require('byteballcore/db.js');
      const walletDefinedByAddresses = require('byteballcore/wallet_defined_by_addresses.js');
      const paymentJson = Buffer(paymentJsonBase64, 'base64').toString('utf8');
      console.log(`multi ${paymentJson}`);
      const objMultiPaymentRequest = JSON.parse(paymentJson);
      $rootScope.modalOpened = true;
      const fc = profileService.focusedClient;
      const ModalInstanceCtrl = function ($scopeModal, $modalInstance) {
        const config = configService.getSync();
        const configWallet = config.wallet;
        const walletSettings = configWallet.settings;
        $scopeModal.unitValue = walletSettings.unitValue;
        $scopeModal.unitName = walletSettings.unitName;
        $scopeModal.color = fc.backgroundColor;
        $scopeModal.bDisabled = true;
        const assocSharedDestinationAddresses = {};
        const createMovementLines = function () {
          $scopeModal.arrMovements = objMultiPaymentRequest.payments.map((objPayment) => {
            let text = `${correspondentListService.getAmountText(objPayment.amount, objPayment.asset || 'base')} to ${objPayment.address}`;
            if (assocSharedDestinationAddresses[objPayment.address]) {
              text += ' (smart address, see below)';
            }
            return text;
          });
        };
        if (objMultiPaymentRequest.definitions) {
          let arrAllMemberAddresses = [];
          const arrFuncs = [];
          const assocMemberAddressesByDestAddress = {};
          Object.keys(objMultiPaymentRequest.definitions).forEach((destinationAddress) => {
            const ad = objMultiPaymentRequest.definitions[destinationAddress].definition;
            const arrMemberAddresses = extractAddressesFromDefinition(ad);
            assocMemberAddressesByDestAddress[destinationAddress] = arrMemberAddresses;
            arrAllMemberAddresses = arrAllMemberAddresses.concat(arrMemberAddresses);
            arrFuncs.push((cb) => {
              walletDefinedByAddresses.validateAddressDefinition(ad, cb);
            });
          });
          arrAllMemberAddresses = lodash.uniq(arrAllMemberAddresses);
          if (arrAllMemberAddresses.length === 0) {
            throw Error(`no member addresses in ${paymentJson}`);
          }
          const findMyAddresses = function (cb) {
            db.query(
              'SELECT address FROM my_addresses WHERE address IN(?) \n\ ' +
              'UNION \n\ ' +
              'SELECT shared_address AS address FROM shared_addresses WHERE shared_address IN(?)',
              [arrAllMemberAddresses, arrAllMemberAddresses],
              (rows) => {
                const arrMyAddresses = rows.map(row => row.address);
                Object.keys(assocMemberAddressesByDestAddress).forEach((destinationAddress) => {
                  const arrMemberAddresses = assocMemberAddressesByDestAddress[destinationAddress];
                  if (lodash.intersection(arrMemberAddresses, arrMyAddresses).length > 0) {
                    assocSharedDestinationAddresses[destinationAddress] = true;
                  }
                });
                createMovementLines();
                $scopeModal.arrHumanReadableDefinitions = [];
                Object.keys(objMultiPaymentRequest.definitions).forEach((da) => {
                  const arrDef = objMultiPaymentRequest.definitions[da].definition;
                  $scopeModal.arrHumanReadableDefinitions.push({
                    destinationAddress: da,
                    humanReadableDefinition: correspondentListService.getHumanReadableDefinition(arrDef, arrMyAddresses, []),
                  });
                });
                cb();
              });
          };
          arrFuncs.push(findMyAddresses);
          async.series(arrFuncs, (err) => {
            if (err) {
              $scopeModal.error = err;
            } else {
              $scopeModal.bDisabled = false;
            }
            $scopeModal.$apply();
          });
        } else {
          $scopeModal.bDisabled = false;
        }

        function insertSharedAddress(sharedAddress, arrDefinitionSa, signers, cb) {
          db.query('SELECT 1 FROM shared_addresses WHERE shared_address=?', [sharedAddress], (rows) => {
            if (rows.length > 0) {
              console.log(`shared address ${sharedAddress} already known`);
              return cb();
            }
            return walletDefinedByAddresses.handleNewSharedAddress({
              address: sharedAddress,
              definition: arrDefinitionSa,
              signers,
            }, {
              ifOk: cb,
              ifError(err) {
                throw Error(`failed to create shared address ${sharedAddress}: ${err}`);
              },
            });
          });
        }


        $scopeModal.pay = function () {
          console.log('pay');

          if (fc.isPrivKeyEncrypted()) {
            profileService.unlockFC(null, (err) => {
              if (err) {
                $scopeModal.error = err.message;
                $scopeModal.$apply();
                return;
              }
              $scopeModal.pay();
            });
            return;
          }

          profileService.requestTouchid((err) => {
            if (err) {
              profileService.lockFC();
              $scopeModal.error = err;
              $timeout(() => {
                $scopeModal.$digest();
              }, 1);
              return;
            }

            // create shared addresses
            const arrFuncs = [];
            Object.keys(assocSharedDestinationAddresses).forEach((destinationAddress) => {
              (function () { // use self-invoking function to isolate scope of da and make it different in different iterations
                const da = destinationAddress;
                arrFuncs.push((cb) => {
                  const objDefinitionAndSigners = objMultiPaymentRequest.definitions[da];
                  insertSharedAddress(da, objDefinitionAndSigners.definition, objDefinitionAndSigners.signers, cb);
                });
              }());
            });
            async.series(arrFuncs, () => {
              // shared addresses inserted, now pay
              const assocOutputsByAsset = {};
              objMultiPaymentRequest.payments.forEach((objPayment) => {
                const asset = objPayment.asset || 'base';
                if (!assocOutputsByAsset[asset]) {
                  assocOutputsByAsset[asset] = [];
                }
                assocOutputsByAsset[asset].push({ address: objPayment.address, amount: objPayment.amount });
              });
              const arrNonBaseAssets = Object.keys(assocOutputsByAsset).filter(asset => (asset !== 'base'));
              if (arrNonBaseAssets.length > 1) {
                $scopeModal.error = 'more than 1 non-base asset not supported';
                $scopeModal.$apply();
                return;
              }
              const asset = (arrNonBaseAssets.length > 0) ? arrNonBaseAssets[0] : null;
              const arrBaseOutputs = assocOutputsByAsset.base || [];
              const arrAssetOutputs = asset ? assocOutputsByAsset[asset] : null;
              let arrSigningDeviceAddresses = []; // empty list means that all signatures are required (such as 2-of-2)
              if (fc.credentials.m < fc.credentials.n) {
                indexScope.copayers.forEach((copayer) => {
                  if (copayer.me || copayer.signs) {
                    arrSigningDeviceAddresses.push(copayer.device_address);
                  }
                });
              } else if (indexScope.shared_address) {
                arrSigningDeviceAddresses = indexScope.copayers.map(copayer => copayer.device_address);
              }
              const currentMultiPaymentKey = require('crypto').createHash('sha256').update(paymentJson).digest('base64');
              if (currentMultiPaymentKey === indexScope.current_multi_payment_key) {
                $rootScope.$emit('Local/ShowErrorAlert', 'This payment is already under way');
                $modalInstance.dismiss('cancel');
                return;
              }
              indexScope.current_multi_payment_key = currentMultiPaymentKey;
              const recipientDeviceAddress = lodash.clone(correspondent.device_address);
              fc.sendMultiPayment({
                asset,
                arrSigningDeviceAddresses,
                recipient_device_address: recipientDeviceAddress,
                base_outputs: arrBaseOutputs,
                asset_outputs: arrAssetOutputs,
              }, (errSmp) => { // can take long if multisig
                delete indexScope.current_multi_payment_key;
                if (errSmp) {
                  if (chatScope) {
                    setError(errSmp);
                    chatScope.$apply();
                  }
                  return;
                }
                $rootScope.$emit('NewOutgoingTx');
                const assocPaymentsByAsset = correspondentListService.getPaymentsByAsset(objMultiPaymentRequest);
                Object.keys(assocPaymentsByAsset).forEach((ass) => {
                  eventBus.emit('sent_payment', recipientDeviceAddress, assocPaymentsByAsset[ass], ass);
                });
              });
              $modalInstance.dismiss('cancel');
            });
          });
        }; // pay


        $scopeModal.cancel = function () {
          $modalInstance.dismiss('cancel');
        };
      };

      function extractAddressesFromDefinition(arrDefinition) {
        const assocAddresses = {};

        function parse(arrSubdefinition) {
          const op = arrSubdefinition[0];
          switch (op) {
            case 'address':
            case 'cosigned by':
              assocAddresses[arrSubdefinition[1]] = true;
              break;
            case 'or':
            case 'and':
              arrSubdefinition[1].forEach(parse);
              break;
            case 'r of set':
              arrSubdefinition[1].set.forEach(parse);
              break;
            case 'weighted and':
              arrSubdefinition[1].set.forEach((arg) => {
                parse(arg.value);
              });
              break;
            default:
              break;
          }
        }

        parse(arrDefinition);
        return Object.keys(assocAddresses);
      }

      const modalInstance = $modal.open({
        templateUrl: 'views/modals/multi-payment.html',
        windowClass: animationService.modalAnimated.slideUp,
        controller: ['$scope', '$modalInstance', ModalInstanceCtrl],
        scope: $scope,
      });

      const disableCloseModal = $rootScope.$on('closeModal', () => {
        modalInstance.dismiss('cancel');
      });

      modalInstance.result.finally(() => {
        $rootScope.modalOpened = false;
        disableCloseModal();
        const m = angular.element(document.getElementsByClassName('reveal-modal'));
        m.addClass(animationService.modalAnimated.slideOutDown);
      });
    };


    // send a command to the bot
    $scope.sendCommand = function (command) {
      console.log(`will send command ${command}`);
      $scope.message = command;
      $scope.send();
    };

    $scope.openExternalLink = function (url) {
      if (typeof nw !== 'undefined') {
        nw.Shell.openExternal(url);
      } else if (isCordova) {
        cordova.InAppBrowser.open(url, '_system');
      }
    };

    $scope.editCorrespondent = function () {
      go.path('correspondentDevices.editCorrespondentDevice');
    };

    $scope.loadMoreHistory = function (cb) {
      correspondentListService.loadMoreHistory(correspondent, cb);
    };

    $scope.autoScrollEnabled = true;
    $scope.loadMoreHistory(() => {
      let message;
      Object.keys($scope.messageEvents).forEach((i) => {
        if (!message || !message.chat_recording_status) {
          message = $scope.messageEvents[i];
        }
      });
      if (message && message.chat_recording_status) {
        return;
      }
      breadcrumbs.add(`correspondent with empty chat opened: ${correspondent.device_address}`);
      message = {
        type: 'system',
        bIncoming: false,
        message: JSON.stringify({ state: (!!(correspondent.peer_record_pref && correspondent.my_record_pref)) }),
        timestamp: Math.floor(+new Date() / 1000),
        chat_recording_status: true,
      };
      chatStorage.store(correspondent.device_address, message.message, 0, 'system');
      $scope.messageEvents.push(correspondentListService.parseMessage(message));
    });

    function setError(error) {
      console.log('send error:', error);
      $scope.error = error;
    }

    function readLastMainChainIndex(cb) {
      if (conf.bLight) {
        const network = require('byteballcore/network.js');
        network.requestFromLightVendor('get_last_mci', null, (ws, request, responseFlv) => {
          if (responseFlv.error) {
            cb(responseFlv.error);
          } else {
            cb(null, responseFlv);
          }
        });
      } else {
        storage.readLastMainChainIndex((lastMci) => {
          cb(null, lastMci);
        });
      }
    }

    function readMyPaymentAddress(cb) {
      if (indexScope.shared_address) {
        return cb(indexScope.shared_address);
      }
      addressService.getAddress(profileService.focusedClient.credentials.walletId, false, (err, address) => cb(address));
      return null;
    }

    function issueNextAddress(cb) {
      const walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
      walletDefinedByKeys.issueNextAddress(profileService.focusedClient.credentials.walletId, 0, (addressInfo) => {
        if (cb) {
          cb(addressInfo.address);
        }
      });
    }

    /*
      function issueNextAddressIfNecessary(onDone){
          if (myPaymentAddress) // do not issue new address
              return onDone();
          var walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
          walletDefinedByKeys.issueOrSelectNextAddress(fc.credentials.walletId, 0, function(addressInfo){
              myPaymentAddress = addressInfo.address; // cache it in case we need to insert again
              onDone();
              $scope.$apply();
          });
      } */

    function appendText(text) {
      if (!$scope.message) {
        $scope.message = '';
      }
      if ($scope.message && $scope.message.charAt($scope.message.length - 1) !== ' ') {
        $scope.message += ' ';
      }
      $scope.message += text;
      $scope.message += ' ';
      if (!document.chatForm || !document.chatForm.message) { // already gone
        return;
      }
      const msgField = document.chatForm.message;
      msgField.focus();
      msgField.selectionEnd = msgField.value.length;
      msgField.selectionStart = msgField.selectionEnd;
    }

    function appendMyPaymentAddress(myPaymentAddress) {
      appendText(myPaymentAddress);
    }

    function showRequestPaymentModal(myPaymentAddress) {
      $rootScope.modalOpened = true;
      const fc = profileService.focusedClient;
      const ModalInstanceCtrl = function ($scopeModal, $modalInstance) {
        const config = configService.getSync();
        const configWallet = config.wallet;
        const walletSettings = configWallet.settings;
        $scopeModal.unitValue = walletSettings.unitValue;
        $scopeModal.unitName = walletSettings.unitName;
        $scopeModal.bbUnitValue = walletSettings.bbUnitValue;
        $scopeModal.bbUnitName = walletSettings.bbUnitName;
        $scopeModal.dagUnitName = walletSettings.dagUnitName;
        $scopeModal.dagUnitValue = walletSettings.dagUnitValue;
        $scopeModal.color = fc.backgroundColor;
        $scopeModal.isCordova = isCordova;
        $scopeModal.buttonLabel = 'Request payment';
        // $scopeModal.selectedAsset = $scopeModal.index.arrBalances[$scopeModal.index.assetIndex];
        // console.log($scopeModal.index.arrBalances.length+" assets, current: "+$scopeModal.asset);

        Object.defineProperty($scopeModal,
          '_customAmount', {
            get() {
              return $scopeModal.customAmount;
            },
            set(newValue) {
              $scopeModal.customAmount = newValue;
            },
            enumerable: true,
            configurable: true,
          });

        $scopeModal.submitForm = function (form) {
          if ($scopeModal.index.arrBalances.length === 0) {
            return console.log('showRequestPaymentModal: no balances yet');
          }
          const amount = form.amount.$modelValue;
          // var asset = form.asset.$modelValue;
          const asset = $scopeModal.index.arrBalances[$scopeModal.index.assetIndex].asset;
          if (!asset) {
            throw Error('no asset');
          }
          let amountInSmallestUnits;
          if (asset === 'base') {
            amountInSmallestUnits = parseInt((amount * $scopeModal.unitValue).toFixed(0), 10);
          } else if (asset === constants.BLACKBYTES_ASSET) {
            amountInSmallestUnits = parseInt((amount * $scopeModal.bbUnitValue).toFixed(0), 10);
          } else if (asset === constants.DAGCOIN_ASSET) {
            amountInSmallestUnits = amount * $scopeModal.dagUnitValue;
          } else {
            amountInSmallestUnits = amount;
          }
          let params = `amount=${amountInSmallestUnits}`;
          if (asset !== 'base') {
            params += `&asset=${encodeURIComponent(asset)}`;
          }
          let units;
          if (asset === 'base') {
            units = $scopeModal.unitName;
          } else if (asset === constants.BLACKBYTES_ASSET) {
            units = $scopeModal.bbUnitName;
          } else if (asset === constants.DAGCOIN_ASSET) {
            units = $scopeModal.dagUnitName;
          } else {
            units = `of ${asset}`;
          }
          appendText(`[${amount} ${units}](byteball:${myPaymentAddress}?${params})`);
          return $modalInstance.dismiss('cancel');
        };

        $scopeModal.cancel = function () {
          $modalInstance.dismiss('cancel');
        };
      };

      const modalInstance = $modal.open({
        templateUrl: 'views/modals/customized-amount.html',
        windowClass: animationService.modalAnimated.slideUp,
        controller: ['$scope', '$modalInstance', ModalInstanceCtrl],
        scope: $scope,
      });

      const disableCloseModal = $rootScope.$on('closeModal', () => {
        modalInstance.dismiss('cancel');
      });

      modalInstance.result.finally(() => {
        $rootScope.modalOpened = false;
        disableCloseModal();
        const m = angular.element(document.getElementsByClassName('reveal-modal'));
        m.addClass(animationService.modalAnimated.slideOutDown);
      });
    }

    function setOngoingProcess(name) {
      if (isCordova) {
        if (name) {
          window.plugins.spinnerDialog.hide();
          window.plugins.spinnerDialog.show(null, `${name}...`, true);
        } else {
          window.plugins.spinnerDialog.hide();
        }
      } else {
        $scope.onGoingProcess = name;
        $timeout(() => {
          $rootScope.$apply();
        });
      }
    }

    $scope.goToCorrespondentDevices = function () {
      $deepStateRedirect.reset('correspondentDevices');
      go.path('correspondentDevices');
    };
  });
