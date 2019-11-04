'use strict'

const waterfall = require('async/waterfall')
const each = require('async/each')

const Message = require('libp2p-kad-dht/src/message')
const utils = require('libp2p-kad-dht/src/utils')

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

  /*return function sendMsg (peer, msg, callback) {
    log('start')

    waterfall([
      (cb) => {
        //We should use partial addressing so it should never enter here
        if (msg.key.equals(dht.peerInfo.id.id)) {
          console.log(msg.serialize.toString())
          return cb(null, [dht.peerInfo])
        }

        dht._betterPeersToQuery(msg, peer, cb)
      },
      (closer, cb) => {
        const response = new Message(msg.type, Buffer.alloc(0), msg.clusterLevel)

        if (closer.length > 0) {
          response.closerPeers = closer
        } else {
          log('handle sendMsg %s: could not find anything', peer.id.toB58String())
        }

        cb(null, response)
      }
    ], callback)
  }*/


  return function sendMessage (peer, msg, callback) {
    log('start')

    //1 TRY TO DECRYPT THE MESSAGE
    //2 SEND MESSAGE TO ALL YOUR CLOSEST PEERS TO THAT MESSAGE ANYWAY


    if (msg.key.equals(dht.peerInfo.id.id)){
      //Its me!
      console.log(msg.record.value.toString()) //version dummy de un procesamiento
      callback(null)
    }
    else{
      if(msg._clusterLevelRaw > 0){
        msg._clusterLevelRaw=msg._clusterLevelRaw-1 //decreases 1
        const peers = dht.routingTable.closestPeers(peer.id.id, dht.kBucketSize)
        waterfall([
          //(cb) => {dht._betterPeersToQuery(msg, peer, cb)},
          (cb) => {
            each(peers, (nextPeer, cb) => {
              dht.network.sendMessage(nextPeer, msg, (err) => {
                if (err) errors.push(err)
                cb()
              })
            }, cb)
          }
        ], callback(null))
      }
      else{
        callback(null)
      }

    }
 
  }
}
