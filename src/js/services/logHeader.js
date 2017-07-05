
angular.module('copayApp.services')
  .factory('logHeader', ($log, isCordova, nodeWebkit) => {
    $log.info(`Starting Dagcoin v${window.version} #${window.commitHash}`);
    $log.info('Client: isCordova:', isCordova, 'isNodeWebkit:', nodeWebkit.isDefined());
    $log.info('Navigator:', navigator.userAgent);
    return {};
  });
