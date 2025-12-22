//*** yaml config *///
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
require("dotenv").config();

// Load config synchronously
function loadConfig() {
  try {
    const configPath = path.join(__dirname, "../config.yaml");
    const fileContents = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(fileContents);
    return config;
  } catch (e) {
    console.error("Error reading YAML file:", e);
    throw e;
  }
}

// Load config at startup
//const configs = loadConfig();
//console.log("Config loaded:", configs);

cardDispenser = cashValidators = null;

const util = require("util");
const _log = console.log;

console.log = (...args) =>
  _log(`${new Date().toISOString()} ${util.format(...args)}`);

if (process.env.printer == true) {
  console.log("activating thermal-printer");
  const printer = require("./thermal-printer.js");
}
if (process.env.payout == false) {
  console.log("activating cashvalidator no payout");
  cashValidators = require("./mdb.js");
} else {
  console.log("activating cashvalidator with payout");
}
if (process.env.stripe == true) {
  console.log("activating stripe");
  const stripe = require("./stripe.js");
}
if (process.env.card_d == true) {
  console.log("activating card-dispenser");
  cardDispenser = require("./carddispenser.js");
}

const { mqttClient } = require("./mqttClient.js");
//const { parse_rfid, close_rfid } = require("./rfid.js");
require("dotenv").config();

const host = process.env.host;
const topic = process.env.topic + "/action";
const topic2 = "EMPTY/event";

console.log("trying to connect to mqttbroker...");

var initCV = false;
mqttClient.on("connect", () => {
  console.log(" ## Connected to MQTT Broker. ##");
  mqttClient.subscribe(topic);
  mqttClient.subscribe(topic2 + "/event");
  if (process.env.payout == false) {
    if (initCV == false) {
      cashValidators.validator(publish_cash);
      initCV = true;
    }
  }

  publish_image_led("show_image", "/playzwell.bmp");
  publish_image_led("ledAnimate", "");
});

mqttClient.on("reconnect", () => {
  console.warn("Reconnecting to MQTT Broker...");
});

mqttClient.on("close", () => {
  console.warn("MQTT Connection closed.");
});

mqttClient.on("offline", () => {
  console.warn("MQTT Client is offline.");
});

mqttClient.on("error", (error) => {
  console.error("MQTT Error:", error);
});

// actions
mqttClient.on("message", (receivedtopic, payload) => {
  try {
    const json = JSON.parse(payload);
    console.log("Received Message:", receivedtopic, json);
    if (receivedtopic == topic2) {
      if (json.boot) {
        publish_image_led("show_image", "playzwell.bmp");
      }
    } else if (receivedtopic == topic) {
      switch (json.action) {
        case "print":
          if (process.env.printer == true) {
            console.log("print action");
            printer
              .print(json.value)
              .then(() => {})
              .catch((error) => {
                console.error("Print error:", error);
              });
          }
          break;

        case "stripe_pay":
          if (process.env.stripe == true) {
            // DISABLE STRIPE PAY - Q25
            stripe.processPayment("tmr_F8Lq0gRajiRxop", json.value);
          }
          break;

        case "presentcard_start":
          if (process.env.card_d == true) {
            console.log("sending image");
            publish_image_led("show_image", "/scan.bmp");
            console.log("sending led");
            publish_image_led("ledrvb", [255, 255, 255, 1000, 500, 16000]);
          }
          break;

        case "presentcard_end":
          if (process.env.card_d == true) {
            console.log("sending image");
            publish_image_led("show_image", "/playzwell.bmp");
            console.log("sending led");
            publish_image_led("ledrvb", [0, 0, 0, 1000, 500, 16000]);
          }
          break;

        case "read_card":
          if (process.env.card_d == true) {
            console.log("Read card order --> scanning nfc");
            console.log("Read card order --> send order read");
            cardDispenser.order("0231354643360336");
          }
          break;
        case "prohibit_insert":
          if (process.env.card_d == true) {
            cardDispenser.order("023135494E300332");
          }
          break;
        case "authorize_insert":
          if (process.env.card_d == true) {
            cardDispenser.order("023135494E320330");
          }
          break;
        case "reset_dispenser":
          if (process.env.card_d == true) {
            cardDispenser.order("02313552530304");
          }
          break;

        case "eject_card":
          if (process.env.card_d == true) {
            cardDispenser.order("0231354643300330");
          }
          break;

        case "return_front":
          if (process.env.card_d == true) {
            setTimeout(() => {
              cardDispenser.order("0231354643340334");
            }, 1000);
          }
          break;

        case "confiscate_card":
          if (process.env.card_d == true) {
            console.log("Conficate card order --> send order read");
            cardDispenser.order("02313543500316");
          }
          break;

        case "dispenser_status":
          if (process.env.card_d == true) {
            cardDispenser.getstat();
          }
          break;

        case "enable_cv":
          if (process.env.payout == false) {
            cashValidators.enable_cv(); // Assuming enable method exists
          }
          break;

        case "disable_cv":
          if (process.env.payout == false) {
            cashValidators.disable_cv(); // Assuming disable method exists
          }
          break;

        default:
          console.warn("Unknown action:", json.action);
          break;
      }
    }
  } catch (error) {
    console.error("Message handling error:", error);
  }
});

function publish_image_led(cmd, data) {
  const mqttData = {
    [cmd]: data,
    name: data,
  };
  mqttClient.publish(topic2, JSON.stringify(mqttData), (error) => {
    if (error) {
      console.error("Publish cash error:", error);
    }
  });
}

function publish_cash(event) {
  console.log(event);
  const mqttData = {
    device: "cashvalidator",
    event: "credit",
    value: event,
  };
  mqttClient.publish(
    process.env.topic + "/event",
    JSON.stringify(mqttData),
    (error) => {
      if (error) {
        console.error("Publish cash error:", error);
      }
    }
  );
}
