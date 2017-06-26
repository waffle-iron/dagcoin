/**
 * The official client library for bitcore-wallet-service.
 * @module Client
 */

/**
 * Client API.
 * @alias module:Client.API
 */
const client = module.exports = require('./api');

client.Utils = require('./common/utils');
client.sjcl = require('sjcl');

// Expose bitcore
client.Bitcore = require('bitcore-lib');
