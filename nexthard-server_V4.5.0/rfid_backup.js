const { SerialPort } = require('serialport');
const { ByteLengthParser } = require('@serialport/parser-byte-length');
const { publish_response } = require('./mqttClient.js');

const parser_rfid = new ByteLengthParser({ length: 1 });

const port_rfid = new SerialPort({
    autoOpen: false,
   path: '/dev/nextwave-rfid',
 baudRate: 9600,
});


port_rfid.on('open', function () {
    console.log('rfid Port opened successfully.');
  
 process.on('SIGINT', function () {
        console.log("Stopping rfid reader...");

        port_rfid.close((err) => {
            if (err) {
                console.error('Error closing port:', err.message);
                process.exit(0);

            } else {
                console.log('Port closed successfully.');
                process.exit(0);

            }
        });
    });
});

// RFID READER SECTION
var rfidData, rawData, retries = 0;

function parse_rfid() {
console.log('***********started parsing**********');
    parser_rfid.removeAllListeners('data');
if(!port_rfid.isOpen){   
 port_rfid.open();
}
    port_rfid.pipe(parser_rfid);
    rawData = "";
    rfidData = "";
    var started = false;
    parser_rfid.on('data', (data) => {
        // Process the RFID data
        console.log("data = " + data[0] + " --" + data.toString('binary'));
        if (data[0] === 2) {
            started = true;
            rawData = "X";
        }
        if (started) {
            rawData += data.toString('binary');
        }
        if (data[0] === 3) {
            started = false;
            rawData += "X";
        }
        rfidData = rawData.substring(4, 12);
        console.log(parseInt(rfidData, 16));
        if (rfidData.length == 8) {
            publish_response("rfid_response", parseInt(rfidData, 16), "carddispenser");
            port_rfid.unpipe();
            port_rfid.close();
        }

    })
console.log(rfidData);
}


module.exports = {
    parse_rfid
}
// END SECTION
