
angular.module('copayApp.services')
  .factory('backupService', ($log, $timeout, profileService, sjcl) => {
    const root = {};

    const _download = function (ew, filename, cb) {
      const NewBlob = function (data, datatype) {
        let out;

        try {
          out = new Blob([data], {
            type: datatype,
          });
          $log.debug('case 1');
        } catch (e) {
          window.BlobBuilder = window.BlobBuilder ||
            window.WebKitBlobBuilder ||
            window.MozBlobBuilder ||
            window.MSBlobBuilder;

          if (e.name == 'TypeError' && window.BlobBuilder) {
            const bb = new BlobBuilder();
            bb.append(data);
            out = bb.getBlob(datatype);
            $log.debug('case 2');
          } else if (e.name == 'InvalidStateError') {
            // InvalidStateError (tested on FF13 WinXP)
            out = new Blob([data], {
              type: datatype,
            });
            $log.debug('case 3');
          } else {
            // We're screwed, blob constructor unsupported entirely
            $log.debug('Errore');
          }
        }
        return out;
      };

      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';

      const blob = new NewBlob(ew, 'text/plain;charset=utf-8');
      const url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      a.click();
      $timeout(() => {
        window.URL.revokeObjectURL(url);
      }, 250);
      return cb();
    };

    root.addMetadata = function (b, opts) {
      b = JSON.parse(b);
      if (opts.historyCache) b.historyCache = opts.historyCache;
      if (opts.addressBook) b.addressBook = opts.addressBook;
      return JSON.stringify(b);
    };

    root.walletExport = function (password, opts) {
      if (!password) {
        return null;
      }
      const fc = profileService.focusedClient;
      try {
        opts = opts || {};
        let b = fc.export(opts);
        if (opts.historyCache || opts.addressBook) b = root.addMetadata(b, opts);

        const e = sjcl.encrypt(password, b, {
          iter: 10000,
        });
        return e;
      } catch (err) {
        $log.debug('Error exporting wallet: ', err);
        return null;
      }
    };

    root.walletDownload = function (password, opts, cb) {
      const fc = profileService.focusedClient;
      const ew = root.walletExport(password, opts);
      if (!ew) return cb('Could not create backup');

      let walletName = (fc.alias || '') + (fc.alias ? '-' : '') + fc.credentials.walletName;
      if (opts.noSign) walletName += '-noSign';
      const filename = `${walletName}-Copaybackup.aes.json`;
      _download(ew, filename, cb);
    };
    return root;
  });
