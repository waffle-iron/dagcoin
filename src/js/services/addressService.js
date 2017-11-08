(function () {
  'use strict';

  angular.module('copayApp.services')
  .factory('addressService', (
    profileService,
    $log
  ) => {
    const root = {};


    root.expireAddress = function (walletId, cb) {
      $log.debug(`Cleaning Address ${walletId}`);
      cb();
    };


    root.createAddress = function (walletId, cb) {
      const client = profileService.getClient(walletId);

      $log.debug('Creating address for wallet:', walletId);


      client.createAddress(0, (err, addr) => {
        if (err) {
          throw Error('impossible err creating address');
        }

        return cb(null, addr.address);
      });
    };


    root.getAddress = function (walletId, forceNew, cb) {
      if (forceNew) {
        root.createAddress(walletId, (err, addr) => {
          if (err) {
            return cb(err);
          }
          return cb(null, addr);
        });
      } else {
        const client = profileService.getClient(walletId);
        client.getAddresses({ reverse: true, limit: 1, is_change: 0 }, (err, addr) => {
          if (err) {
            return cb(err);
          }
          if (addr.length > 0) {
            return cb(null, addr[0].address);
          }
          return root.getAddress(walletId, true, cb);
        });
      }
    };
    // todo: needs refactor
    root.getAddresses = function (walletId, cb) {
      const client = profileService.getClient(walletId);
      client.getAddresses({ reverse: true }, (err, addrs) => {
        if (err) {
          return cb(err);
        }
        if (addrs.length > 0) {
          return cb(null, addrs);
        }
        return root.getAddress(walletId, true, cb);
      });
    };

    return root;
  });
}());
