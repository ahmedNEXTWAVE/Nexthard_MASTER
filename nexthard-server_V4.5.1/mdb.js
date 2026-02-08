const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { publish_response } = require("./mqttClient.js");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
require("dotenv").config();

// === PORT SETUP ===
let port = null;
let parser = null;
let dataCallback = null;
let lastMessage = null;
const POLL_INTERVAL_MS = 1000;
let pollTimer = null;

function createPort() {
  const portPath = process.env.mdb_path || "/dev/nextwave-cashv";

  port = new SerialPort({
    path: portPath,
    baudRate: 9600,
  });

  parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  // Auto-reconnect on error or close
  port.on("error", (err) => {
    console.error("Serial error:", err.message);
  });

  port.on("close", () => {
    console.log("Port closed, reconnecting in 2s...");
    setTimeout(() => {
      createPort();
      if (dataCallback) validator(dataCallback);
    }, 2000);
  });

  port.on("open", () => {
    console.log("✓ Port connected");
    setTimeout(() => disable_cv(), 2000);
  });
}

// === WRITE FUNCTION ===
function write_port(hex) {
  return new Promise((resolve, reject) => {
    if (!port || !port.isOpen) {
      reject(new Error("Port not open"));
      return;
    }
    const buf = Buffer.from(hex.replace(/\s+/g, ""), "hex");
    port.write(buf, (err) => {
      if (err) return reject(err);
      port.drain(resolve);
    });
  });
}

// === POLL ===
function poll() {
  // Uncomment your poll logic
}

// === ENABLE/DISABLE ===
const enable_cv = async function () {
  try {
    await write_port("0CFFFFFFFF");
    await delay(1500);
    await write_port("34FFFF0000");
    if (!pollTimer) pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    publish_response("cv_response", "Enabled successfully", "cashvalidator");
  } catch (error) {
    console.log("Error enabling:", error.message);
  }
};

const disable_cv = async function () {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  try {
    await write_port("0C00000000");
    await delay(1500);
    await write_port("3400000000");
    publish_response("cv_response", "Disabled successfully", "cashvalidator");
  } catch (error) {
    console.log("Error disabling:", error.message);
  }
};

// === VALIDATOR ===
const validator = function (callback) {
  dataCallback = callback;

  parser.on("data", (data) => {
    const hexData = Buffer.from(data, "hex").toString("hex").toUpperCase();
    if (data.trim() != "30 09") {
      console.log("Message reçu:", data);
    }
    let message = null,
      response = null;
    switch (data.trim()) {
      case "30 09":
        message = "LECTEUR BILLETS : DEMARRAGE EN COURS";
        break;
      case "30 03":
        message = "LECTEUR BILLETS : LECTURE DU BILLET EN COURS";
        if (sendAccept) {
          write_port("3501");
          console.log("message envoyé : 35 01 (accept)");
          sendAccept = false;
        }

        break;
      case "08 45 00":
        message = "MONNAYEUR : 2 EUROS DETECTES";
        response = "200";
        break;
      case "08 54 00":
      case "08 44 00":
        message = "MONNAYEUR : 1 EUROS DETECTES";
        response = "100";
        break;
      case "08 53 00":
      case "08 43 00":
        message = "MONNAYEUR : 50 centimes DETECTES";
        response = "50";
        break;
      case "08 52 00":
      case "08 42 00":
        message = "MONNAYEUR : 20 centimes DETECTES";
        response = "20";
        break;
      case "08 51 00":
      case "08 41 00":
        message = "MONNAYEUR : 10 centimes DETECTES";
        response = "10";
        break;
      case "08 50 00":
      case "08 40 00":
        message = "MONNAYEUR : 5 centimes DETECTES";
        response = "5";
        break;
      case "30 80":
      case "30 0A 80":
        message = "LECTEUR BILLETS : 5 EUROS DETECTES";
        response = "500";
        break;
      case "30 81":
      case "30 0A 81":
        message = "LECTEUR BILLETS : 10 EUROS DETECTES";
        response = "1000";
        break;
      case "30 82":
      case "30 0A 82":
        message = "LECTEUR BILLETS : 20 EUROS DETECTES";
        response = "2000";
        break;
      case "30 83":
      case "30 0A 83":
        message = "LECTEUR BILLETS : 50 EUROS DETECTES";
        response = "5000";
        break;
      case "30 84":
      case "30 0A 84":
        message = "LECTEUR BILLETS : 100 EUROS DETECTES";
        response = "10000";
        break;
      case "30 85":
      case "30 0A 85":
        message = "LECTEUR BILLETS : 200 EUROS DETECTES";
        response = "20000";
        break;
      case "30 86":
      case "30 0A 8":
        message = "LECTEUR BILLETS : 500 EUROS DETECTES";
        response = "50000";
        break;
      case "00":
        console.log("ACK");
        break;
      default:
        sendAccept = true;
        console.log("message MDB non reconnue");
        break;
    }

    if (response !== null) {
      callback(response);
      sendAccept = true;
      // console.log(response);
    }
    //console.log(response);
    /*  if (message && message !== lastMessage) {
    console.log(message);
    lastMessage = message;
  }*/
  });
};

// === START ===
createPort();

module.exports = {
  validator,
  enable_cv,
  disable_cv,
};
