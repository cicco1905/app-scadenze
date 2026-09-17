require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");

async function migra() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log("Connesso a MongoDB!");

  const database = client.db("appScadenze");
  const collezioneScadenze = database.collection("scadenze");

  const datiScadenze = fs.readFileSync("scadenze.json");
  const listaScadenze = JSON.parse(datiScadenze);

  await collezioneScadenze.insertMany(listaScadenze);
  console.log("Dati importati nel database! Scadenze inserite: " + listaScadenze.length);

  await client.close();
}

migra();
