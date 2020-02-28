'use strict'

const waterfall = require('async/waterfall')
const each = require('async/each')

const Message = require('libp2p-kad-dht/src/message')
const utils = require('libp2p-kad-dht/src/utils')
const eccrypto = require("eccrypto");
const protons = require("protons");

const pbm = protons(require("../../message/dht.proto"));


module.exports = (dht) => {
    const log = utils.logger(dht.peerInfo.id, 'rpc:send-msg')

    /**
     * Process `SendMsg` DHT messages.
     *
     * @param {PeerInfo} peer
     * @param {Message} msg
     * @param {function(Error, Message)} callback
     * @returns {undefined}
     */

    return async function sendMessage(peer, msg) {
        log('start')

        /*console.log("your dht object private keys");
        console.log(dht.currentPrivateKeys);
        console.log("your default private key is");
        console.log(dht.peerInfo.id._privKey._key);
        console.log("The corresponding public key is");
        console.log(dht.peerInfo.id._pubKey._key);*/

        //1 TRY TO DECRYPT THE MESSAGE
        //2 SEND MESSAGE TO ALL YOUR CLOSEST PEERS TO THAT MESSAGE ANYWAY

        //Try to decrypt message with all my current ephemeral private keys, or, in none work, my default private key

        let decryptSuccess = false;

        //decode encrypted message
        const decodedMsg = pbm.CypherText.decode(msg.record.value);

        for (const privKeyStr of dht.currentPrivateKeys.values()) {
            console.log("trying to decrypt using private ephemeral keys");
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

                    dht.emit("kad-msg-received", { sender: decodedMsgObject.senderId, msg: decodedMsgObject.msgText.toString() });
                },
                () => {
                    //Placeholder for any decryption failure log
                }
            );
            if (decryptSuccess) {
                console.log("Successfully decrypted with ephemeral key")
                break;
            }
        }


        if (!decryptSuccess) {
            console.log("Trying to decrypt using default private key")
            eccrypto.decrypt(dht.peerInfo.id._privKey._key, decodedMsg).then(
                function (plaintext) {

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

                    dht.emit("kad-msg-received", { sender: decodedMsgObject.senderId, msg: decodedMsgObject.msgText.toString() });

                },
                error => {
                    console.log("Received message was not for me");
                    console.log(error);
                }
            );
        }

        //Forwarding of message
        if (msg._clusterLevelRaw > 0) {
            msg._clusterLevelRaw = msg._clusterLevelRaw - 1 //decreases 1
            const peers = dht.routingTable.closestPeers(peer.id.id, dht.kBucketSize)

            peers.forEach(nextPeer => {
                try {
                    await dht.network.sendMessage(nextPeer, msg);
                }
                catch (error) { if (error) log(error) }
            });

        }


    }
}