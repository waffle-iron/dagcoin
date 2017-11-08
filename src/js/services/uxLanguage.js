(function () {
  'use strict';

  angular.module('copayApp.services')
  .factory('uxLanguage', ($log, lodash, gettextCatalog, amMoment, configService) => {
    const root = {};

    root.availableLanguages = [{
      name: 'English',
      isoCode: 'en',
    }, {
      name: 'Français',
      isoCode: 'fr',
    }, {
      name: 'Italiano',
      isoCode: 'it',
    }, {
      name: 'Deutsch',
      isoCode: 'de',
    }, {
      name: 'Español',
      isoCode: 'es',
    }, {
      name: 'Português',
      isoCode: 'pt',
    }, {
      name: 'Nederlands',
      isoCode: 'nl',
    }, {
      name: 'Svenska',
      isoCode: 'sv',
    }, {
      name: 'Polski',
      isoCode: 'pl',
    }, {
      name: 'Magyar',
      isoCode: 'hu',
    }, {
      name: 'Ελληνικά',
      isoCode: 'el',
    }, {
      name: '日本語',
      isoCode: 'ja',
      useIdeograms: true,
    }, {
      name: '中文',
      isoCode: 'zh',
      useIdeograms: true,
    }, {
      name: 'Pусский',
      isoCode: 'ru',
    }, {
      name: 'Bahasa Indonesia',
      isoCode: 'id',
    }, {
      name: 'Türk',
      isoCode: 'tr',
    }];

    root.currentLanguage = null;

    root.detect = function () {
      // Auto-detect browser language
      let userLang;
      const androidLang = navigator.userAgent.match(/android.*\W(\w\w)-(\w\w)\W/i);

      if (navigator && navigator.userAgent && androidLang) {
        userLang = androidLang[1];
      } else {
        // works for iOS and Android 4.x
        userLang = navigator.userLanguage || navigator.language;
      }
      userLang = userLang ? (userLang.split('-', 1)[0] || 'en') : 'en';

      return userLang;
    };

    root.set = function (lang) {
      $log.debug(`Setting default language: ${lang}`);
      gettextCatalog.setCurrentLanguage(lang);
      if (lang !== 'en') {
        gettextCatalog.loadRemote(`languages/${lang}.json`);
      }
      amMoment.changeLocale(lang);
      root.currentLanguage = lang;
    };

    root.getCurrentLanguage = function () {
      return root.currentLanguage;
    };

    root.getCurrentLanguageName = function () {
      return root.getName(root.currentLanguage);
    };

    root.getCurrentLanguageInfo = function () {
      return lodash.find(root.availableLanguages, {
        isoCode: root.currentLanguage,
      });
    };

    root.getLanguages = function () {
      return root.availableLanguages;
    };

    root.init = function () {
      root.set(root.detect());
    };

    root.update = function () {
      let userLang = configService.getSync().wallet.settings.defaultLanguage;

      if (!userLang) {
        userLang = root.detect();
      }

      if (userLang !== gettextCatalog.getCurrentLanguage()) {
        root.set(userLang);
      }
      return userLang;
    };

    root.getName = function (lang) {
      return lodash.result(lodash.find(root.availableLanguages, {
        isoCode: lang,
      }), 'name');
    };

    return root;
  });
}());
