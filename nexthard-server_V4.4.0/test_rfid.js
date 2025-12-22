const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
//const { publish_response } = require('./mqttClient.js');
var parser_rfid;

const port_rfid = new SerialPort({
    autoOpen: true,
    path: '/dev/ttyUSB0',
    baudRate: 9600,
});



port_rfid.on('open', function () {
    console.log('RFID Port opened successfully.');
parser_rfid = new ReadlineParser({ delimiter: '\n' });
 port_rfid.pipe(parser_rfid); 
parse_rfid();
process.on('SIGINT', function () {
        console.log("Stopping RFID reader...");
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
var lastRfidData,rfidData, retries = 0;

function parse_rfid() {
    console.log('***********Started parsing**********');

    // Remove any existing 'data' listeners on parser_rfid
  //port_rfid.removeAllListeners('data');
    
   // if (!port_rfid.isOpen) {
     //   port_rfid.open();
   // }
    rfidData = 0;
    lastRfidData = 1;

    // Add the 'data' event listener to parser_rfid
    parser_rfid.on('data', (data) => {
        console.log("Data = " + data + " -- " + parseInt(data, 16));
        rfidData = parseInt(data, 16).toString();
	console.log("Sending: ",rfidData !== lastRfidData,'current card: ',rfidData,'last card: ',lastRfidData);
        if (rfidData.length >= 6) {
	   if(rfidData !== lastRfidData){
           // publish_response("rfid_response", rfidData, "carddispenser");
	     lastRfidData = rfidData;	
 	    }
           /*
	 if (port_rfid.isOpen) {
                console.log('Closing RFID port');
                port_rfid.close((err) => {
                    if (err) {
                        console.log('Error closing port:', err);
                    } else {
    			console.log('Port closed successfully.');
    			console.log('***********Finished parsing**********');
                    }
                });
            }
	*/
        }
    });
}

module.exports = {
    parse_rfid
};
