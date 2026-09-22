require("dotenv").config();
const { MongoClient } = require("mongodb");
const webPush = require("web-push");

webPush.setVapidDetails(
  "mailto:cicco.1905@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const client = new MongoClient(process.env.MONGODB_URI);

async function mandaProva() {
  await client.connect();
  console.log("Connesso a MongoDB!");

  const database = client.db("appScadenze");
  const collezioneAbbonamenti = database.collection("abbonamenti");

  let abbonamenti = await collezioneAbbonamenti.find().toArray();
  console.log("Abbonamenti trovati: " + abbonamenti.length);

  for (let i = 0; i < abbonamenti.length; i++) {
    console.log("--- Abbonamento " + i + " ---");
    console.log("Endpoint: " + abbonamenti[i].endpoint);
  }

  let contenutoNotifica = JSON.stringify({
    titolo: "Prova notifica 2",
    testo: "Seconda prova, con dettagli sulla risposta"
  });

  for (let i = 0; i < abbonamenti.length; i++) {
    try {
      let risultato = await webPush.sendNotification(abbonamenti[i], contenutoNotifica);
      console.log("Codice di stato risposta: " + risultato.statusCode);
      console.log("Corpo risposta: " + risultato.body);
    } catch (errore) {
      console.log("ERRORE COMPLETO:");
      console.log(errore);
    }
  }

  process.exit(0);
}

mandaProva();
