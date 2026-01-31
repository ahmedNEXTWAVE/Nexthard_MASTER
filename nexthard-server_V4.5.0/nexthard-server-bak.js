const printer = require('./thermal-printer.js');
const cashValidators = require('./mdb.js');
const stripe = require('./stripe.js');
const cardDispencer = require('./carddispenser.js');
const { mqttClient } = require('./mqttClient.js');

const host = 'localhost';
const topic = 'nexthard/action';
const topic2 = 'topic_nexthard';

console.log('trying to connect to mqttbroker...');
mqttClient.on('connect', () => {
  console.log('Connected To MQTT BROKER on', host);
  mqttClient.subscribe(topic);
  mqttClient.subscribe(topic2);
   // image displayer 
    
  mqttClient.on('message',(topic2,payload)=> {
  const json1 = JSON.parse(payload);
  try{
   if(json1.boot){
     publish_image_led("affiche_img_nom","logo.jpg");
   }
  }catch(err){console.log(err);}
  })
    // actions
  mqttClient.on('message',  (topic, payload) => {
    try {
      const json = JSON.parse(payload);
      console.log('Received Message:', topic, json);

      switch (json.action) {

        case 'print':
	    console.log('print action');         
	    printer.print(json.value).then(()=>{
          }).catch(error => {
            console.error('Print error:', error);
          });
          break;

        case 'stripe_pay':
		  
          stripe.processPayment("tmr_FrVUDAvN2K72HL", json.value);
          break;
          
        case 'presentcard_start':
            console.log("sending image");
            publish_image_led("affiche_img_nom","scan.jpg");
            console.log("sending led");
            publish_image_led("ledrvb",[255,255,255,1000,500,16000]);
            break;
            
        case 'presentcard_end':
            console.log("sending image");
            publish_image_led("affiche_img_nom","logo.jpg");
            console.log("sending led");
            publish_image_led("ledrvb",[0,0,0,1000,500,16000]);
            break;
            
        case 'read_card':
              cardDispencer.order("0231354643360336");
          break;
	    case 'prohibit_insert':
	      cardDispencer.order("023135494E300332");
	      break;
	    case 'authorize_insert':
		  cardDispencer.order("023135494E320330");
	      break;
        case 'reset_dispenser':
          cardDispencer.order("02313552530304");
          break;
        
        case 'eject_card':
            cardDispencer.order("0231354643300330");
            break;
        
        case 'return_front':
	       setTimeout(()=>{cardDispencer.order("0231354643340334")},1000);
           break;

        case 'confiscate_card':
            cardDispencer.order("02313543500316");
            break;
        
        case 'dispenser_status':
          cardDispencer.getstat();
          break;

        case 'enable_cv':
          cashValidators.enable_cv(); // Assuming enable method exists
          break;

        case 'disable_cv':
          cashValidators.disable_cv(); // Assuming disable method exists
          break;

        default:
          console.warn('Unknown action:', json.action);
          break;
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  });


    //events

   cashValidators.validator(publish_cash);
});

function publish_image_led(cmd,data){
const mqttData = {
  [cmd] : data
}
mqttClient.publish(topic2, JSON.stringify(mqttData), (error) => {
      if (error) {
        console.error('Publish cash error:', error);
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
    mqttClient.publish('nexthard/event', JSON.stringify(mqttData), (error) => {
      if (error) {
        console.error('Publish cash error:', error);
      }
    });
  }
