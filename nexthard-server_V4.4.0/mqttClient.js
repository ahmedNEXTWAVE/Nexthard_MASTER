const mqtt = require("mqtt");
require("dotenv").config();

const protocol = process.env.protocol;
const host = process.env.host; //'mqtt1.playzwell.com';
const port = process.env.port; //'8883';
const connectUrl = `${protocol}://${host}:${port}`;

const mqttClient = mqtt.connect(connectUrl, {
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
  username: "playzwell",
  password: "Citrec++",
});

function publish_response(event, message, device, pilot = false) {
  var mqttData = {};
  // Modification lecteur nfc 04/10/2025 //
  if (!pilot) mqttData = { device: device, event: event, value: message };

  if (pilot) mqttData = { device: device, event: event, code_rfid: message };

  mqttClient.publish(
    pilot ? process.env.topic_pilot + "/event" : process.env.topic + "/event",
    JSON.stringify(mqttData),
    (error) => {
      //******//
      console.log(mqttData);
      if (error) {
        console.error("Publish error:", error);
      }
    }
  );
}

module.exports = {
  mqttClient,
  publish_response,
};
