const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { publish_response } = require('./mqttClient.js');

const enable_cv = function () {
    try {

        publish_response("cv_response", "Enabled succesfully", "cashvalidator");
    } catch (error) {
        console.log("Error with cash-validator:", error);
        return;
    }
}

const disable_cv = function () {
    try {

        publish_response("cv_response", "Disabled succesfully", "cashvalidator");
    } catch (error) {
        console.log("Error with cash-validator:", error);
        return;
    }
}
const validator = function (callback) {

    // Remplacez 'COM1' par le port série approprié pour votre système
    try {
        const port = new SerialPort({
            path: '/dev/ttyUSB0', //udev
            baudRate: 9600,
        });

        const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

        parser.on('data', (data) => {
            var response;
            switch (data.trim()) {
                case "08 75 00": response = "200"; break;
                case "08 70 00": response = "5"; break;
                default: response = "ERROR"; break;
            }
            callback(response);
        });
    } catch (error) {
        console.log("Error with cash-validator:", error);
        return;
    }
}

process.on('uncaughtException', function (err) {
    	console.log(err);
	publish_response("cv_response", "ERROR", "stripe");
});

module.exports =
{
    validator,
    enable_cv,
    disable_cv
}
