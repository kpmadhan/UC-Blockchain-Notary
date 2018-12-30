'use strict';
const Block = require('./Blocks');
const SHA256 = require('crypto-js/sha256');
const db = require('level')('./data/chain')

class Blockchain{
  constructor(){
    this.getBlockHeight().then((height) => {
      if (height === -1) {
        this.addBlock(new Block('Genesis block')).then(() => console.log('Genesis block added!'))
      }
    });
  }


  async addBlock(newBlock){
   
    const height = parseInt(await this.getBlockHeight());
    newBlock.height = height + 1;
    newBlock.time = new Date().getTime().toString().slice(0,-3);
    if(newBlock.height>0){
      const prevBlock = await this.getBlock(height);
      newBlock.previousBlockHash = prevBlock.hash;
      console.log('previousBlockHash',newBlock.previousBlockHash)
    }
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
    await this.addBlockToDB(newBlock.height,JSON.stringify(newBlock).toString())
  }

    async getBlockHeight(){
      return await this.getBlockHeightFromDB()
    }

    async getBlock(blockHeight){
      try {
        let blockJson = await this.getBlockToDB(blockHeight)
        return JSON.parse(blockJson);
      } catch (error) {
        return null
      }
    }

    async getBlocksByAddress(address) {
      let blocks = [];
      return new Promise((resolve, reject) => {
        db.createReadStream().on('data', function(data) {
            if (data.key !== 0) {
              let block = JSON.parse(data.value);
              if (block.body.address === address) {
                block.body.star.storyDecoded = new Buffer(block.body.star.story, 'hex').toString();
                blocks.push(block);
              }
            }
          }).on('error', function(err) {
            reject(err)
          }).on('close', function() {
            resolve(blocks)
          });
      })
    }

    async getBlockByHash(hash) {
      let block;
      return new Promise((resolve, reject) => {
        db.createReadStream().on('data', function(data) {
          block = JSON.parse(data.value);
          if (block.hash === hash) {
            if (data.key !== 0) {
              block.body.star.storyDecoded = new Buffer(block.body.star.story, 'hex').toString();
            }
            return resolve(block);
          }
          }).on('error', function(err) {
            reject(err)
          }).on('close', function() {
            reject("Block don't exist!")
          });
      })
    }

  
    async addBlockToDB(key, value){
      return new Promise((resolve, reject) => {
        db.put(key, value, function(err) {
          if (err) {
            reject(err)
          } else {
            console.log(`Add Block #${key} success`)
            resolve(`Add Block #${key} success`)
          }
        })
      })
    }


    async getBlockToDB(key){
      return new Promise((resolve, reject) => {
        db.get(key, function(err, value) {
          if (err) {
            reject(err)
          } else {
            resolve(value)
          }
        })
      })
    }

    async getBlockHeightFromDB() {
      return new Promise((resolve, reject) => {
        let height = -1;
        db.createReadStream().on('data', function(data) {
            height++;
            }).on('error', function(err) {
              reject(err)
            }).on('close', function() {
              resolve(height)
            });
      })
    }

    async getDataArray() {
      let dataArray = [];
      return new Promise((resolve, reject) => {
        db.createReadStream().on('data', function(data) {
              dataArray.push(data)
            }).on('error', function(err) {
              reject(err)
            }).on('close', function() {
              resolve(dataArray)
            });
      })
    }
}

module.exports = Blockchain
