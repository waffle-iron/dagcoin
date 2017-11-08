//
// test/unit/controllers/controllersSpec.js
//

const sinon = require('sinon');

// Replace saveAs plugin
saveAs = function (blob, filename) {
  saveAsLastCall = {
    blob,
    filename,
  };
};

describe('Unit: Controllers', () => {
  config.plugins.LocalStorage = true;
  config.plugins.GoogleDrive = null;
  config.plugins.InsightStorage = null;
  config.plugins.EncryptedInsightStorage = null;

  const anAddr = 'mkfTyEk7tfgV611Z4ESwDDSZwhsZdbMpVy';
  const anAmount = 1000;
  const aComment = 'hola';


  const invalidForm = {
    $invalid: true,
  };

  let scope;
  let server;

  beforeEach(module('copayApp'));
  beforeEach(module('copayApp.controllers'));
  beforeEach(module(($provide) => {
    $provide.value('request', {
      get(_, cb) {
        cb(null, null, [{
          name: 'USD Dollars',
          code: 'USD',
          rate: 2,
        }]);
      },
    });
  }));

  beforeEach(inject(($controller, $rootScope) => {
    scope = $rootScope.$new();
    $rootScope.safeUnspentCount = 1;

    //
    // TODO Use the REAL wallet, and stub only networking and DB components!
    //

    const w = {};
    w.id = 1234;
    w.isComplete = sinon.stub().returns(true);
    w.isShared = sinon.stub().returns(true);
    w.privateKey = {};
    w.settings = {
      unitToSatoshi: 100,
      unitDecimals: 2,
      alternativeName: 'US Dollar',
      alternativeIsoCode: 'USD',
    };
    w.addressBook = {
      juan: '1',
    };
    w.totalCopayers = 2;
    w.getMyCopayerNickname = sinon.stub().returns('nickname');
    w.getMyCopayerId = sinon.stub().returns('id');
    w.privateKey.toObj = sinon.stub().returns({
      wallet: 'mock',
    });
    w.getSecret = sinon.stub().returns('secret');
    w.getName = sinon.stub().returns('fakeWallet');
    w.exportEncrypted = sinon.stub().returns('1234567');
    w.getTransactionHistory = sinon.stub().yields(null);
    w.getNetworkName = sinon.stub().returns('testnet');

    w.spend = sinon.stub().yields(null);
    w.sendTxProposal = sinon.stub();
    w.broadcastTx = sinon.stub().yields(null);
    w.requiresMultipleSignatures = sinon.stub().returns(true);
    w.getTxProposals = sinon.stub().returns([1, 2, 3]);
    w.getPendingTxProposals = sinon.stub().returns(
      [{
        isPending: true,
      }],
    );
    w.getId = sinon.stub().returns(1234);
    w.on = sinon.stub().yields({
      e: 'errmsg',
      loading: false,
    });
    w.sizes = sinon.stub().returns({
      tota: 1234,
    });
    w.getBalance = sinon.stub().returns(10000);
    w.publicKeyRing = sinon.stub().yields(null);
    w.publicKeyRing.nicknameForCopayer = sinon.stub().returns('nickcopayer');
    w.updateFocusedTimestamp = sinon.stub().returns(1415804323);
    w.getAddressesInfo = sinon.stub().returns([{
      addressStr: '2MxvwvfshZxw4SkkaJZ8NDKLyepa9HLMKtu',
      isChange: false,
    }]);


    const iden = {};
    iden.getLastFocusedWallet = sinon.stub().returns(null);
    iden.getWallets = sinon.stub().returns([w]);
    iden.getWalletById = sinon.stub().returns(w);
    iden.getName = sinon.stub().returns('name');
    iden.deleteWallet = sinon.stub();
    iden.close = sinon.stub().returns(null);


    $rootScope.wallet = w;
    $rootScope.iden = iden;
  }));

  describe('Create Controller', () => {
    let c;
    beforeEach(inject(($controller, $rootScope) => {
      scope = $rootScope.$new();
      c = $controller('CreateController', {
        $scope: scope,
      });
    }));

    describe('#getNumber', () => {
      it('should return an array of n undefined elements', () => {
        const n = 5;
        const array = scope.getNumber(n);
        expect(array.length).equal(n);
      });
    });
    describe('#create', () => {
      it('should work with invalid form', () => {
        scope.create(invalidForm);
      });
    });
  });


  describe('Create Profile Controller', () => {
    let c,
      confService,
      idenService;
    beforeEach(inject(($controller, $rootScope, configService, identityService) => {
      scope = $rootScope.$new();
      confService = configService;
      idenService = identityService;
      c = $controller('CreateProfileController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(c);
    });

    it('#init', () => {
      scope.init();
    });

    it('#clear', () => {
      scope.clear();
    });

    it('#saveSettings', () => {
      const old = confService.set;
      confService.set = sinon.stub().returns(null);
      scope.saveSettings();
      confService.set.calledOnce.should.be.true;
      confService.set = old;
    });

    it('#createProfile', () => {
      const old = scope.saveSettings;
      scope.saveSettings = sinon.stub().returns(null);
      scope.createProfile();
      scope.saveSettings.calledOnce.should.be.true;
      scope.saveSettings = old;
    });

    it('#_doCreateProfile', () => {
      const old = idenService.create;
      idenService.create = sinon.stub().returns(null);
      scope._doCreateProfile('myemail@domain.com', 'password');
      idenService.create.calledOnce.should.be.true;
      idenService.create = old;
    });

    it('#createDefaultWallet', () => {
      const old = idenService.createDefaultWallet;
      idenService.createDefaultWallet = sinon.stub().returns(null);
      scope.createDefaultWallet();
      idenService.createDefaultWallet.calledOnce.should.be.true;
      idenService.createDefaultWallet = old;
    });
  });

  describe('Receive Controller', () => {
    let c;
    let rootScope;
    beforeEach(inject(($controller, $rootScope) => {
      rootScope = $rootScope;
      scope = $rootScope.$new();
      c = $controller('ReceiveController', {
        $scope: scope,
      });


      const createW = function (N, conf) {
        const c = JSON.parse(JSON.stringify(conf || walletConfig));
        if (!N) N = c.totalCopayers;

        const mainPrivateKey = new copay.PrivateKey({
          networkName: walletConfig.networkName,
        });
        const mainCopayerEPK = mainPrivateKey.deriveBIP45Branch().extendedPublicKeyString();
        c.privateKey = mainPrivateKey;

        c.publicKeyRing = new copay.PublicKeyRing({
          networkName: c.networkName,
          requiredCopayers: Math.min(N, c.requiredCopayers),
          totalCopayers: N,
        });
        c.publicKeyRing.addCopayer(mainCopayerEPK);

        c.publicKeyRing.getAddressesOrdered = sinon.stub().returns(null);

        c.txProposals = new copay.TxProposals({
          networkName: c.networkName,
        });

        c.blockchain = new Blockchain(walletConfig.blockchain);

        c.network = sinon.stub();
        c.network.setHexNonce = sinon.stub();
        c.network.setHexNonces = sinon.stub();
        c.network.getHexNonce = sinon.stub();
        c.network.getHexNonces = sinon.stub();
        c.network.peerFromCopayer = sinon.stub().returns('xxxx');
        c.network.send = sinon.stub();

        c.addressBook = {
          '2NFR2kzH9NUdp8vsXTB4wWQtTtzhpKxsyoJ': {
            label: 'John',
            copayerId: '026a55261b7c898fff760ebe14fd22a71892295f3b49e0ca66727bc0a0d7f94d03',
            createdTs: 1403102115,
            hidden: false,
          },
          '2MtP8WyiwG7ZdVWM96CVsk2M1N8zyfiVQsY': {
            label: 'Jennifer',
            copayerId: '032991f836543a492bd6d0bb112552bfc7c5f3b7d5388fcbcbf2fbb893b44770d7',
            createdTs: 1403103115,
            hidden: false,
          },
        };

        c.networkName = walletConfig.networkName;
        c.version = '0.0.1';

        c.generateAddress = sinon.stub().returns({});

        c.balanceInfo = {};

        return new Wallet(c);
      };

      $rootScope.wallet = createW();
      $rootScope.wallet.balanceInfo = {};
    }));

    it('should exist', () => {
      should.exist(c);
    });

    it('#init', () => {
      scope.init();
      rootScope.title.should.be.equal('Receive');
    });

    it('should call setAddressList', () => {
      scope.setAddressList();
      expect(scope.addresses).to.be.empty;
      scope.toggleShowAll();
      scope.setAddressList();
      expect(scope.addresses).to.be.empty;
    });

    it('#newAddr', () => {
      rootScope.wallet.generateAddress = sinon.stub().returns({});
      scope.newAddr();
      rootScope.wallet.generateAddress.calledOnce.should.be.true;
    });
  });

  describe('History Controller', () => {
    let ctrl;
    beforeEach(inject(($controller, $rootScope) => {
      scope = $rootScope.$new();
      scope.wallet = null;
      scope.getTransactions = sinon.stub();
      ctrl = $controller('HistoryController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });

    it('should have a HistoryController controller', () => {
      expect(scope.loading).equal(false);
    });

    // this tests has no sense: getTransaction is async
    it.skip('should return an empty array of tx from insight', () => {
      scope.getTransactions();
      expect(scope.blockchain_txs).to.be.empty;
    });
  });


  describe('Profile Controller', () => {
    let ctrl,
      bkpService,
      idenService;
    beforeEach(inject(($controller, $rootScope, backupService, identityService) => {
      scope = $rootScope.$new();
      bkpService = backupService;
      idenService = identityService;
      ctrl = $controller('ProfileController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });

    it('#downloadProfileBackup', () => {
      const old = bkpService.profileDownload;
      bkpService.profileDownload = sinon.stub().returns(null);
      scope.downloadProfileBackup();
      bkpService.profileDownload.calledOnce.should.be.true;
      bkpService.profileDownload = old;
    });

    it('#viewProfileBackup', () => {
      const old = bkpService.profileEncrypted;
      bkpService.profileEncrypted = sinon.stub().returns(null);
      scope.viewProfileBackup();
      // bkpService.profileEncrypted.calledOnce.should.be.true;
      bkpService.profileEncrypted = old;
    });

    it('#copyProfileBackup', () => {
      const old = bkpService.profileEncrypted;
      bkpService.profileEncrypted = sinon.stub().returns(null);

      window.cordova = {
        plugins: {
          clipboard: {
            copy(e) {
              return e;
            },
          },
        },
      };

      window.plugins = {
        toast: {
          showShortCenter(e) {
            return e;
          },
        },
      };

      scope.copyProfileBackup();
      bkpService.profileEncrypted.calledOnce.should.be.true;
      bkpService.profileEncrypted = old;
    });

    it('#sendProfileBackup', () => {
      const old = bkpService.profileEncrypted;
      bkpService.profileEncrypted = sinon.stub().returns(null);

      window.plugin = {
        email: {
          open(e) {
            return e;
          },
        },
      };

      window.plugins = {
        toast: {
          showShortCenter(e) {
            return e;
          },
        },
      };

      scope.sendProfileBackup();
      bkpService.profileEncrypted.calledOnce.should.be.true;
      bkpService.profileEncrypted = old;
    });

    it('#deleteProfile', () => {
      const old = idenService.deleteProfile;
      idenService.deleteProfile = sinon.stub().returns(null);
      scope.deleteProfile();
      idenService.deleteProfile.calledOnce.should.be.true;
      idenService.deleteProfile = old;
    });
  });


  describe('Send Controller', () => {
    let scope,
      form,
      sendForm,
      sendCtrl,
      rootScope;
    beforeEach(angular.mock.inject(($compile, $rootScope, $controller, rateService, notification) => {
      scope = $rootScope.$new();
      rootScope = $rootScope;
      scope.rateService = rateService;
      const element = angular.element(
        '<form name="form">' +
        '<input type="text" id="newaddress" name="newaddress" ng-disabled="loading" placeholder="Address" ng-model="newaddress" valid-address required>' +
        '<input type="text" id="newlabel" name="newlabel" ng-disabled="loading" placeholder="Label" ng-model="newlabel" required>' +
        '</form>',
      );
      scope.model = {
        newaddress: null,
        newlabel: null,
        _address: null,
        _amount: null,
      };
      $compile(element)(scope);

      const element2 = angular.element(
        '<form name="form2">' +
        '<input type="text" id="address" name="address" ng-model="_address" valid-address required>' +
        '<input type="number" id="amount" name="amount" ng-model="_amount" min="0.00000001" max="10000000000" valid-amount required>' +
        '<input type="number" id="alternative" name="alternative" ng-model="_alternative">' +
        '<textarea id="comment" name="comment" ng-model="commentText" ng-maxlength="100"></textarea>' +
        '</form>',
      );
      $compile(element2)(scope);
      sendCtrl = $controller('SendController', {
        $scope: scope,
        $modal: {},
      });
      scope.init();
      scope.$digest();
      form = scope.form;
      sendForm = scope.form2;
      scope.sendForm = sendForm;
    }));

    it('should have a SendController controller', () => {
      should.exist(scope.submitForm);
    });

    it('should have a title', () => {
      expect(scope.title);
    });

    it('#setError', () => {
      scope.setError('my error');
      expect(scope.error);
    });

    it('#setFromPayPro', () => {
      const old = rootScope.wallet.fetchPaymentRequest;
      rootScope.wallet.fetchPaymentRequest = sinon.stub().returns(null);
      scope.setFromPayPro('newURL');
      rootScope.wallet.fetchPaymentRequest.calledOnce.should.be.true;
      rootScope.wallet.fetchPaymentRequest = old;
    });


    it('should validate address with network', () => {
      form.newaddress.$setViewValue('mkfTyEk7tfgV611Z4ESwDDSZwhsZdbMpVy');
      expect(form.newaddress.$invalid).to.equal(false);
    });

    it('should not validate address with other network', () => {
      form.newaddress.$setViewValue('1JqniWpWNA6Yvdivg3y9izLidETnurxRQm');
      expect(form.newaddress.$invalid).to.equal(true);
    });

    it('should not validate random address', () => {
      form.newaddress.$setViewValue('thisisaninvalidaddress');
      expect(form.newaddress.$invalid).to.equal(true);
    });

    it('should validate label', () => {
      form.newlabel.$setViewValue('John');
      expect(form.newlabel.$invalid).to.equal(false);
    });

    it('should not validate label', () => {
      expect(form.newlabel.$invalid).to.equal(true);
    });

    it('should create a transaction proposal with given values', inject(($timeout) => {
      sendForm.address.$setViewValue(anAddr);
      sendForm.amount.$setViewValue(anAmount);
      sendForm.comment.$setViewValue(aComment);

      const w = scope.wallet;
      scope.submitForm(sendForm);

      $timeout.flush();
      sinon.assert.callCount(w.spend, 1);
      sinon.assert.callCount(w.broadcastTx, 0);
      const spendArgs = w.spend.getCall(0).args[0];
      spendArgs.toAddress.should.equal(anAddr);
      spendArgs.amountSat.should.equal(anAmount * scope.wallet.settings.unitToSatoshi);
      spendArgs.comment.should.equal(aComment);
    }));


    it('should handle big values in 100 BTC', inject(($timeout) => {
      const old = scope.wallet.settings.unitToSatoshi;
      scope.wallet.settings.unitToSatoshi = 100000000;
      sendForm.address.$setViewValue(anAddr);
      sendForm.amount.$setViewValue(100);
      sendForm.address.$setViewValue(anAddr);

      scope.updateTxs = sinon.spy();
      scope.submitForm(sendForm);
      const w = scope.wallet;
      $timeout.flush();
      w.spend.getCall(0).args[0].amountSat.should.equal(100 * scope.wallet.settings.unitToSatoshi);
      scope.wallet.settings.unitToSatoshi = old;
    }));


    it('should handle big values in 5000 BTC', inject(($rootScope, $timeout) => {
      const w = scope.wallet;
      w.requiresMultipleSignatures = sinon.stub().returns(true);


      const old = $rootScope.wallet.settings.unitToSatoshi;
      $rootScope.wallet.settings.unitToSatoshi = 100000000;
      sendForm.address.$setViewValue(anAddr);
      sendForm.amount.$setViewValue(5000);
      scope.submitForm(sendForm);
      $timeout.flush();

      w.spend.getCall(0).args[0].amountSat.should.equal(5000 * $rootScope.wallet.settings.unitToSatoshi);
      $rootScope.wallet.settings.unitToSatoshi = old;
    }));

    it('should convert bits amount to fiat', (done) => {
      scope.rateService.whenAvailable(() => {
        sendForm.amount.$setViewValue(1e6);
        scope.$digest();
        expect(scope._amount).to.equal(1e6);
        expect(scope.__alternative).to.equal(2);
        done();
      });
    });
    it('should convert fiat to bits amount', (done) => {
      scope.rateService.whenAvailable(() => {
        sendForm.alternative.$setViewValue(2);
        scope.$digest();
        expect(scope.__alternative).to.equal(2);
        expect(scope._amount).to.equal(1e6);
        done();
      });
    });

    it('receive from uri using bits', inject(() => {
      sendForm.address.$setViewValue('bitcoin:mxf5psDyA8EQVzb2MZ7MkDWiXuAuWWCRMB?amount=1.018085');
      expect(sendForm.amount.$modelValue).to.equal(1018085);
      sendForm.address.$setViewValue('bitcoin:mxf5psDyA8EQVzb2MZ7MkDWiXuAuWWCRMB?amount=1.01808500');
      expect(sendForm.amount.$modelValue).to.equal(1018085);
      sendForm.address.$setViewValue('bitcoin:mxf5psDyA8EQVzb2MZ7MkDWiXuAuWWCRMB?amount=0.29133585');
      expect(sendForm.amount.$modelValue).to.equal(291335.85);
    }));

    it('receive from uri using BTC', inject(($rootScope) => {
      const old = $rootScope.wallet.settings.unitToSatoshi;
      const old_decimals = $rootScope.wallet.settings.unitDecimals;
      $rootScope.wallet.settings.unitToSatoshi = 100000000;
      $rootScope.wallet.settings.unitDecimals = 8;
      sendForm.address.$setViewValue('bitcoin:mxf5psDyA8EQVzb2MZ7MkDWiXuAuWWCRMB?amount=1.018085');
      expect(sendForm.amount.$modelValue).to.equal(1.018085);
      sendForm.address.$setViewValue('bitcoin:mxf5psDyA8EQVzb2MZ7MkDWiXuAuWWCRMB?amount=1.01808500');
      expect(sendForm.amount.$modelValue).to.equal(1.018085);
      sendForm.address.$setViewValue('bitcoin:mxf5psDyA8EQVzb2MZ7MkDWiXuAuWWCRMB?amount=0.29133585');
      expect(sendForm.amount.$modelValue).to.equal(0.29133585);
      sendForm.address.$setViewValue('bitcoin:mxf5psDyA8EQVzb2MZ7MkDWiXuAuWWCRMB?amount=0.1');
      expect(sendForm.amount.$modelValue).to.equal(0.1);
      $rootScope.wallet.settings.unitToSatoshi = old;
      $rootScope.wallet.settings.unitDecimals = old_decimals;
    }));
  });

  describe('Unit: Version Controller', () => {
    let scope,
      $httpBackendOut;
    const GH = 'https://api.github.com/repos/bitpay/copay/tags';
    beforeEach(inject(($controller, $injector) => {
      $httpBackend = $injector.get('$httpBackend');
      $httpBackend.when('GET', GH)
        .respond([{
          name: 'v100.1.6',
          zipball_url: 'https://api.github.com/repos/bitpay/copay/zipball/v0.0.6',
          tarball_url: 'https://api.github.com/repos/bitpay/copay/tarball/v0.0.6',
          commit: {
            sha: 'ead7352bf2eca705de58d8b2f46650691f2bc2c7',
            url: 'https://api.github.com/repos/bitpay/copay/commits/ead7352bf2eca705de58d8b2f46650691f2bc2c7',
          },
        }]);
    }));

    let rootScope;
    beforeEach(inject(($controller, $rootScope) => {
      rootScope = $rootScope;
      scope = $rootScope.$new();
      headerCtrl = $controller('VersionController', {
        $scope: scope,
      });
    }));

    afterEach(() => {
      $httpBackend.verifyNoOutstandingExpectation();
      $httpBackend.verifyNoOutstandingRequest();
    });


    it('should hit github for version', () => {
      $httpBackend.expectGET(GH);
      scope.$apply();
      $httpBackend.flush();
    });

    it('should check version ', inject(($injector) => {
      notification = $injector.get('notification');
      const spy = sinon.spy(notification, 'version');
      $httpBackend.expectGET(GH);
      scope.$apply();
      $httpBackend.flush();
      spy.calledOnce.should.equal(true);
    }));

    it('should check blockChainStatus', () => {
      $httpBackend.expectGET(GH);
      $httpBackend.flush();
      rootScope.insightError = 1;
      scope.$apply();
      expect(rootScope.insightError).equal(1);
      scope.$apply();
      expect(rootScope.insightError).equal(1);
      scope.$apply();
    });
  });

  describe('Unit: Sidebar Controller', () => {
    beforeEach(inject(($controller, $rootScope) => {
      rootScope = $rootScope;
      scope = $rootScope.$new();
      headerCtrl = $controller('SidebarController', {
        $scope: scope,
      });
    }));

    it('should call sign out', () => {
      scope.signout();
      rootScope.iden.close.calledOnce.should.be.true;
    });
  });

  describe('Head Controller', () => {
    let scope,
      ctrl,
      rootScope,
      idenService,
      balService;
    beforeEach(inject(($controller, $rootScope, identityService, balanceService) => {
      rootScope = $rootScope;
      idenService = identityService;
      balService = balanceService;
      scope = $rootScope.$new();
      ctrl = $controller('HeadController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });

    it('should call sign out', () => {
      const old = idenService.signout;
      idenService.signout = sinon.stub().returns(null);
      scope.signout();
      idenService.signout.calledOnce.should.be.true;
      idenService.signout = old;
    });

    it('should call refresh', () => {
      const old = rootScope.wallet.sendWalletReady;
      rootScope.wallet.sendWalletReady = sinon.stub().returns(null);
      balService.clearBalanceCache = sinon.stub().returns(null);
      scope.refresh();
      rootScope.wallet.sendWalletReady.calledOnce.should.be.true;
      rootScope.wallet.sendWalletReady = old;
    });
  });

  describe('Send Controller', () => {
    let sendCtrl,
      form;
    beforeEach(inject(($compile, $rootScope, $controller) => {
      scope = $rootScope.$new();
      $rootScope.availableBalance = 123456;

      const element = angular.element(
        '<form name="form">' +
        '<input type="number" id="amount" name="amount" placeholder="Amount" ng-model="amount" min="0.0001" max="10000000" enough-amount required>' +
        '</form>',
      );
      scope.model = {
        amount: null,
      };
      $compile(element)(scope);
      scope.$digest();
      form = scope.form;

      sendCtrl = $controller('SendController', {
        $scope: scope,
        $modal: {},
      });
    }));

    it('should have a SendController', () => {
      expect(scope.isMobile).not.to.equal(null);
    });
    it('should autotop balance correctly', () => {
      scope.setTopAmount(form);
      form.amount.$setViewValue(123356);
      expect(scope.amount).to.equal(123356);
      expect(form.amount.$invalid).to.equal(false);
      expect(form.amount.$pristine).to.equal(false);
    });
  });

  describe('Import Controller', () => {
    let ctrl;
    beforeEach(inject(($controller, $rootScope) => {
      scope = $rootScope.$new();
      ctrl = $controller('ImportController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });
    it('import status', () => {
      expect(scope.importStatus).equal('Importing wallet - Reading backup...');
    });
  });

  // TODO: fix this test
  describe.skip('Home Controller', () => {
    let ctrl;
    beforeEach(inject(($controller, $rootScope) => {
      scope = $rootScope.$new();
      ctrl = $controller('HomeController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });
    describe('#open', () => {
      it('should work with invalid form', () => {
        scope.open(invalidForm);
      });
    });
  });

  describe('SignOut Controller', () => {
    let ctrl;
    beforeEach(inject(($controller, $rootScope) => {
      scope = $rootScope.$new();
      ctrl = $controller('signOutController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });
  });

  describe('Settings Controller', () => {
    let what;
    beforeEach(inject(($controller, $rootScope) => {
      scope = $rootScope.$new();
      what = $controller('SettingsController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(what);
    });
  });

  describe('Copayers Controller', () => {
    const saveDownload = null;
    let ctrl,
      rootScope,
      idenService;
    beforeEach(inject(($controller, $rootScope, identityService) => {
      scope = $rootScope.$new();
      rootScope = $rootScope;
      idenService = identityService;
      ctrl = $controller('CopayersController', {
        $scope: scope,
        $modal: {},
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });

    it('#init', () => {
      const old = scope.updateList;
      scope.updateList = sinon.stub().returns(null);
      scope.init();
      scope.updateList.callCount.should.be.equal(3); // why 3 ??????
      scope.updateList = old;
    });

    it('#updateList', () => {
      const old = rootScope.wallet.getRegisteredPeerIds;
      rootScope.wallet.getRegisteredPeerIds = sinon.stub().returns(null);
      rootScope.wallet.removeListener = sinon.stub().returns(null);
      scope.updateList();
      rootScope.wallet.getRegisteredPeerIds.callCount.should.be.equal(1);
      rootScope.wallet.getRegisteredPeerIds = old;
    });

    it('#deleteWallet', inject(($timeout) => {
      const old = idenService.deleteWallet;
      idenService.deleteWallet = sinon.stub().returns(null);
      scope.deleteWallet();
      $timeout.flush();
      idenService.deleteWallet.callCount.should.be.equal(1);
      idenService.deleteWallet = old;
    }));
  });

  describe('Join Controller', () => {
    let ctrl;
    beforeEach(inject(($controller, $rootScope) => {
      scope = $rootScope.$new();
      ctrl = $controller('JoinController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });
    describe('#join', () => {
      it('should work with invalid form', () => {
        scope.join(invalidForm);
      });
    });
  });

  describe('paymentUriController Controller', () => {
    let what;
    beforeEach(inject(($controller, $rootScope, $location) => {
      scope = $rootScope.$new();
      const routeParams = {
        data: 'bitcoin:19mP9FKrXqL46Si58pHdhGKow88SUPy1V8',
      };
      const query = {
        amount: 0.1,
        message: 'a bitcoin donation',
      };
      what = $controller('paymentUriController', {
        $scope: scope,
        $routeParams: routeParams,
        $location: {
          search() {
            return query;
          },
        },
      });
    }));

    it('should exist', () => {
      should.exist(what);
    });

    it('should parse url correctly', () => {
      should.exist(what);
      should.exist(scope.pendingPayment);
      scope.pendingPayment.should.equal('bitcoin:19mP9FKrXqL46Si58pHdhGKow88SUPy1V8?amount=0.1&message=a bitcoin donation');
    });
  });

  describe('Warning Controller', () => {
    let ctrl,
      idenService;
    beforeEach(inject(($controller, $rootScope, identityService) => {
      scope = $rootScope.$new();
      idenService = identityService;
      ctrl = $controller('WarningController', {
        $scope: scope,
      });
    }));

    it('should exist', () => {
      should.exist(ctrl);
    });

    it('#signout', () => {
      const old = idenService.signout;
      idenService.signout = sinon.stub().returns(null);
      scope.signout();
      idenService.signout.calledOnce.should.be.true;
      idenService.signout = old;
    });
  });

  describe('More Controller', () => {
    let ctrl,
      modalCtrl,
      rootScope,
      idenService,
      bkpService;
    beforeEach(inject(($controller, $rootScope, backupService, identityService) => {
      scope = $rootScope.$new();
      rootScope = $rootScope;
      idenService = identityService;
      bkpService = backupService;
      ctrl = $controller('MoreController', {
        $scope: scope,
      });
      saveAsLastCall = null;
    }));

    it('Backup Wallet controller #download', () => {
      const w = scope.wallet;
      expect(saveAsLastCall).equal(null);
      scope.downloadWalletBackup();

      expect(saveAsLastCall.blob.size).equal(7);
      expect(saveAsLastCall.blob.type).equal('text/plain;charset=utf-8');
    });

    it('Backup Wallet controller should name backup correctly for multiple copayers', () => {
      const w = scope.wallet;
      expect(saveAsLastCall).equal(null);
      scope.downloadWalletBackup();
      expect(saveAsLastCall.filename).equal('nickname-fakeWallet-keybackup.json.aes');
    });

    it('Backup Wallet controller should name backup correctly for 1-1 wallet', () => {
      const w = scope.wallet;
      expect(saveAsLastCall).equal(null);
      scope.wallet.totalCopayers = 1;
      scope.downloadWalletBackup();
      expect(saveAsLastCall.filename).equal('fakeWallet-keybackup.json.aes');
    });

    it('Delete a wallet', inject(($timeout) => {
      const w = scope.wallet;

      scope.deleteWallet();
      $timeout.flush();
      scope.$digest();
      scope.iden.deleteWallet.calledOnce.should.equal(true);
      scope.iden.deleteWallet.getCall(0).args[0].should.equal(w.getId());
    }));

    it('#save', () => {
      const old = rootScope.wallet.changeSettings;
      rootScope.wallet.changeSettings = sinon.stub().returns(null);
      scope.selectedUnit = {};
      scope.save();
      rootScope.wallet.changeSettings.calledOnce.should.equal.true;
      rootScope.wallet.changeSettings = old;
    });

    it('#purge checking balance', () => {
      const old = rootScope.wallet.purgeTxProposals;
      rootScope.wallet.purgeTxProposals = sinon.stub().returns(true);
      scope.purge();
      rootScope.wallet.purgeTxProposals.calledOnce.should.equal.true;
      rootScope.wallet.purgeTxProposals = old;
    });

    it('#purge without checking balance', () => {
      const old = rootScope.wallet.purgeTxProposals;
      rootScope.wallet.purgeTxProposals = sinon.stub().returns(false);
      scope.purge();
      rootScope.wallet.purgeTxProposals.calledOnce.should.equal.true;
      rootScope.wallet.purgeTxProposals = old;
    });

    it('#updateIndexes', () => {
      const old = rootScope.wallet.purgeTxProposals;
      rootScope.wallet.updateIndexes = sinon.stub().yields();
      scope.updateIndexes();
      rootScope.wallet.updateIndexes.calledOnce.should.equal.true;
      rootScope.wallet.updateIndexes = old;
    });

    it('#updateIndexes return error', () => {
      const old = rootScope.wallet.purgeTxProposals;
      rootScope.wallet.updateIndexes = sinon.stub().yields('error');
      scope.updateIndexes();
      rootScope.wallet.updateIndexes.calledOnce.should.equal.true;
      rootScope.wallet.updateIndexes = old;
    });

    it('#deleteWallet', inject(($timeout) => {
      const old = idenService.deleteWallet;
      idenService.deleteWallet = sinon.stub().yields(null);
      scope.deleteWallet();
      $timeout.flush();
      idenService.deleteWallet.calledOnce.should.equal.true;
      scope.loading.should.be.false;
      idenService.deleteWallet = old;
    }));

    it('#deleteWallet with error', inject(($timeout) => {
      const old = idenService.deleteWallet;
      idenService.deleteWallet = sinon.stub().yields('error');
      scope.deleteWallet();
      $timeout.flush();
      idenService.deleteWallet.calledOnce.should.equal.true;
      scope.error.should.be.equal('error');
      idenService.deleteWallet = old;
    }));

    it('#viewWalletBackup', () => {
      const old = bkpService.walletEncrypted;
      bkpService.walletEncrypted = sinon.stub().returns('backup0001');
      scope.viewWalletBackup();
      bkpService.walletEncrypted.calledOnce.should.equal.true;
      bkpService.walletEncrypted = old;
    });

    it('#copyWalletBackup', () => {
      const old = bkpService.walletEncrypted;
      bkpService.walletEncrypted = sinon.stub().returns('backup0001');
      window.cordova = {
        plugins: {
          clipboard: {
            copy(e) {
              return e;
            },
          },
        },
      };

      window.plugins = {
        toast: {
          showShortCenter(e) {
            return e;
          },
        },
      };
      scope.copyWalletBackup();
      bkpService.walletEncrypted.calledOnce.should.equal.true;
      bkpService.walletEncrypted = old;
    });

    it('#sendWalletBackup', () => {
      const old = bkpService.walletEncrypted;
      bkpService.walletEncrypted = sinon.stub().returns('backup0001');

      window.plugins = {
        toast: {
          showShortCenter(e) {
            return e;
          },
        },
      };

      window.plugin = {
        email: {
          open(e) {
            return e;
          },
        },
      };
      scope.sendWalletBackup();
      bkpService.walletEncrypted.calledOnce.should.equal.true;
      bkpService.walletEncrypted = old;
    });
  });
});
