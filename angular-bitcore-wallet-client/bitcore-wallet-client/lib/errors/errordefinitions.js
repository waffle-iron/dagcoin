const _ = require('lodash');

const ClientError = require('./clienterror');

const errors = {
  INVALID_BACKUP: 'Invalid Backup',
  WALLET_DOES_NOT_EXIST: 'Wallet does not exist. Need to recreate',
  MISSING_PRIVATE_KEY: 'Missing private keys to sign',
  ENCRYPTED_PRIVATE_KEY: 'Private key is encrypted, cannot sign',
  SERVER_COMPROMISED: 'Server response could not be verified',
  COULD_NOT_BUILD_TRANSACTION: 'Could not build transaction',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
};

const errorObjects = _.zipObject(_.map(errors, (msg, code) => [code, new ClientError(code, msg)]));

errorObjects.codes = _.mapValues(errors, (v, k) => k);

module.exports = errorObjects;
