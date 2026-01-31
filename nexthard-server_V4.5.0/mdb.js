const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { publish_response } =require('./mqttClient.js');
const delay = ms => new Promise(res => setTimeout(res, ms));

// Remplacez 'COM1' par le port série approprié pour votre système
const port = new SerialPort({
 path: '/dev/nextwave-cashv',
  baudRate: 9600,
});
 
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
 


let lastMessage = null;

const POLL_INTERVAL_MS = 1000; // 4 POLL/s
// === KEEP‑ALIVE / POLL ==============================================
let pollTimer = null;
function poll () {
/*console.log("#");
  write_port('08')              // Coin changer POLL
    .then(() => delay(3))       // petit décalage
    .then(() => write_port('30'))   // Bill validator POLL
    .catch(err => console.error('[POLL]', err.message));
*/
}



const enable_cv=function(){
try{
// ouverture de Monnayeur
write_port('0CFFFFFFFF');
// ouverture de Lecteur Billets
setTimeout(()=>{
write_port('34FFFF0000');

 if (!pollTimer) pollTimer = setInterval(poll, POLL_INTERVAL_MS);


},1500);
publish_response('cv_response','Enabled succesfully','cashvalidator');
}catch(error){
console.log('Error with cash-validator:',error);
return;
}



}

const disable_cv=function(){

  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  
try{ 
// fermeture de Monnayeur
write_port('0C00000000');
// fermeture de Lecteur Billets
setTimeout(()=>{
write_port('3400000000');
},1500);
publish_response('cv_response','Disabled succesfully','cashvalidator');
}catch(error){
console.log('Error with cash-validator:',error);
return;
}
}
 

const validator = function(callback){

parser.on('data', (data) => {
  const hexData = Buffer.from(data, 'hex').toString('hex').toUpperCase();
	if(data.trim()!='30 09'){  
	 console.log('Message reçu:', data);
	}  
let message = null,response = null;
  switch (data.trim()) {
    case '30 09':
      message = 'LECTEUR BILLETS : DEMARRAGE EN COURS';      
	break;
    case '30 03':
      message = 'LECTEUR BILLETS : LECTURE DU BILLET EN COURS';
        break;
    case '08 45 00':
      message = 'MONNAYEUR : 2 EUROS DETECTES';
      response = '200';      
        break;
          case '08 54 00':
          case '08 44 00':
      message = 'MONNAYEUR : 1 EUROS DETECTES';
      response = '100';
        break;
          case '08 53 00':
          case '08 43 00':
      message = 'MONNAYEUR : 50 centimes DETECTES';
      response='50';
      break;
          case '08 52 00':
          case '08 42 00':
      message = 'MONNAYEUR : 20 centimes DETECTES';
      response='20';
      break;
          case '08 51 00':
          case '08 41 00':
      message = 'MONNAYEUR : 10 centimes DETECTES';
     response='10';
	 break;
          case '08 50 00':
          case '08 40 00':
      message = 'MONNAYEUR : 5 centimes DETECTES';
      response='5';
	break;
      case '30 80':
      message = 'LECTEUR BILLETS : 5 EUROS DETECTES';
      response='500';
	break;
    case '30 81':
      message = 'LECTEUR BILLETS : 10 EUROS DETECTES';
      response='1000';
	break;
       case '30 82':
      message = 'LECTEUR BILLETS : 20 EUROS DETECTES';
      response='2000';
	break;
       case '30 83':
      message = 'LECTEUR BILLETS : 50 EUROS DETECTES';
      response='5000';
	break;
       case '30 82':
      message = 'LECTEUR BILLETS : 100 EUROS DETECTES';
      response='10000';
	break;
       case '30 82':
      message = 'LECTEUR BILLETS : 200 EUROS DETECTES';
      response='20000';
	break;
         case '30 86':
      message = 'LECTEUR BILLETS : 500 EUROS DETECTES';
      response='50000';
  break;
  }
  
if(response !== null){
 callback(response);
// console.log(response);
}
//console.log(response);
/*  if (message && message !== lastMessage) {
    console.log(message);
    lastMessage = message;
  }*/
});
}

// Fonction pour convertir une chaîne hexadécimale en tableau de bytes
function hexStringToByteArray(hexString) {
  let result = [];
  for (let i = 0; i < hexString.length; i += 2) {
    result.push(parseInt(hexString.substr(i, 2), 16));
  }
  return result;
}
 
function hexStringToAscii(hexString) {
  let result = '';
  for (let i = 0; i < hexString.length; i += 2) {
    const byte = parseInt(hexString.substr(i, 2), 16);
    result += String.fromCharCode(byte);
  }
  return result;
}

function write_port (hex) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(hex.replace(/\s+/g, ''), 'hex');
    port.write(buf, err => {
      if (err) return reject(err);
      port.drain(resolve);
    });
  });
}



/*function write_port(cmd){
 const message1 = hexStringToByteArray(cmd);
  console.dir(message1);
  port.write(message1, (err) => {
    if (err) {
      return console.log('Erreur lors de l\'envoi :', err.message);
    }
  });
}*/

// Envoi de messages 2  secondes après le démarrage
setTimeout(() => {
  // Envoi de 0C FF FF FF FF (autoriser l'insertion pieces)
//write_port('0C00000000'); 	
disable_cv();
console.log('Initialisation monnayeur');
}, 2000);
 
 
// Envoi de messages 11 secondes après le démarrage
/*setTimeout(() => {
  // Envoi de 34 00 1F 00 00 (autoriser l'insertion cash)
 write_port('3400000000');
//enable_cv(); 
 console.log('Initialisation Lecteur Billets');
}, 3000);*/

module.exports = {
validator,
enable_cv,
disable_cv
}
