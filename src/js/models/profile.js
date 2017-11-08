/**
 * Profile
 *
 * credential: array of OBJECTS
 */
function Profile() {
  this.version = '1.0.0';
}

Profile.create = function (opts) {
  const options = opts || {};

  const x = new Profile();
  x.createdOn = Date.now();
  x.credentials = options.credentials || [];
  if (!options.xPrivKey && !options.xPrivKeyEncrypted) {
    throw Error('no xPrivKey, even encrypted');
  }
  if (!options.mnemonic && !options.mnemonicEncrypted) {
    throw Error('no mnemonic, even encrypted');
  }
  if (!options.tempDeviceKey) {
    throw Error('no tempDeviceKey');
  }
  x.xPrivKey = options.xPrivKey;
  x.mnemonic = options.mnemonic;
  x.xPrivKeyEncrypted = options.xPrivKeyEncrypted;
  x.mnemonicEncrypted = options.mnemonicEncrypted;
  x.tempDeviceKey = options.tempDeviceKey;
  x.prevTempDeviceKey = options.prevTempDeviceKey; // optional
  x.my_device_address = options.my_device_address;
  return x;
};


Profile.fromObj = function (obj) {
  const x = new Profile();

  x.createdOn = obj.createdOn;
  x.credentials = obj.credentials;

  if (x.credentials[0] && typeof x.credentials[0] !== 'object') {
    throw Error('credentials should be an object');
  }

  if (!obj.xPrivKey && !obj.xPrivKeyEncrypted) {
    throw Error('no xPrivKey, even encrypted');
  }
// if (!obj.mnemonic && !obj.mnemonicEncrypted)
// throw Error("no mnemonic, even encrypted");
  if (!obj.tempDeviceKey) {
    throw Error('no tempDeviceKey');
  }
  x.xPrivKey = obj.xPrivKey;
  x.mnemonic = obj.mnemonic;
  x.xPrivKeyEncrypted = obj.xPrivKeyEncrypted;
  x.mnemonicEncrypted = obj.mnemonicEncrypted;
  x.tempDeviceKey = obj.tempDeviceKey;
  x.prevTempDeviceKey = obj.prevTempDeviceKey; // optional
  x.my_device_address = obj.my_device_address;

  return x;
};


Profile.fromString = function (str) {
  return Profile.fromObj(JSON.parse(str));
};

Profile.prototype.toObj = function () {
  return JSON.stringify(this);
};

