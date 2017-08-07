/*jslint node: true */
"use strict";
var headlessWallet = require('../start.js');
var eventBus = require('byteballcore/event_bus.js');
var objectHash = require('byteballcore/object_hash.js');
var walletDefinedByKeys = require('byteballcore/wallet_defined_by_keys.js');
var db = require('byteballcore/db.js');
var device = require('byteballcore/device.js');

function onError(err){
    throw Error(err);
}

let sharable_address = '26XGUF3KJMUJWTKIN4ANZFDIMZ6CYHZQ';

function createAndShareAddress(peer_device_address, peer_address) {
    db.query("SELECT definition FROM definitions WHERE definition_chash = ?", peer_address, function (rows){
        let peer_definition = rows[0].definition;

        let definition = JSON.parse('[\
			"r of set",\
			{\
				"required": 2,\
				"set": [\
					[\
						"sig",\
						{\
							"pubkey": "A3QHZE4QsjDOcnxZ7Zpie8P2rUvU8p49xaboptX+Oi6C"\
						}\
					],'+
            peer_definition +
            ']\
        }\
    ]');

        var wdba = require('byteballcore/wallet_defined_by_addresses.js');

        wdba.createNewSharedAddress(
            definition,
            [
                {device_address: "0VZJNK6SDN2FDZDRXZBNK2IVDUTWTKURA", address: "SY4XXFTNB2PRS37YG3AZK7X2I322RKKA"},
                {device_address: peer_device_address, address: peer_address}
            ],
            {
                ifError(error) {
                    console.error(error);
                },
                ifOk(address) {
                    console.log("Shared address " + address + " was created. Is it equal to " + sharable_address + "?");

                    let body = {"address_definition_template" : definition};

                    device.sendMessageToDevice(peer_device_address, "create_new_shared_address", {
                        "address_definition_template" : ["and",[["address","$address@0VZJNK6SDN2FDZDRXZBNK2IVDUTWTKURA"],["address","$address@" + peer_device_address]]]
                    });
                }
            }
        );
    });
}

function createSharedAddess(){
    let peer_device_address = "0D54ZPX37VJMPGDLTNTT5ITMF2L4ME6SF";
    let peer_address = "TO33AMF76UNX3AMQPHISJYM4GZ57M3DE";
    console.log('EVENT FIRED');

    //let shared_address = objectHash.getChash160(definition);

    readSingleWallet(
        function (wallet_id) {
            walletDefinedByKeys.issueNextAddress(wallet_id, 0, function(addressInfo){
                console.log(addressInfo);

                createAndShareAddress(peer_device_address, peer_address);

                return;

                db.query("SELECT definition FROM my_addresses WHERE address = ?", addressInfo.address ,function(rows){
                    shareAddress(JSON.parse(rows[0].definition));
                    //shareAddress({signing_path: 'r'});
                });
                /*shareAddress(JSON.parse(
                    '["and",[["address","$address@0VZJNK6SDN2FDZDRXZBNK2IVDUTWTKURA"],["address","$address@0P743POLVG43UKTCSE2RO2DMXVXMQCVNN"]]]'));*/
            });
        }
    );
}

function shareAddress(definition) {
    let shared_address = objectHash.getChash160(definition);

    var wdba = require('byteballcore/wallet_defined_by_addresses.js');

    let peer_device_address = "0OSA3KMPMX54K5VOJOD3SKCFBMKPE3MPS";
    let peer_address = "42IJ2NWGNGTOK3APAG6S4Y2DSDSUBC3C";
    //let peer_device_address = "0D54ZPX37VJMPGDLTNTT5ITMF2L4ME6SF";
    //let peer_address = "TO33AMF76UNX3AMQPHISJYM4GZ57M3DE";

    wdba.createNewSharedAddress(
        definition,
        [
            {device_address: "0VZJNK6SDN2FDZDRXZBNK2IVDUTWTKURA", address: "SY4XXFTNB2PRS37YG3AZK7X2I322RKKA"},
            {device_address: peer_device_address, address: peer_address}
        ],
        {
            ifError(error) {
                console.error(error);
            },
            ifOk(address) {
                console.log("Shared address " + address + " was created. Is it equal to " + shared_address + "?");

                let body = {"address_definition_template" : definition};

                device.sendMessageToDevice(peer_device_address, "create_new_shared_address", {
                    "address_definition_template" : ["and",[["address","$address@0VZJNK6SDN2FDZDRXZBNK2IVDUTWTKURA"],["address","$address@" + peer_device_address]]]
                });
            }
        }
    );
}

function readSingleWallet(handleWallet){
    db.query("SELECT wallet FROM wallets", function(rows){
        if (rows.length === 0)
            throw Error("no wallets");
        if (rows.length > 1)
            throw Error("more than 1 wallet");
        handleWallet(rows[0].wallet);
    });
}


eventBus.on('headless_wallet_ready', createSharedAddess);
