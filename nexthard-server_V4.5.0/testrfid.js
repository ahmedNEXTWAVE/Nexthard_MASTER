const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const port_rfid = new SerialPort({
    autoOpen: false,
    path: '/dev/nextwave-rfid',
    baudRate: 9600,
});
const parser_rfid = new ReadlineParser({ delimiter: '\n' });

port_rfid.pipe(parser_rfid);

port_rfid.on('open', function () {
    console.log('RFID Port opened successfully.');
    port_rfid.flush();
});

parser_rfid.on('data', (data) => {
    console.log("Data = " + data + " -- " + parseInt(data, 16));
});

port_rfid.open((err) => {
    if (err) {
        console.log('Error opening port:', err);
    }
});
