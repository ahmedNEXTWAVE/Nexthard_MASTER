const mqtt = require('mqtt');
require('dotenv').config();

const protocol = process.env.protocol;
const host = process.env.host  
const port = process.env.port 
const topic = process.env.topic + '/action';
const connectUrl = `${protocol}://${host}:${port}`;

const mqttClient = mqtt.connect(connectUrl, {
  clean: true,
  username:process.env.mqtt_user,
  password:process.env.mqtt_pass,
  connectTimeout: 4000,
  reconnectPeriod: 3000,
  reconnectOnConnackError: true
});


module.exports={
    mqttClient,
};

