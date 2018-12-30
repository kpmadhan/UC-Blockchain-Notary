const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const bitcoinMessage = require('bitcoinjs-message');

const Block = require('./Blocks');
const Blockchain = require('./simpleChain');
const StarValidation = require('./memPoolValidation');
const myBlockChain = new Blockchain();


app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded


/**
 * Blockchain ID validation routine
 **/
requestValidation();
signatureValidate();

/**
 * Star registration Endpoint
 **/
addStarInfo();

/**
 * Star Lookup
 **/
getStarsbyHash();
getStarsbyAddress();
getStarsbyHeight();

/**
 * Blockchain ID validation routine
 * Criteria 1 - /RequestValidation to validate the json 
 * With the message [walletAddress]:[timeStamp]:starRegistry , Validation window of five minutes.
 * & When re-submitting within validation window, the validation window reduces until it expires.
 */
function requestValidation(){
app.post('/requestValidation', async (req, res) => {
  if (!req.body.address) {
    res.status(500).send('Address Parameter missing')
    return;
  }
  const address = req.body.address;
  const requestTimeStamp = Date.now();
  const message = `${address}:${requestTimeStamp}:starRegistry`;
  const validationWindow = 300;
  const data = {
    walletaddress: address,
    requestTimeStamp: requestTimeStamp,
    message: message,
    validationWindow: validationWindow
  };
  try {
    let validate = await StarValidation.getValidate(address);
    validate = JSON.parse(validate);
    const isExpired = Date.now() - validate.requestTimeStamp > validate.validationWindow * 1000;
    if (isExpired) {
      StarValidation.addRequestValidation(address, JSON.stringify(data));
    } else {
      data.message = validate.message
      data.requestTimeStamp = validate.requestTimeStamp
      data.validationWindow = Math.floor((validate.validationWindow * 1000 - (Date.now() - validate.requestTimeStamp)) / 1000);
    }
  } catch (error) {
    StarValidation.addRequestValidation(address, JSON.stringify(data));
  }
  res.json(data);
})
}

/**
 * Blockchain ID validation routine
 * Criteria 2 - //message-signature/validate to validate the json 
 * Verify that the time window of 5 minutes didn't expired. Upon validation, the user is granted access to register a single star.
 * */

function signatureValidate(){
app.post('/message-signature/validate', async (req, res) => {
  if (!req.body.address || !req.body.signature) {
    res.status(500).send('Address & Signature Parameter required')
    return;
  }

  const {
    address,
    signature
  } = req.body;
  let registerStar, status;
  try {
    let validate = await StarValidation.getValidate(address);
    validate = JSON.parse(validate);

    if (validate.messageSignature === 'valid') {
      res.json({
        registerStar: true,
        status: validate
      })
      return;
    }
    const isExpired = Date.now() - validate.requestTimeStamp > validate.validationWindow * 1000;
    if (isExpired) {
      registerStar = false;
      validate.messageSignature = 'invalid';
    } else {
      validate.validationWindow = Math.floor((validate.validationWindow * 1000 - (Date.now() - validate.requestTimeStamp)) / 1000);
      try {
        registerStar = bitcoinMessage.verify(validate.message, address, signature);
      } catch (error) {
        console.log(error)
        registerStar = false;
      }
      validate.messageSignature = registerStar ? 'valid' : 'invalid'
    }
    StarValidation.addRequestValidation(address, JSON.stringify(validate))
    res.json({
      registerStar: registerStar,
      status: validate
    })
  } catch (error) {
    res.status(500).send('Internal Error')
  }
})
}

/**
 * Star registration Endpoint
 * Criteria 3 - /block
 * submits the Star information to be saved in the Blockchain.
 * */

function addStarInfo(){
app.post('/block', async (req, res) => {
  const body = {
    address,
    star
  } = req.body
  if (!address || !star) {
    res.status(500).send('Address / Star Parameter missing')
    return;
  }
  const {
    dec,
    ra,
    story
  } = star
  if (typeof dec !== 'string' || typeof ra !== 'string' || typeof story !== 'string' || !dec.length || !ra.length || !story.length || new Buffer(story).length > 500) {
    res.status(500).send('Either attributes missing or Story too long ')
    return;
  }

  let validate;
  try {
    validate = await StarValidation.getValidate(address)
  } catch (error) {
    res.status(500).send(error.message)
    return;
  }
  validate = JSON.parse(validate);
  if (validate.messageSignature !== 'valid') {
    res.status(503).send('Invalid Signature')
    return;
  }

  body.star.story = new Buffer(story).toString('hex')
  await myBlockChain.addBlock(new Block(body));
  const height = await myBlockChain.getBlockHeight();
  const block = await myBlockChain.getBlock(height);
  await StarValidation.deleteValidate(address)
  res.json(block);
})
}
/**
 * Star Lookup
 * Criteria 4 - /stars/hash:[HASH]
 * Get Star block by hash with JSON response.
 * */
function getStarsbyHash() {
app.get('/stars/hash:hash', async (req, res) => {
  try {
    const hash = req.params.hash.slice(1);
    const block = await myBlockChain.getBlockByHash(hash);
    res.json(block)
  } catch (error) {
    res.status(404).send('Block does not exist')
  }
})
}
/**
 * Star Lookup
 * Criteria 5 - /stars/address:[ADDRESS]
 * Get Star block by wallet address (blockchain identity) with JSON response.
 * */
function getStarsbyAddress() {
app.get('/stars/address:address', async (req, res) => {
  try {
    const address = req.params.address.slice(1);
    const blocks = await myBlockChain.getBlocksByAddress(address);
    res.json(blocks)
  } catch (error) {
    res.status(500).send(error.message)
  }
})
}

/**
 * Star Lookup
 * Criteria 6 - /block/[HEIGHT]
 * Get star block by star block height with JSON response.
 * */

function getStarsbyHeight(){
app.get('/block/:height', async (req, res) => {
  let block = await myBlockChain.getBlock(req.params.height)
  if (block) {
    block.body.star.storyDecoded = new Buffer(block.body.star.story, 'hex').toString()
    res.json(block);
  } else {
    res.status(404).send('No such block exist ')
  }
})
}

app.listen(8000, () => console.log('listening port 8000'))
