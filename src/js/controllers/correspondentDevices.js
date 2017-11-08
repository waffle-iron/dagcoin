(function () {
  'use strict';

  angular.module('copayApp.controllers').controller('correspondentDevicesController',
    ($scope, $timeout, configService, profileService, go, correspondentListService, $state, $rootScope) => {
      const wallet = require('byteballcore/wallet.js');
      const constants = require('byteballcore/constants.js');
      const isTestnet = constants.version.match(/t$/);
      $scope.editCorrespondentList = false;
      $scope.selectedCorrespondentList = {};
      const fc = profileService.focusedClient;
      $scope.backgroundColor = fc.backgroundColor;

      $scope.state = $state;

      $scope.hideRemove = true;

      let listScrollTop = 0;

      $scope.$on('$stateChangeStart', (evt, toState) => {
        if (toState.name === 'correspondentDevices') {
          $scope.readList();
          $rootScope.$emit('Local/SetTab', 'chat', true);
          setTimeout(() => {
            document.querySelector('[ui-view=chat]').scrollTop = listScrollTop;
          }, 5);
        }
      });

      $scope.showCorrespondent = function (correspondent) {
        console.log('showCorrespondent', correspondent);
        correspondentListService.currentCorrespondent = correspondent;
        listScrollTop = document.querySelector('[ui-view=chat]').scrollTop;
        go.path('correspondentDevices.correspondentDevice');
      };

      $scope.toggleEditCorrespondentList = function () {
        $scope.editCorrespondentList = !$scope.editCorrespondentList;
        $scope.selectedCorrespondentList = {};
      };

      $scope.toggleSelectCorrespondentList = function (addr) {
        $scope.selectedCorrespondentList[addr] = !$scope.selectedCorrespondentList[addr];
      };

      $scope.newMsgByAddressComparator = function (correspondent) {
        return (-$scope.newMessagesCount[correspondent.device_address] || correspondent.name.toLowerCase());
      };

      $scope.beginAddCorrespondent = function () {
        console.log('beginAddCorrespondent');
        listScrollTop = document.querySelector('[ui-view=chat]').scrollTop;
        $state.go('correspondentDevices.addCorrespondentDevice');
      };


      $scope.readList = function () {
        $scope.error = null;
        correspondentListService.list((err, ab) => {
          if (err) {
            $scope.error = err;
            return;
          }
          wallet.readDeviceAddressesUsedInSigningPaths((arrNotRemovableDeviceAddresses) => {
            // adding manually discovery service, because it doesn't exists in signing paths
            const discoveryDeviceAddress = isTestnet ? '06HM3M45WJYU7EXIXWCYAKPXQS32ZNR6X' :
                                                       '0EPKJTMDEB5RUCOHTL77LHPR5K6KV3G7V';
            arrNotRemovableDeviceAddresses.push(discoveryDeviceAddress);
            // add a new property indicating whether the device can be removed or not
            const length = ab.length;
            for (let i = 0; i < length; i += 1) {
              const corrDev = ab[i];
              const ix = arrNotRemovableDeviceAddresses.indexOf(corrDev.device_address);
              // device is removable when not in list
              corrDev.removable = (ix === -1);
            }
            $scope.list = ab;
            $scope.$digest();
          });
        });
      };

      $scope.hideRemoveButton = function (removable) {
        return $scope.hideRemove || !removable;
      };

      $scope.remove = function (deviceAddress) {
        // check to be safe
        wallet.determineIfDeviceCanBeRemoved(deviceAddress, (bRemovable) => {
          if (!bRemovable) {
            return console.log(`device ${deviceAddress} is not removable`);
          }
          const device = require('byteballcore/device.js');

          // send message to paired device
          // this must be done before removing the device
          device.sendMessageToDevice(deviceAddress, 'removed_paired_device', 'removed');

          // remove device
          device.removeCorrespondentDevice(deviceAddress, () => {
            $scope.hideRemove = true;
            $scope.readList();
            $rootScope.$emit('Local/SetTab', 'chat', true);
            setTimeout(() => {
              document.querySelector('[ui-view=chat]').scrollTop = listScrollTop;
            }, 5);
          });
        });
      };

      $scope.cancel = function () {
        console.log('cancel clicked');
        go.walletHome();
      };
    });
}());
