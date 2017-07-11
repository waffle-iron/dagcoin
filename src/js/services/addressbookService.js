/* eslint-disable no-unused-vars */
angular.module('copayApp.services').factory('addressbookService', (storageService, profileService) => {
  const root = {};

  root.getLabel = function (addr, cb) {
    const fc = profileService.focusedClient;
    storageService.getAddressbook(fc.credentials.network, (storageServiceError, ab) => {
      if (storageServiceError) {
        return cb('Could not get the Addressbook');
      }
      if (!ab) {
        return cb();
      }
      const addressBook = JSON.parse(ab);
      if (addressBook[addr]) {
        return cb(addressBook[addr]);
      }
      return cb();
    });
  };

  root.list = function (cb) {
    const fc = profileService.focusedClient;
    storageService.getAddressbook(fc.credentials.network, (storageServiceError, ab) => {
      if (storageServiceError) {
        return cb('Could not get the Addressbook');
      }
      let addressBook;
      if (ab) {
        addressBook = JSON.parse(ab);
      }
      return cb(storageServiceError, addressBook);
    });
  };

  root.add = function (entry, cb) {
    const fc = profileService.focusedClient;
    root.list((listError, ab) => {
      if (listError) {
        return cb(listError);
      }
      let addressBook = ab;
      if (!addressBook) {
        addressBook = {};
      }
      if (addressBook[entry.address]) {
        return cb('Entry already exist');
      }
      addressBook[entry.address] = entry.label;
      return storageService.setAddressbook(fc.credentials.network, JSON.stringify(addressBook), (setAddressbookError, address) => {
        if (setAddressbookError) {
          return cb('Error adding new entry');
        }
        return root.list((err, addressList) => cb(err, addressList));
      });
    });
  };

  root.remove = function (addr, cb) {
    const fc = profileService.focusedClient;
    root.list((err, ab) => {
      if (err) {
        return cb(err);
      }
      if (!ab) {
        return cb('Address book does not exist');
      }
      if (!ab[addr]) {
        return cb('Entry does not exist');
      }
      delete ab[addr];
      return storageService.setAddressbook(fc.credentials.network, JSON.stringify(ab), (error) => {
        if (error) {
          return cb('Error deleting entry');
        }
        return root.list((listError, addressBook) => cb(listError, addressBook));
      });
    });
  };

  root.removeAll = function (cb) {
    const fc = profileService.focusedClient;
    storageService.removeAddressbook(fc.credentials.network, (err) => {
      if (err) {
        return cb('Error deleting addressbook');
      }
      return cb();
    });
  };

  return root;
});
