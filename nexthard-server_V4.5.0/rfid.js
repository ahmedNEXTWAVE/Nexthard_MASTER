const { publish_response } = require('./mqttClient.js');
const { NFC } = require('nfc-pcsc');

const nfc = new NFC();

parse_rfid();

function parse_rfid() {
    console.log('***********Started parsing**********');

nfc.on('reader', (reader) => {
  console.log(`Lecteur connecté : ${reader.reader.name}`);

  reader.on('card', (card) => {
    // UID en hex (p.ex. "04A224B9C2A080")
    const uidHex = card.uid;
    console.log(`Carte présente | UID (hex) = ${uidHex}`);

    // Conversion en entier long (BigInt) pour éviter toute perte de précision
    const uidBigInt = BigInt('0x' + uidHex);
    console.log(`UID (entier) = ${uidBigInt.toString()}`);
   publish_response("rfid_response", `${uidBigInt.toString()}`, "carddispenser");


  });

  // >>> Détection de disparition/retrait de la carte
  reader.on('card.off', (card) => {
    console.log(`Carte retirée du lecteur ${reader.reader.name}`);
  });

  reader.on('error', (err) => {
    console.error(`Erreur du lecteur ${reader.reader.name} :`, err);
  });

  reader.on('end', () => {
    console.log(`Lecteur déconnecté : ${reader.reader.name}`);
  });
});

nfc.on('error', (err) => {
  console.error('Erreur NFC globale :', err);
});








}

module.exports = {
    parse_rfid
};
