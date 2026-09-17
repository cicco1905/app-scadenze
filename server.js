require("dotenv").config();
const { Resend } = require("resend");
const { MongoClient, ObjectId } = require("mongodb");
const http = require("http");
const fs = require("fs");

const resend = new Resend(process.env.RESEND_API_KEY);
const client = new MongoClient(process.env.MONGODB_URI);

function calcolaGiorniMancanti(data) {
  let oggi = new Date();
  let scadenzaData = new Date(data);
  let differenza = scadenzaData - oggi;
  let giorni = Math.round(differenza / (1000*60*60*24));
  return giorni;
}

const soglie = [30, 15, 7, 3, 1, 0, -1];

async function controllaScadenze(collezioneScadenze) {
  let listaScadenze = await collezioneScadenze.find().toArray();

  for (let i = 0; i < listaScadenze.length; i++) {
    let giorni = calcolaGiorniMancanti(listaScadenze[i].data);

    if (soglie.includes(giorni)) {
      let testo = "";

      if (giorni > 0) {
        testo = "Mancano " + giorni + " giorni " + listaScadenze[i].articolo + " " + listaScadenze[i].nome;
      } else if (giorni === 0) {
        testo = "Scade OGGI " + listaScadenze[i].articolo + " " + listaScadenze[i].nome;
      } else {
        testo = listaScadenze[i].nome + " e' scaduta ieri!";
      }

      resend.emails.send({
        from: "onboarding@resend.dev",
        to: "cicco.1905@gmail.com",
        subject: "Promemoria scadenza",
        html: "<p>" + testo + "</p>"
      });

      console.log("Email inviata per: " + listaScadenze[i].nome);
    }
  }
}

async function avviaServer() {
  await client.connect();
  console.log("Connesso a MongoDB!");

  const database = client.db("appScadenze");
  const collezioneScadenze = database.collection("scadenze");

  controllaScadenze(collezioneScadenze);
  setInterval(function() {
    controllaScadenze(collezioneScadenze);
  }, 1000 * 60 * 60 * 24);

  const server = http.createServer(async (richiesta, risposta) => {
    console.log("Qualcuno ha chiesto:" + richiesta.url);

    if (richiesta.url === "/") {
      let listaScadenze = await collezioneScadenze.find().toArray();
      const paginaHtml = fs.readFileSync("index.html", "utf-8");
      const paginaConDati = paginaHtml.replace("DATI_SCADENZE", JSON.stringify(listaScadenze));
      risposta.end(paginaConDati);
    } else if (richiesta.url === "/aggiungi-scadenza") {
      let corpo = "";

      richiesta.on("data", function(pezzo) {
        corpo += pezzo;
      });

      richiesta.on("end", async () => {
        let nuovaScadenza = JSON.parse(corpo);
        await collezioneScadenze.insertOne(nuovaScadenza);
        risposta.end("ok");
    ;
    } else if (richiesta.url === "/scadenze") {
      const paginaHtml = fs.readFileSync("index.html");
      risposta.end(paginaHtml);
      } else if (richiesta.url === "/elimina-scadenza") {
  let corpo = "";
  richiesta.on("data", function(pezzo) { corpo += pezzo; });
  richiesta.on("end", async () => {
    let datiRicevuti = JSON.parse(corpo);
    await collezioneScadenze.deleteOne({ _id: new ObjectId(datiRicevuti.id) });
    risposta.end("ok");
  });
  
    } else {
      risposta.end("Pagina non trovata");

    }
    });
    

  const porta = process.env.PORT || 3000;
  server.listen(porta);
  console.log(`Server acceso, in ascolto sulla porta ${porta}`);
}

avviaServer();
