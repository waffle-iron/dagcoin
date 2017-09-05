/* eslint-disable import/no-unresolved */
(function () {
  'use strict';

  angular
    .module('copayApp.services')
    .factory('changeWalletTypeTypeService', changeWalletTypeTypeService);

  changeWalletTypeTypeService.$inject = ['$rootScope', 'fileSystemService', 'isCordova'];

  function changeWalletTypeTypeService($rootScope, fileSystemService, isCordova) {
    const service = {};

    service.change = change;
    service.canChange = canChange;

    function getUserConfig() {
      try {
        const userConfFile = fileSystemService.getUserConfFilePath();
        return requireUncached(userConfFile);
      } catch (e) {
        return {}; // empty config
      }
    }

    function clearRequireCache(module) {
      if (typeof require.resolve === 'function') {
        delete require.cache[require.resolve(module)];
      }
    }

    function requireUncached(module) {
      clearRequireCache(module);
      return require(module.toString());
    }

    function canChange() {
      return !isCordova;
    }

    function change() {
      if (!canChange()) {
        return;
      }

      // load config
      const userConf = getUserConfig();
      const userConfFile = fileSystemService.getUserConfFilePath();
      userConf.bLight = !userConf.bLight;

      // set wallet type
      fileSystemService.writeFile(userConfFile, JSON.stringify(userConf, null, '\t'), 'utf8', (err) => {
        if (err) {
          console.log(err);
        } else {
          const loadedData = [];
          loadData(loadedData, 0, () => {
            // transfer data
            createDatabaseAndTransferData(loadedData, () => {
              // reload application
              $rootScope.$emit('Local/ShowAlert', 'Wallet type successfully changed, please restart the application.', 'fi-check', () => {
                if (navigator && navigator.app) {
                  navigator.app.exitApp();
                } else if (process.exit) {
                  process.exit();
                }
              });
            });
          });
        }
      });
    }

    function loadTable(tableName, cb) {
      const db = requireUncached('byteballcore/db.js');
      const query = `select * from ${tableName}`;

      db.query(query, (rows) => {
        cb({ tableName, rows });
      });
    }

    function loadData(result, tableIndex, cb) {
      const tables = ['correspondent_devices', 'wallets', 'shared_addresses',
        'wallet_signing_paths', 'shared_address_signing_paths', 'my_addresses'];

      if (tableIndex >= tables.length) {
        cb();
        return;
      }

      loadTable(tables[tableIndex], (r) => {
        result.push(r);
        loadData(result, tableIndex + 1, cb);
      });
    }

    function saveTable(table, cb) {
      const db = requireUncached('byteballcore/db.js');

      if (table.rows.length === 0) {
        cb();
        return;
      }

      const keys = Object.keys(table.rows[0]);
      const columns = [];
      const values = [];

      for (let i = 0; i < keys.length; i += 1) {
        columns.push(keys[i]);
      }

      let query = '';

      for (let i = 0; i < table.rows.length; i += 1) {
        const v = [];
        for (let j = 0; j < keys.length; j += 1) {
          v.push(`'${table.rows[i][keys[j]]}'`);
        }

        values.push(`(${v})`);
      }

      query += `insert or replace into ${table.tableName} (${columns.join(',')}) values ${values.join(',')};\r\n`;

      db.query(query, [], () => {
        cb();
      });
    }

    // transfer data from old to new database
    function saveData(data, index, cb) {
      if (index >= data.length) {
        cb();
        return;
      }

      saveTable(data[index], () => {
        saveData(data, index + 1, cb);
      });
    }

    function createDatabaseAndTransferData(data, cb) {
      const oldDb = require('byteballcore/db.js');

      oldDb.close(() => {
        clearRequireCache('byteballcore/conf.js');
        clearRequireCache('byteballcore/sqlite_pool.js');
        clearRequireCache('byteballcore/mysql_pool.js');
        const db = requireUncached('byteballcore/db.js');

        // init database
        const interval = setInterval(() => {
          db.query('SELECT name FROM sqlite_master WHERE type=\'table\'', (result) => {
            if (result.length > 50) {
              clearInterval(interval);
              saveData(data, 0, cb);
            }
          });
        }, 300);
      });
    }

    return service;
  }
}());

