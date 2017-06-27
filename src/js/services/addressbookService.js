

angular.module('copayApp.services').factory('addressbookService', (storageService, profileService) => {
  const root = {};

  root.getLabel = function (addr, cb) {
    const fc = profileService.focusedClient;
    storageService.getAddressbook(fc.credentials.network, (err, ab) => {
      if (!ab) return cb();
      ab = JSON.parse(ab);
      if (ab[addr]) return cb(ab[addr]);
      return cb();
    });
  };

  root.list = function (cb) {
    const fc = profileService.focusedClient;
    storageService.getAddressbook(fc.credentials.network, (err, ab) => {
      if (err) return cb('Could not get the Addressbook');
      if (ab) ab = JSON.parse(ab);
      return cb(err, ab);
    });
  };

  root.add = function (entry, cb) {
    const fc = profileService.focusedClient;
    root.list((err, ab) => {
      if (err) return cb(err);
      if (!ab) ab = {};
      if (ab[entry.address]) return cb('Entry already exist');
      ab[entry.address] = entry.label;
      storageService.setAddressbook(fc.credentials.network, JSON.stringify(ab), (err, ab) => {
        if (err) return cb('Error adding new entry');
        root.list((err, ab) => cb(err, ab));
      });
    });
  };

  root.remove = function (addr, cb) {
    const fc = profileService.focusedClient;
    root.list((err, ab) => {
      if (err) return cb(err);
      if (!ab) return;
      if (!ab[addr]) return cb('Entry does not exist');
      delete ab[addr];
      storageService.setAddressbook(fc.credentials.network, JSON.stringify(ab), (err) => {
        if (err) return cb('Error deleting entry');
        root.list((err, ab) => cb(err, ab));
      });
    });
  };

  root.removeAll = function () {
    const fc = profileService.focusedClient;
    storageService.removeAddressbook(fc.credentials.network, (err) => {
      if (err) return cb('Error deleting addressbook');
      return cb();
    });
  };

  return root;
});
