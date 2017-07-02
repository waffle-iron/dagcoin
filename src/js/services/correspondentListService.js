

var constants = require('byteballcore/constants.js');
var eventBus = require('byteballcore/event_bus.js');
const ValidationUtils = require('byteballcore/validation_utils.js');
var objectHash = require('byteballcore/object_hash.js');

angular.module('copayApp.services').factory('correspondentListService', ($state, $rootScope, $sce, $compile, configService, storageService, profileService, go, lodash, $stickyState, $deepStateRedirect, $timeout) => {
  const root = {};
  const device = require('byteballcore/device.js');
  const wallet = require('byteballcore/wallet.js');

  const chatStorage = require('byteballcore/chat_storage.js');
  $rootScope.newMessagesCount = {};
  $rootScope.newMsgCounterEnabled = false;

  if (typeof nw !== 'undefined') {
    const win = nw.Window.get();
    win.on('focus', () => {
      $rootScope.newMsgCounterEnabled = false;
    });
    win.on('blur', () => {
      $rootScope.newMsgCounterEnabled = true;
    });
    $rootScope.$watch('newMessagesCount', (counters) => {
      const sum = lodash.sum(lodash.values(counters));
      if (sum) {
        win.setBadgeLabel(`${sum}`);
      } else {
        win.setBadgeLabel('');
      }
    }, true);
  }
  $rootScope.$watch('newMessagesCount', (counters) => {
    $rootScope.totalNewMsgCnt = lodash.sum(lodash.values(counters));
  }, true);

  function addIncomingMessageEvent(from_address, body) {
    const walletGeneral = require('byteballcore/wallet_general.js');
    walletGeneral.readMyAddresses((arrMyAddresses) => {
      body = highlightActions(escapeHtml(body), arrMyAddresses);
      body = text2html(body);
      console.log(`body with markup: ${body}`);
      addMessageEvent(true, from_address, body);
    });
  }

  function addMessageEvent(bIncoming, peer_address, body) {
    if (!root.messageEventsByCorrespondent[peer_address]) { root.messageEventsByCorrespondent[peer_address] = []; }
		// root.messageEventsByCorrespondent[peer_address].push({bIncoming: true, message: $sce.trustAsHtml(body)});
    if (bIncoming) {
      if (peer_address in $rootScope.newMessagesCount) { $rootScope.newMessagesCount[peer_address]++; } else {
        $rootScope.newMessagesCount[peer_address] = 1;
      }
      if ($rootScope.newMessagesCount[peer_address] == 1 && (!$state.is('correspondentDevices.correspondentDevice') || root.currentCorrespondent.device_address != peer_address)) {
        root.messageEventsByCorrespondent[peer_address].push({
          bIncoming: false,
          message: 'new messages',
          type: 'system',
          new_message_delim: true,
        });
      }
    }
    const msg_obj = {
      bIncoming,
      message: body,
      timestamp: Math.floor(Date.now() / 1000),
    };
    checkAndInsertDate(root.messageEventsByCorrespondent[peer_address], msg_obj);
    root.messageEventsByCorrespondent[peer_address].push(msg_obj);
    if ($state.is('walletHome') && $rootScope.tab == 'walletHome') {
      setCurrentCorrespondent(peer_address, (bAnotherCorrespondent) => {
        $stickyState.reset('correspondentDevices.correspondentDevice');
        go.path('correspondentDevices.correspondentDevice');
      });
    }		else			{ $rootScope.$digest(); }
  }

  const payment_request_regexp = /\[.*?\]\(byteball:([0-9A-Z]{32})\?([\w=&;+%]+)\)/g; // payment description within [] is ignored

  function highlightActions(text, arrMyAddresses) {
    return text.replace(/\b[2-7A-Z]{32}\b(?!(\?(amount|asset|device_address)|"))/g, (address) => {
      if (!ValidationUtils.isValidAddress(address)) { return address; }
		//	if (arrMyAddresses.indexOf(address) >= 0)
		//		return address;
			// return '<a send-payment address="'+address+'">'+address+'</a>';
      return `<a dropdown-toggle="#pop${address}">${address}</a><ul id="pop${address}" class="f-dropdown drop-to4p drop-4up" style="left:0px" data-dropdown-content><li><a ng-click="sendPayment('${address}')">Pay to this address</a></li><li><a ng-click="offerContract('${address}')">Offer a contract</a></li></ul>`;
		//	return '<a ng-click="sendPayment(\''+address+'\')">'+address+'</a>';
			// return '<a send-payment ng-click="sendPayment(\''+address+'\')">'+address+'</a>';
			// return '<a send-payment ng-click="console.log(\''+address+'\')">'+address+'</a>';
			// return '<a onclick="console.log(\''+address+'\')">'+address+'</a>';
    }).replace(payment_request_regexp, (str, address, query_string) => {
      if (!ValidationUtils.isValidAddress(address)) { return str; }
		//	if (arrMyAddresses.indexOf(address) >= 0)
		//		return str;
      const objPaymentRequest = parsePaymentRequestQueryString(query_string);
      if (!objPaymentRequest) { return str; }
      return `<a ng-click="sendPayment('${address}', ${objPaymentRequest.amount}, '${objPaymentRequest.asset}', '${objPaymentRequest.device_address}')">${objPaymentRequest.amountStr}</a>`;
    }).replace(/\[(.+?)\]\(command:(.+?)\)/g, (str, description, command) => `<a ng-click="sendCommand('${escapeQuotes(command)}', '${escapeQuotes(description)}')" class="command">${description}</a>`).replace(/\[(.+?)\]\(payment:(.+?)\)/g, (str, description, paymentJsonBase64) => {
      const arrMovements = getMovementsFromJsonBase64PaymentRequest(paymentJsonBase64, true);
      if (!arrMovements) { return '[invalid payment request]'; }
      description = `Payment request: ${arrMovements.join(', ')}`;
      return `<a ng-click="sendMultiPayment('${paymentJsonBase64}')">${description}</a>`;
    }).replace(/\bhttps?:\/\/\S+/g, str => `<a ng-click="openExternalLink('${escapeQuotes(str)}')" class="external-link">${str}</a>`);
  }

  function getMovementsFromJsonBase64PaymentRequest(paymentJsonBase64, bAggregatedByAsset) {
    const paymentJson = Buffer(paymentJsonBase64, 'base64').toString('utf8');
    console.log(paymentJson);
    try {
      var objMultiPaymentRequest = JSON.parse(paymentJson);
    }		catch (e) {
      return null;
    }
    if (objMultiPaymentRequest.definitions) {
      for (const destinationAddress in objMultiPaymentRequest.definitions) {
        const arrDefinition = objMultiPaymentRequest.definitions[destinationAddress].definition;
        if (destinationAddress !== objectHash.getChash160(arrDefinition)) { return null; }
      }
    }
    try {
      var assocPaymentsByAsset = getPaymentsByAsset(objMultiPaymentRequest);
    }		catch (e) {
      return null;
    }
    let arrMovements = [];
    if (bAggregatedByAsset) {
      for (const asset in assocPaymentsByAsset) { arrMovements.push(getAmountText(assocPaymentsByAsset[asset], asset)); }
    } else			{
      arrMovements = objMultiPaymentRequest.payments.map(objPayment => `${getAmountText(objPayment.amount, objPayment.asset || 'base')} to ${objPayment.address}`);
    }
    return arrMovements;
  }

  function getPaymentsByAsset(objMultiPaymentRequest) {
    const assocPaymentsByAsset = {};
    objMultiPaymentRequest.payments.forEach((objPayment) => {
      const asset = objPayment.asset || 'base';
      if (asset !== 'base' && !ValidationUtils.isValidBase64(asset, constants.HASH_LENGTH)) { throw Error(`asset ${asset} is not valid`); }
      if (!ValidationUtils.isPositiveInteger(objPayment.amount)) { throw Error(`amount ${objPayment.amount} is not valid`); }
      if (!assocPaymentsByAsset[asset]) { assocPaymentsByAsset[asset] = 0; }
      assocPaymentsByAsset[asset] += objPayment.amount;
    });
    return assocPaymentsByAsset;
  }

  function formatOutgoingMessage(text) {
    return escapeHtmlAndInsertBr(text).replace(payment_request_regexp, (str, address, query_string) => {
      if (!ValidationUtils.isValidAddress(address)) { return str; }
      const objPaymentRequest = parsePaymentRequestQueryString(query_string);
      if (!objPaymentRequest) { return str; }
      return `<i>${objPaymentRequest.amountStr} to ${address}</i>`;
    }).replace(/\[(.+?)\]\(payment:(.+?)\)/g, (str, description, paymentJsonBase64) => {
      const arrMovements = getMovementsFromJsonBase64PaymentRequest(paymentJsonBase64);
      if (!arrMovements) { return '[invalid payment request]'; }
      return `<i>Payment request: ${arrMovements.join(', ')}</i>`;
    }).replace(/\bhttps?:\/\/\S+/g, str => `<a ng-click="openExternalLink('${escapeQuotes(str)}')" class="external-link">${str}</a>`);
  }

  function parsePaymentRequestQueryString(query_string) {
    const URI = require('byteballcore/uri.js');
    const assocParams = URI.parseQueryString(query_string, '&amp;');
    const strAmount = assocParams.amount;
    if (!strAmount) { return null; }
    const amount = parseInt(strAmount);
    if (`${amount}` !== strAmount) { return null; }
    if (!ValidationUtils.isPositiveInteger(amount)) { return null; }
    const asset = assocParams.asset || 'base';
    console.log(`asset=${asset}`);
    if (asset !== 'base' && !ValidationUtils.isValidBase64(asset, constants.HASH_LENGTH)) // invalid asset
      { return null; }
    const device_address = assocParams.device_address || '';
    if (device_address && !ValidationUtils.isValidDeviceAddress(device_address)) { return null; }
    const amountStr = `Payment request: ${getAmountText(amount, asset)}`;
    return {
      amount,
      asset,
      device_address,
      amountStr,
    };
  }

  function text2html(text) {
    return text.replace(/\r/g, '').replace(/\n/g, '<br>').replace(/\t/g, ' &nbsp; &nbsp; ');
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeHtmlAndInsertBr(text) {
    return text2html(escapeHtml(text));
  }

  function escapeQuotes(text) {
    return text.replace(/(['\\])/g, '\\$1').replace(/"/, '&quot;');
  }

  function setCurrentCorrespondent(correspondent_device_address, onDone) {
    if (!root.currentCorrespondent || correspondent_device_address !== root.currentCorrespondent.device_address) {
      device.readCorrespondent(correspondent_device_address, (correspondent) => {
        root.currentCorrespondent = correspondent;
        onDone(true);
      });
    } else			{ onDone(false); }
  }

	// amount is in smallest units
  function getAmountText(amount, asset) {
    if (asset === 'base') {
      var walletSettings = configService.getSync().wallet.settings;
      const unitValue = walletSettings.unitValue;
      const unitName = walletSettings.unitName;
      if (amount !== 'all') { amount /= unitValue; }
      return `${amount} ${unitName}`;
    }		else if (asset === constants.BLACKBYTES_ASSET) {
      var walletSettings = configService.getSync().wallet.settings;
      const bbUnitValue = walletSettings.bbUnitValue;
      const bbUnitName = walletSettings.bbUnitName;
      amount /= bbUnitValue;
      return `${amount} ${bbUnitName}`;
    }		return `${amount} of ${asset}`;
  }

  function getHumanReadableDefinition(arrDefinition, arrMyAddresses, arrMyPubKeys, bWithLinks) {
    function parse(arrSubdefinition) {
      const op = arrSubdefinition[0];
      const args = arrSubdefinition[1];
      switch (op) {
        case 'sig':
          var pubkey = args.pubkey;
          return `signed by ${arrMyPubKeys.indexOf(pubkey) >= 0 ? 'you' : `public key ${pubkey}`}`;
        case 'address':
          var address = args;
          return `signed by ${arrMyAddresses.indexOf(address) >= 0 ? 'you' : address}`;
        case 'cosigned by':
          var address = args;
          return `co-signed by ${arrMyAddresses.indexOf(address) >= 0 ? 'you' : address}`;
        case 'not':
          return `<span class="size-18">not</span>${parseAndIndent(args)}`;
        case 'or':
        case 'and':
          return args.map(parseAndIndent).join(`<span class="size-18">${op}</span>`);
        case 'r of set':
          return `at least ${args.required} of the following is true:<br>${args.set.map(parseAndIndent).join(',')}`;
        case 'weighted and':
          return `the total weight of the true conditions below is at least ${args.required}:<br>${args.set.map(arg => `${arg.weight}: ${parseAndIndent(arg.value)}`).join(',')}`;
        case 'in data feed':
          var arrAddresses = args[0];
          var feed_name = args[1];
          var relation = args[2];
          var value = args[3];
          var min_mci = args[4];
          if (feed_name === 'timestamp' && relation === '>') { return `after ${(typeof value === 'number') ? new Date(value).toString() : value}`; }
          var str = `Oracle ${arrAddresses.join(', ')} posted ${feed_name} ${relation} ${value}`;
          if (min_mci) { str += ` after MCI ${min_mci}`; }
          return str;
        case 'in merkle':
          var arrAddresses = args[0];
          var feed_name = args[1];
          var value = args[2];
          var min_mci = args[3];
          var str = `A proof is provided that oracle ${arrAddresses.join(', ')} posted ${value} in ${feed_name}`;
          if (min_mci) { str += ` after MCI ${min_mci}`; }
          return str;
        case 'has':
          if (args.what === 'output' && args.asset && args.amount_at_least && args.address) { return `sends at least ${getAmountText(args.amount_at_least, args.asset)} to ${arrMyAddresses.indexOf(args.address) >= 0 ? 'you' : args.address}`; }
          return JSON.stringify(arrSubdefinition);
        case 'seen':
          if (args.what === 'output' && args.asset && args.amount && args.address) {
            const dest_address = ((args.address === 'this address') ? objectHash.getChash160(arrDefinition) : args.address);
            const bOwnAddress = (arrMyAddresses.indexOf(args.address) >= 0);
            const display_dest_address = (bOwnAddress ? 'you' : args.address);
            const expected_payment = `${getAmountText(args.amount, args.asset)} to ${display_dest_address}`;
            return `there was a transaction that sends ${(bWithLinks && !bOwnAddress) ? (`<a ng-click="sendPayment('${dest_address}', ${args.amount}, '${args.asset}')">${expected_payment}</a>`) : expected_payment}`;
          }
          return JSON.stringify(arrSubdefinition);

        default:
          return JSON.stringify(arrSubdefinition);
      }
    }
    function parseAndIndent(arrSubdefinition) {
      return `<div class="indent">${parse(arrSubdefinition)}</div>\n`;
    }
    return parse(arrDefinition, 0);
  }

  const historyEndForCorrespondent = {};
  function loadMoreHistory(correspondent, cb) {
    if (historyEndForCorrespondent[correspondent.device_address]) {
      if (cb) cb();
      return;
    }
    if (!root.messageEventsByCorrespondent[correspondent.device_address]) { root.messageEventsByCorrespondent[correspondent.device_address] = []; }
    const messageEvents = root.messageEventsByCorrespondent[correspondent.device_address];
    const limit = 10;
    let last_msg_ts = null;
    let last_msg_id = 90071992547411;
    if (messageEvents.length && messageEvents[0].id) {
      last_msg_ts = new Date(messageEvents[0].timestamp * 1000);
      last_msg_id = messageEvents[0].id;
    }
    chatStorage.load(correspondent.device_address, last_msg_id, limit, (messages) => {
      for (const i in messages) {
        messages[i] = parseMessage(messages[i]);
      }
      const walletGeneral = require('byteballcore/wallet_general.js');
      walletGeneral.readMyAddresses((arrMyAddresses) => {
        if (messages.length < limit) { historyEndForCorrespondent[correspondent.device_address] = true; }
        for (const i in messages) {
          const message = messages[i];
          const msg_ts = new Date(message.creation_date.replace(' ', 'T'));
          if (last_msg_ts && last_msg_ts.getDay() != msg_ts.getDay()) {
            messageEvents.unshift({ type: 'system', bIncoming: false, message: last_msg_ts.toDateString(), timestamp: Math.floor(msg_ts.getTime() / 1000) });
          }
          last_msg_ts = msg_ts;
          if (message.type == 'text') {
            if (message.is_incoming) {
              message.message = highlightActions(escapeHtml(message.message), arrMyAddresses);
              message.message = text2html(message.message);
            } else {
              message.message = formatOutgoingMessage(message.message);
            }
          }
          messageEvents.unshift({ id: message.id, type: message.type, bIncoming: message.is_incoming, message: message.message, timestamp: Math.floor(msg_ts.getTime() / 1000), chat_recording_status: message.chat_recording_status });
        }
        if (historyEndForCorrespondent[correspondent.device_address] && messageEvents.length > 1) {
          messageEvents.unshift({ type: 'system', bIncoming: false, message: (last_msg_ts || new Date()).toDateString(), timestamp: Math.floor((last_msg_ts || new Date()).getTime() / 1000) });
        }
        $rootScope.$digest();
        if (cb) cb();
      });
    });
  }

  function checkAndInsertDate(messageEvents, message) {
    if (messageEvents.length == 0 || typeof messageEvents[messageEvents.length - 1].timestamp === 'undefined') return;

    const msg_ts = new Date(message.timestamp * 1000);
    const last_msg_ts = new Date(messageEvents[messageEvents.length - 1].timestamp * 1000);
    if (last_msg_ts.getDay() != msg_ts.getDay()) {
      messageEvents.push({ type: 'system', bIncoming: false, message: msg_ts.toDateString(), timestamp: Math.floor(msg_ts.getTime() / 1000) });
    }
  }

  function parseMessage(message) {
    switch (message.type) {
      case 'system':
        message.message = JSON.parse(message.message);
        message.message = `chat recording ${message.message.state ? '&nbsp;' : ''}<b dropdown-toggle="#recording-drop">${message.message.state ? 'ON' : 'OFF'}</b><span class="padding"></span>`;
        message.chat_recording_status = true;
        break;
    }
    return message;
  }

  eventBus.on('text', (from_address, body) => {
    mutex.lock(['handle_message'], (unlock) => {
      device.readCorrespondent(from_address, (correspondent) => {
        if (!root.messageEventsByCorrespondent[correspondent.device_address]) loadMoreHistory(correspondent);
        addIncomingMessageEvent(correspondent.device_address, body);
        if (correspondent.my_record_pref && correspondent.peer_record_pref) chatStorage.store(from_address, body, 1);
        unlock();
      });
    });
  });

  eventBus.on('chat_recording_pref', (correspondent_address, enabled) => {
    mutex.lock(['handle_message'], (unlock) => {
      device.readCorrespondent(correspondent_address, (correspondent) => {
        const oldState = (correspondent.peer_record_pref && correspondent.my_record_pref);
        correspondent.peer_record_pref = enabled;
        const newState = (correspondent.peer_record_pref && correspondent.my_record_pref);
        device.updateCorrespondentProps(correspondent);
        if (newState != oldState) {
          if (!root.messageEventsByCorrespondent[correspondent_address]) root.messageEventsByCorrespondent[correspondent_address] = [];
          const message = {
            type: 'system',
            message: JSON.stringify({ state: newState }),
            timestamp: Math.floor(Date.now() / 1000),
            chat_recording_status: true,
          };
          root.messageEventsByCorrespondent[correspondent_address].push(parseMessage(message));
          $rootScope.$digest();
          chatStorage.store(correspondent_address, JSON.stringify({ state: newState }), 0, 'system');
        }
        if (root.currentCorrespondent && root.currentCorrespondent.device_address == correspondent_address) {
          root.currentCorrespondent.peer_record_pref = enabled ? 1 : 0;
        }
        unlock();
      });
    });
  });

  eventBus.on('sent_payment', (peer_address, amount, asset) => {
    setCurrentCorrespondent(peer_address, (bAnotherCorrespondent) => {
      const body = `<a ng-click="showPayment('${asset}')" class="payment">Payment: ${getAmountText(amount, asset)}</a>`;
      addMessageEvent(false, peer_address, body);
      device.readCorrespondent(peer_address, (correspondent) => {
        if (correspondent.my_record_pref && correspondent.peer_record_pref) chatStorage.store(peer_address, body, 0, 'html');
      });
      go.path('correspondentDevices.correspondentDevice');
    });
  });

  eventBus.on('received_payment', (peer_address, amount, asset) => {
    const body = `<a ng-click="showPayment('${asset}')" class="payment">Payment: ${getAmountText(amount, asset)}</a>`;
    addMessageEvent(true, peer_address, body);
    device.readCorrespondent(peer_address, (correspondent) => {
      if (correspondent.my_record_pref && correspondent.peer_record_pref) chatStorage.store(peer_address, body, 1, 'html');
    });
  });

  eventBus.on('paired', (device_address) => {
    if ($state.is('correspondentDevices')) { return $state.reload(); } // refresh the list
    if (!$state.is('correspondentDevices.correspondentDevice')) { return; }
    if (!root.currentCorrespondent) { return; }
    if (device_address !== root.currentCorrespondent.device_address) { return; }
		// re-read the correspondent to possibly update its name
    device.readCorrespondent(device_address, (correspondent) => {
			// do not assign a new object, just update its property (this object was already bound to a model)
      root.currentCorrespondent.name = correspondent.name;
      $rootScope.$digest();
    });
  });

	 eventBus.on('removed_paired_device', (device_address) => {
   if ($state.is('correspondentDevices')) { return $state.reload(); } // todo show popup after refreshing the list
   if (!$state.is('correspondentDevices.correspondentDevice'))		 	{ return; }
   if (!root.currentCorrespondent)		 	{ return; }
   if (device_address !== root.currentCorrespondent.device_address)		 	{ return; }

		// go back to list of correspondentDevices
		// todo show popup message
		// todo return to correspondentDevices when in edit-mode, too
   $deepStateRedirect.reset('correspondentDevices');
   go.path('correspondentDevices');
   $timeout(() => {
     $rootScope.$digest();
   });
 });


  $rootScope.$on('Local/CorrespondentInvitation', (event, device_pubkey, device_hub, pairing_secret) => {
    console.log('CorrespondentInvitation', device_pubkey, device_hub, pairing_secret);
    root.acceptInvitation(device_hub, device_pubkey, pairing_secret, () => {});
  });


  root.getPaymentsByAsset = getPaymentsByAsset;
  root.getAmountText = getAmountText;
  root.setCurrentCorrespondent = setCurrentCorrespondent;
  root.formatOutgoingMessage = formatOutgoingMessage;
  root.getHumanReadableDefinition = getHumanReadableDefinition;
  root.loadMoreHistory = loadMoreHistory;
  root.checkAndInsertDate = checkAndInsertDate;
  root.parseMessage = parseMessage;

  root.list = function (cb) {
	  device.readCorrespondents((arrCorrespondents) => {
		  cb(null, arrCorrespondents);
	  });
  };


  root.startWaitingForPairing = function (cb) {
    device.startWaitingForPairing((pairingInfo) => {
      cb(pairingInfo);
    });
  };

  root.acceptInvitation = function (hub_host, device_pubkey, pairing_secret, cb) {
		// return setTimeout(cb, 5000);
    if (device_pubkey === device.getMyDevicePubKey()) { return cb('cannot pair with myself'); }
		// the correspondent will be initially called 'New', we'll rename it as soon as we receive the reverse pairing secret back
    device.addUnconfirmedCorrespondent(device_pubkey, hub_host, 'New', (device_address) => {
      device.startWaitingForPairing((reversePairingInfo) => {
        device.sendPairingMessage(hub_host, device_pubkey, pairing_secret, reversePairingInfo.pairing_secret, {
          ifOk: cb,
          ifError: cb,
        });
      });
			// this continues in parallel
			// open chat window with the newly added correspondent
      device.readCorrespondent(device_address, (correspondent) => {
        root.currentCorrespondent = correspondent;
        if (!$state.is('correspondentDevices.correspondentDevice')) { go.path('correspondentDevices.correspondentDevice'); } else {
          $stickyState.reset('correspondentDevices.correspondentDevice');
          $state.reload();
        }
      });
    });
  };

  root.currentCorrespondent = null;
  root.messageEventsByCorrespondent = {};

  /*
  root.remove = function(addr, cb) {
	var fc = profileService.focusedClient;
	root.list(function(err, ab) {
	  if (err) return cb(err);
	  if (!ab) return;
	  if (!ab[addr]) return cb('Entry does not exist');
	  delete ab[addr];
	  storageService.setCorrespondentList(fc.credentials.network, JSON.stringify(ab), function(err) {
		if (err) return cb('Error deleting entry');
		root.list(function(err, ab) {
		  return cb(err, ab);
		});
	  });
	});
  };

  root.removeAll = function() {
	var fc = profileService.focusedClient;
	storageService.removeCorrespondentList(fc.credentials.network, function(err) {
	  if (err) return cb('Error deleting correspondentList');
	  return cb();
	});
  };*/

  return root;
});
