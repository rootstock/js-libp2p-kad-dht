"use strict";

const waterfall = require("async/waterfall");
const each = require("async/each");

const Message = require("../../message");
const utils = require("../../utils");
const eccrypto = require("eccrypto");
const protons = require("protons");

const pbm = protons(require("../../message/dht.proto"));

module.exports = dht => {
  const log = utils.logger(dht.peerInfo.id, "rpc:send-msg");

  /**
   * Process `SendMsg` DHT messages.
   *
   * @param {PeerInfo} peer
   * @param {Message} msg
   * @param {function(Error, Message)} callback
   * @returns {undefined}
   */

  return function sendMessage(peer, msg, callback) {
    log("start");

    /*console.log("your dht object private keys");
    console.log(dht.currentPrivateKeys);
    console.log("your default private key is");
    console.log(dht.peerInfo.id._privKey._key);
    console.log("The corresponding public key is");
    console.log(dht.peerInfo.id._pubKey._key);*/

    //Try to decrypt message with all my current ephemeral private keys, or, in none work, my default private key

    let decryptSuccess = false;

    //decode encrypted message
    const decodedMsg = pbm.CypherText.decode(msg.record.value);

    for (const privKeyStr of dht.currentPrivateKeys.values()) {
      const privKey = Buffer.from(privKeyStr, "base64");

      eccrypto.decrypt(privKey, decodedMsg).then(
        plaintext => {
          decryptSuccess = true;
          dht.currentPrivateKeys.delete(privKeyStr); //If a private key was successfully used to decrypt, then the node discards it
          //Save ephemeral public key to be used with this contact
          const decodedMsgObject = pbm.MsgContent.decode(plaintext);

          const pubKey = decodedMsg.ephemPublicKey.toString("base64");
          if (!dht.currentRecipientPublicKeys.has(decodedMsgObject.senderId)) {
            dht.currentRecipientPublicKeys.set(
              decodedMsgObject.senderId,
              new Set()
            );
          }

          console.log(
            "Saving ephemeral key %s for user %s",
            pubKey,
            decodedMsgObject.senderId
          );

          dht.currentRecipientPublicKeys
            .get(decodedMsgObject.senderId)
            .add(pubKey);

          dht.emit("kad-msg-received", {sender: decodedMsgObject.senderId, msg:decodedMsgObject.msgText.toString()});
        },
        () => {
          //Placeholder for any decryption failure log
        }
      );
      if (decryptSuccess) {
        break;
      }
    }

    if (!decryptSuccess) {
      eccrypto.decrypt(dht.peerInfo.id._privKey._key, decodedMsg).then(
        function(plaintext) {
          
          //Save ephemeral public key to be used with this contact
          const decodedMsgObject = pbm.MsgContent.decode(plaintext);

          const pubKey = decodedMsg.ephemPublicKey.toString("base64");
          if (!dht.currentRecipientPublicKeys.has(decodedMsgObject.senderId)) {
            dht.currentRecipientPublicKeys.set(
              decodedMsgObject.senderId,
              new Set()
            );
          }
          console.log(
            "Saving ephemeral key %s for user %s",
            pubKey,
            decodedMsgObject.senderId
          );

          dht.currentRecipientPublicKeys
            .get(decodedMsgObject.senderId)
            .add(pubKey);

          dht.emit("kad-msg-received", {sender: decodedMsgObject.senderId, msg:decodedMsgObject.msgText.toString()});

        },
        error => {
          console.log("Received message was not for me");
          console.log(error);
        }
      );
    }

    //Forwarding of message
    if (msg._clusterLevelRaw > 0) {
      msg._clusterLevelRaw = msg._clusterLevelRaw - 1; //decreases 1
      const peers = dht.routingTable.closestPeers(peer.id.id, dht.kBucketSize);
      waterfall(
        [
          //(cb) => {dht._betterPeersToQuery(msg, peer, cb)},
          cb => {
            each(
              peers,
              (nextPeer, cb) => {
                dht.network.sendMessage(nextPeer, msg, err => {
                  //if (err) errors.push(err)
                  cb();
                });
              },
              cb
            );
          }
        ],
        callback(null)
      );
    } else {
      callback(null);
    }
    //}
  };
};
