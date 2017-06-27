

const breadcrumbs = require('byteballcore/breadcrumbs.js');

angular.module('copayApp.directives')
    .directive('qrScanner', ['$rootScope', '$timeout', '$modal', 'isCordova', 'gettextCatalog',
      function ($rootScope, $timeout, $modal, isCordova, gettextCatalog) {
        const controller = function ($scope) {
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
                  },
              );
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

              var _scan = function (evt) {
                if (localMediaStream) {
                  context.drawImage(video, 0, 0, 300, 225);
                  try {
                    qrcode.decode();
                  } catch (e) {
                    // qrcodeError(e);
                  }
                }
                $timeout(_scan, 800);
              };

              const _scanStop = function () {
                if (localMediaStream && localMediaStream.active) {
                  const localMediaStreamTrack = localMediaStream.getTracks();
                  for (let i = 0; i < localMediaStreamTrack.length; i++) {
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
                if (video) { video.src = ''; }
              };

              qrcode.callback = function (data) {
                if (prevResult != data) {
                  prevResult = data;
                  return;
                }
                _scanStop();
                $modalInstance.close(data);
              };

              const _successCallback = function (stream) {
                video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
                localMediaStream = stream;
                video.play();
                $timeout(_scan, 1000);
              };

              const _videoError = function (err) {
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
				  if (!canvas)					  { return; }
                  context = canvas.getContext('2d');


                  video = document.getElementById('qrcode-scanner-video');
                  $video = angular.element(video);
                  canvas.width = 300;
                  canvas.height = 225;
                  context.clearRect(0, 0, 300, 225);

                  navigator.getUserMedia({
                    video: true,
                  }, _successCallback, _videoError);
                }, 500);
              };

              $scope.cancel = function () {
                breadcrumbs.add('qr scanner cancel');
                _scanStop();
                try {
                	$modalInstance.dismiss('cancel');
                }				catch (e) {
                  e.bIgnore = true;
				//	throw e;
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
        };

        return {
          restrict: 'E',
          scope: {
            onScan: '&',
            beforeScan: '&',
          },
          controller,
          replace: true,
          template: '<a id="camera-icon" class="btn btn_red" ng-click="openScanner()">Scan QR Code</a>',
        };
      },
    ]);
