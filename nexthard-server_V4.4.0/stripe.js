const stripe = require("stripe")(process.env.STRIPE_API_KEY);
const { publish_response } = require("./mqttClient.js");

async function createPaymentIntent(amount) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount, // centimes
    currency: "eur",
    capture_method: "automatic", // Capture manuel pour permettre une capture partielle
    payment_method_types: ["card_present"],
  });

  return paymentIntent;
}

async function confirmPaymentIntent(paymentIntentId, readerId) {
  // Attacher le Payment Intent au lecteur
  const paymentMethod = await stripe.terminal.readers.processPaymentIntent(
    readerId,
    { payment_intent: paymentIntentId }
  );

  return paymentMethod;
}

module.exports.processPayment = async function (readerId, amount) {
  try {
    // Étape 2: Créer un Payment Intent
    const paymentIntent = await createPaymentIntent(amount);

    // Étape 3: Confirmer le Payment Intent via le terminal
    const confirmedPaymentIntent = await confirmPaymentIntent(
      paymentIntent.id,
      readerId
    );

    console.log(confirmedPaymentIntent);
    //console.log("pid : "+paymentIntent.id)

    var retries = 5;
    var verifier = setInterval(async function () {
      retries--;

      if (retries < 1) {
        const reader = await stripe.terminal.readers.cancelAction(readerId);
        clearInterval(verifier);
        console.log("TIMEOUT ERROR");
        publish_response("stripe_response", "TIMEOUT ERROR", "stripe");
        return;
      }

      const paymentIntent2 = await stripe.paymentIntents.retrieve(
        paymentIntent.id
      );

      //console.log(paymentIntent2);

      if (paymentIntent2.last_payment_error) {
        clearInterval(verifier);
        console.log("ERROR");
        publish_response("stripe_response", "ERROR", "stripe");
      }

      console.log(paymentIntent2.status);

      if (paymentIntent2 && paymentIntent2.status === "succeeded") {
        clearInterval(verifier);
        publish_response("stripe_response", "Payment successful", "stripe");
        return;
      } else {
        // Handle unsuccessful, processing, or canceled payments and API errors here
      }
    }, 2000);
  } catch (error) {
    console.error("Error processing payment:", error);
    publish_response("stripe_response", error.code, "stripe");
  }
};
