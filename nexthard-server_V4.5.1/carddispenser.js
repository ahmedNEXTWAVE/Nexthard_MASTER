const { SerialPort } = require("serialport");
const { ByteLengthParser } = require("@serialport/parser-byte-length");
const { ReadlineParser } = require("@serialport/parser-readline");
const { publish_response } = require("./mqttClient.js");

// Remplacez 'COM1' par le port_cd série approprié pour votre système
const port_cd = new SerialPort({
  path: process.env.cd_path,
  baudRate: 9600,
});

const cd_parse = new ReadlineParser({ delimiter: "\x03" });
var parser_cd;
var status = { error: false, message: "" };

port_cd.on("open", async function () {
  console.log("card dispenser Port opened successfully.");

  process.on("SIGINT", function () {
    console.log("Stopping card dispenser...");

    port_cd.close((err) => {
      if (err) {
        console.error("Error closing port:", err.message);
        process.exit(0);
      } else {
        console.log("Port closed successfully.");
        process.exit(0);
      }
    });
  });

  parser_cd = port_cd.pipe(cd_parse);

  console.log("Check status command");
  await getstat();
  console.log("Status received");

  cd_action_reset();

  setTimeout(() => {
    cd_action_block_front();
  }, 1000);

  // Poll getstat every 2.5 second
  setInterval(async () => {
    try {
      await getstat();
    } catch (err) {
      console.error("Error polling status:", err);
    }
  }, 2500);
});

/*                             cd Actions                            */
function cd_action_reset() {
  order("02313552530304");
}

function cd_action_block_front() {
  order("023135494E300332");
}

// Fonction pour convertir une chaîne hexadécimale en tableau de bytes
function hexStringToByteArray(hexString) {
  let result = [];
  for (let i = 0; i < hexString.length; i += 2) {
    result.push(parseInt(hexString.substr(i, 2), 16));
  }
  return result;
}

async function order(order) {
  // Get status response parser
  parser_cd.on("data", (data) => {
    //const hexData = Buffer.from(data, "hex").toString("hex").toUpperCase();
    const stat_code = data.slice(-4);
    console.log("Message reçu:", data);

    // Collect all applicable messages
    const messages = [];
    let errors = 0;
    let stat_int = parseInt(stat_code);

    // Test by subtracting from highest to lowest
    // If value is still positive/zero after subtraction, that flag is present

    if (stat_int >= 1000) {
      console.log(
        "Vidé cartes confisqué!",
        stat_int,
        "-1000 = ",
        stat_int - 1000,
      );
      messages.push("Vidé cartes confisqué!");
      errors++;
      stat_int -= 1000;
    }

    if (stat_int >= 200) {
      console.log(
        "Erreur distribution de carte!",
        stat_int,
        "-200 = ",
        stat_int - 200,
      );
      messages.push("Erreur distribution de carte!");
      errors++;
      stat_int -= 200;
    }

    if (stat_int >= 100) {
      console.log(
        "Erreur collection de carte!",
        stat_int,
        "-100 = ",
        stat_int - 100,
      );
      messages.push("Erreur collection de carte!");
      errors++;
      stat_int -= 100;
    }

    if (stat_int >= 10) {
      console.log("back almost empty!", stat_int, "-10 = ", stat_int - 10);
      messages.push("Stock minimum carte atteint!");
      stat_int -= 10;
    }

    if (stat_int >= 8) {
      console.log("back empty!", stat_int, "-8 = ", stat_int - 8);
      messages.push("Back vide!");
      errors++;
      stat_int -= 8;
    }

    if (stat_int >= 6) {
      console.log("Carte position lecture!", stat_int, "-6 = ", stat_int - 6);
      messages.push("Carte position lecture!");
      stat_int -= 6;
    }

    if (stat_int >= 3) {
      console.log("get the carte!", stat_int, "-3 = ", stat_int - 3);
      messages.push("SVP tiré la carte");
      stat_int -= 3;
    }

    if (stat_code === "0000" || (errors === 0 && messages.length === 0)) {
      console.log("all ok!");
      messages.push("ok!");
    }

    // Set status based on collected messages
    status.error = errors.length > 0;
    status.messages = messages;
    console.table(status.messages);
    //status.message = status.messages.join(", ");
    status.error = errors != 0;

    publish_response(
      "cd_status",
      { message: status.messages, error: status.error },
      "carddispenser",
    );
  });

  /// envoi commandes : RESET '02313552530304'  :  position lecture : 0231354643360336
  // Eject to front : 0231354643300330 Return to front : 0231354643340334 Confisque carte : 02313543500316 CHECK STATUTS : 02313541500314
  // Prohibit card insertion: 023135494E300332 Authorize insertion: 023135494E320330
  if (
    [
      "02313552530304",
      "0231354643360336",
      "0231354643300330",
      "0231354643340334",
      "02313543500316",
      "02313541500314",
      "023135494E300332",
      "023135494E320330",
    ].includes(order)
  ) {
    setTimeout(() => {
      // Envoi de 0C FF FF FF FF
      const message1 = hexStringToByteArray(order);
      console.dir(message1);
      port_cd.write(message1, (err) => {
        if (err) {
          return console.log("Erreur lors de l'envoi :", err.message);
        }
      });

      console.log("Envoi de la commande");
    }, 500);
    // Fonction ENQ code 05

    setTimeout(() => {
      const message1 = hexStringToByteArray("053135");
      console.dir(message1);
      port_cd.write(message1, (err) => {
        if (err) {
          return console.log("Erreur lors de l'envoi :", err.message);
        }
      });
      console.log("Confirmation");
    }, 1000);
    if (!status.error) {
      publish_response("cd_response", `task succesful`, "carddispenser");
    } else {
      publish_response(
        "cd_response",
        `Alert::${status.message}`,
        "carddispenser",
      );
    }
  } else {
    console.log("Incorrect order");
  }
}

async function getstat() {
  await new Promise((resolve, reject) => {
    setTimeout(() => {
      // Envoi de 0C FF FF FF FF
      const message1 = hexStringToByteArray("02313541500314");
      //console.dir(message1);
      port_cd.write(message1, (err) => {
        if (err) {
          console.log("Erreur lors de l'envoi :", err.message);
          reject(err);
          return;
        }
      });

      // console.log('Envoi de la commande');
    }, 500);

    // Fonction ENQ code 05

    setTimeout(() => {
      const message1 = hexStringToByteArray("053135");
      //console.dir(message1);
      port_cd.write(message1, (err) => {
        if (err) {
          console.log("Erreur lors de l'envoi :", err.message);
          reject(err);
          return;
        }
        resolve();
      });
      //console.log('Confirmation');
    }, 1000);
  });
}

//parse_rfid();

process.on("uncaughtException", function (err) {
  console.log(err);
  publish_response("cd_response", "ERROR PROCESSING TASK", "carddispenser");
});

module.exports = {
  order,
  getstat,
};
