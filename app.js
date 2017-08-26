'use strict';

const bitcoin = require('bitcoinjs-lib');
const coininfo = require('@monaco-ex/coininfo');

const coinselect = require('coinselect');
const feeRate = 1000;

const network = coininfo('MONA').toBitcoinJS();
network.messagePrefix = ''; //hack

const ElectrumClient = require('electrum-client');

const cli = new ElectrumClient(50001, 'electrumx.tamami-foundation.org', 'tcp');

const wif = process.env.WIF;

const keyPair = bitcoin.ECPair.fromWIF(wif, network);
const fromAddress = keyPair.getAddress().toString();
console.log('From address: ' + fromAddress);

const targets = [
  { address: 'MA375uccLzk4w5MmsGuex24iHs11tYtdsL',
    value: 6000000 }
]

cli.connect()
  .then(() =>
    cli.subscribe.on('blockchain.headers.subscribe', (v) => console.log(v)))
  .then(() => cli.server_version('2.7.11', '1.0'))
  .then(console.log)
  .then(() => cli.blockchainAddress_listunspent(fromAddress))
  .then(utxos => coinselect(utxos, targets, feeRate))
  .then(res => {
    // .inputs and .outputs will be undefined if no solution was found 
    if (!res.inputs) throw new Error('No input');
    if (!res.outputs) throw new Error('No output');

    let txb = new bitcoin.TransactionBuilder(network);
 
    res.inputs.forEach(input => txb.addInput(input.tx_hash, input.tx_pos));

    res.outputs.forEach(output => {
      // watch out, outputs may have been added that you need to provide 
      // an output address/script for 
      if (!output.address) {
        output.address = fromAddress;
      }
 
      txb.addOutput(output.address, output.value);
    });

    for (let i = 0; i < res.outputs.length; i++) {
      txb.sign(i, keyPair);
    }
    return txb.build().toHex();
  })
  .then(hex => cli.blockchainTransaction_broadcast(hex))
  .then(console.dir)
  .then(() => cli.close())
  .catch(console.error);
    
