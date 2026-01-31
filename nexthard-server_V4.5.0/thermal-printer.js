const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer')
const { publish_response } = require('./mqttClient.js');

 const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON, // 'star' or 'epson'
    interface: '/dev/nextwave-prn', // /dev/usb/lp0
    options: {
      timeout: 1000,
    },
    width: 48, // Number of characters in one line - default: 48
    characterSet: CharacterSet.SLOVENIA, // Character set - default: SLOVENIA
    breakLine: BreakLine.WORD, // Break line after WORD or CHARACTERS. Disabled with NONE - default: WORD
    removeSpecialCharacters: false, // Removes special characters - default: false
    lineCharacter: '-', // Use custom character for drawing lines - default: -
  });

var printing = false;

module.exports.print = async function (data) {
 
  const isConnected = await printer.isPrinterConnected();
  console.log('Printer connected:', isConnected);
 printer.clear();
  printer.alignCenter();
  await printer.printImage('./logo.png');

  //printer.alignLeft();

  printer.setTextNormal();
  printer.newLine();
  printer.println('30 Rue du Petit Montron\n53000 Laval ');
  printer.println('TEL : 02 43 26 13 67');
  printer.drawLine();
  /*printer.println('This is a long line that will be collapsed into two lines');
  printer.drawLine();

  printer.upsideDown(true);
  printer.println('Hello World upside down!');
  printer.upsideDown(false);
  printer.drawLine();

  printer.invert(true);
  printer.println('Hello World inverted!');
  printer.invert(false);
  printer.drawLine();

  printer.println('Special characters: ČčŠšŽžĐđĆćßẞöÖÄäüÜé');
  printer.drawLine();

  printer.setTypeFontB();
  printer.println('Type font B');
  printer.setTypeFontA();
  printer.println('Type font A');
  printer.drawLine();

  printer.alignLeft();
  printer.println('This text is on the left');
  printer.alignCenter();
  printer.println('This text is in the middle');
  printer.alignRight();
  printer.println('This text is on the right');
  printer.alignLeft();
  printer.drawLine();

  printer.setTextDoubleHeight();
  printer.println('This is double height');
  printer.setTextDoubleWidth();
  printer.println('This is double width');
  printer.setTextQuadArea();
  printer.println('This is quad');
  */
  printer.setTextSize(1, 1);
  printer.setTextNormal();
  printer.alignLeft();
  printer.println("Date:"+data.date);
  printer.println("Card id:"+data.rfid);
  printer.println("Total:"+data.amount);

 
  printer.setTextNormal();
  //printer.println('This is normal');

  //printer.println('Draw a line with a custom character');
  printer.drawLine('=');
  printer.alignCenter();
  printer.newLine();
  printer.println('Monky Laval vous remercie !');

  /*try {
    printer.printBarcode('4126570807191');
    printer.code128('4126570807191', {
      height: 50,
      text: 1,
    });
    printer.beep();
  } catch (error) {
    console.error(error);
  }*/
    
  /*printer.pdf417('4126565129008670807191');
  printer.printQR('https://olaii.com');

  printer.newLine();

  printer.leftRight('Left', 'Right');

  printer.table(['One', 'Two', 'Three', 'Four']);

  printer.tableCustom([
    { text: 'Left', align: 'LEFT', width: 0.5 },
    {
      text: 'Center', align: 'CENTER', width: 0.25, bold: true,
    },
    { text: 'Right', align: 'RIGHT', width: 0.25 },
  ]);

  printer.tableCustom([
    { text: 'Left', align: 'LEFT', cols: 8 },
    {
      text: 'Center', align: 'CENTER', cols: 10, bold: true,
    },
    { text: 'Right', align: 'RIGHT', cols: 10 },
  ]);
*/
  printer.cut();
  printer.openCashDrawer();

  console.log(printer.getText());

	if(!printing){ 
 	 try {
		printing = true;
		console.log("currently printing");
   	 	await printer.execute().then(()=>{
	 		console.log('Print success.');
    			publish_response("printer_response", "Print success", "printer");
    			printing = false;
		});
 	 } catch (error) {
    		console.error('Print error:', error);
    		publish_response("printer_response", "PRINT ERROR", "printer");
  	}
	}
}

//example();
