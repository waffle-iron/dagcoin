/* global angular */
// todo: disabled no-unused-vars for makeSwipeDirective method because currently we are not using directive. in future it might be removed
/* eslint-disable no-unused-vars,no-shadow,no-undef */

(() => {
  'use strict';

  const breadcrumbs = require('byteballcore/breadcrumbs.js');

  /**
   * @desc qr-code scanner directive
   * @example <qr-scanner></qr-scanner>
   */
  angular
    .module('copayApp.directives')
    .directive('qrScanner', qrScanner);

  qrScanner.$inject = ['$rootScope', '$timeout', '$modal', 'isCordova', 'gettextCatalog'];

  function qrScanner($rootScope, $timeout, $modal, isCordova, gettextCatalog) {
    return {
      restrict: 'E',
      scope: {
        onScan: '&',
        beforeScan: '&',
      },
      controller: ($scope) => {
        $scope.cordovaOpenScanner = function () {
          window.ignoreMobilePause = true;
          window.plugins.spinnerDialog.show(null, gettextCatalog.getString('Preparing camera...'), true);
          $timeout(() => {
            cordova.plugins.barcodeScanner.scan(
              (result) => {
                $timeout(() => {
                  window.plugins.spinnerDialog.hide();
                  window.ignoreMobilePause = false;
                }, 100);
                if (result.cancelled) return;

                $timeout(() => {
                  const data = result.text;
                  $scope.onScan({ data });
                }, 1000);
              },
              (error) => {
                $timeout(() => {
                  window.ignoreMobilePause = false;
                  window.plugins.spinnerDialog.hide();
                }, 100);
                alert('Scanning error');
              });
            if ($scope.beforeScan) {
              $scope.beforeScan();
            }
          }, 100);
        };

        $scope.modalOpenScanner = function () {
          const parentScope = $scope;
          const ModalInstanceCtrl = function ($scope, $rootScope, $modalInstance) {
            // QR code Scanner
            let video;
            let canvas;
            let $video;
            let context;
            let localMediaStream;
            let prevResult;

            const scan = function (evt) {
              if (localMediaStream) {
                context.drawImage(video, 0, 0, 300, 225);
                try {
                  qrcode.decode();
                } catch (e) {
                  // qrcodeError(e);
                }
              }
              $timeout(scan, 800);
            };

            const scanStop = function () {
              if (localMediaStream && localMediaStream.active) {
                const localMediaStreamTrack = localMediaStream.getTracks();
                for (let i = 0; i < localMediaStreamTrack.length; i += 1) {
                  localMediaStreamTrack[i].stop();
                }
              } else {
                try {
                  localMediaStream.stop();
                } catch (e) {
                  // Older Chromium not support the STOP function
                }
              }
              localMediaStream = null;
              if (video) {
                video.src = '';
              }
            };

            qrcode.callback = function (data) {
              if (prevResult !== data) {
                prevResult = data;
                return;
              }
              scanStop();
              $modalInstance.close(data);
            };

            const successCallback = function (stream) {
              video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
              localMediaStream = stream;
              video.play();
              $timeout(scan, 1000);
            };

            const videoError = function (err) {
              breadcrumbs.add('qr scanner video error');
              $scope.cancel();
            };

            const setScanner = function () {
              navigator.getUserMedia = navigator.getUserMedia ||
                navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
                navigator.msGetUserMedia;
              window.URL = window.URL || window.webkitURL ||
                window.mozURL || window.msURL;
            };

            $scope.init = function () {
              setScanner();
              $timeout(() => {
                if (parentScope.beforeScan) {
                  parentScope.beforeScan();
                }
                canvas = document.getElementById('qr-canvas');
                if (!canvas) {
                  return;
                }
                context = canvas.getContext('2d');

                video = document.getElementById('qrcode-scanner-video');
                $video = angular.element(video);
                canvas.width = 300;
                canvas.height = 225;
                context.clearRect(0, 0, 300, 225);

                navigator.getUserMedia({
                  video: true,
                }, successCallback, videoError);
              }, 500);
            };

            $scope.cancel = function () {
              breadcrumbs.add('qr scanner cancel');
              scanStop();
              try {
                $modalInstance.dismiss('cancel');
              } catch (e) {
                e.bIgnore = true;
              }
            };
          };

          const modalInstance = $modal.open({
            templateUrl: 'views/modals/scanner.html',
            windowClass: 'full',
            controller: ModalInstanceCtrl,
            backdrop: 'static',
            keyboard: false,
          });
          modalInstance.result.then((data) => {
            parentScope.onScan({ data });
          });
        };

        $scope.openScanner = function () {
          if (isCordova) {
            $scope.cordovaOpenScanner();
          } else {
            $scope.modalOpenScanner();
          }
        };
      },
      replace: true,
      template: '<a id="qr-scanner" ng-click="openScanner()"><svg-icon name="barcode-scan"></svg-icon></a>',
    };
  }
})();
