require("dotenv").config();
const { Resend } = require("resend");
const webPush = require("web-push");
const { MongoClient, ObjectId } = require("mongodb");
const http = require("http");
const fs = require("fs");

const resend = new Resend(process.env.RESEND_API_KEY);

webPush.setVapidDetails(
  "mailto:cicco.1905@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);
const client = new MongoClient(process.env.MONGODB_URI);

function calcolaGiorniMancanti(data) {
  let oggi = new Date();
  let scadenzaData = new Date(data);
  let differenza = scadenzaData - oggi;
  let giorni = Math.round(differenza / (1000*60*60*24));
  return giorni;
}

const soglie = [30, 15, 7, 3, 1, 0, -1];

function aggiungiMesi(dataStringa, mesi) {
  let parti = dataStringa.split("-").map(Number);
  let anno = parti[0];
  let mese = parti[1] - 1;
  let giorno = parti[2];

  let mesiTotali = mese + mesi;
  let nuovoAnno = anno + Math.floor(mesiTotali / 12);
  let nuovoMese = ((mesiTotali % 12) + 12) % 12;

  let ultimoGiornoNuovoMese = new Date(Date.UTC(nuovoAnno, nuovoMese + 1, 0)).getUTCDate();
  let nuovoGiorno = Math.min(giorno, ultimoGiornoNuovoMese);

  let meseTesto = String(nuovoMese + 1).padStart(2, "0");
  let giornoTesto = String(nuovoGiorno).padStart(2, "0");

  return nuovoAnno + "-" + meseTesto + "-" + giornoTesto;
}

async function controllaScadenze(collezioneScadenze, collezioneAbbonamenti) {
  let listaScadenze = await collezioneScadenze.find().toArray();

  let scadenzeUrgenti = 0;
  for (let i = 0; i < listaScadenze.length; i++) {
    if (calcolaGiorniMancanti(listaScadenze[i].data) <= 7) {
      scadenzeUrgenti = scadenzeUrgenti + 1;
    }
  }

  for (let i = 0; i < listaScadenze.length; i++) {
    let giorni = calcolaGiorniMancanti(listaScadenze[i].data);

    if (soglie.includes(giorni)) {
      let testo = "";

      if (giorni > 0) {
        testo = "Mancano " + giorni + " giorni " + listaScadenze[i].nome;
        if (listaScadenze[i].veicolo) {
          testo = testo + " " + listaScadenze[i].veicolo;
        }
      } else if (giorni === 0) {
        testo = "Scade OGGI " + listaScadenze[i].nome;
        if (listaScadenze[i].veicolo) {
          testo = testo + " " + listaScadenze[i].veicolo;
        }
      } else {
        testo = listaScadenze[i].nome;
        if (listaScadenze[i].veicolo) {
          testo = testo + " " + listaScadenze[i].veicolo;
        }
        testo = testo + " e' scaduta ieri!";
      }

      resend.emails.send({
        from: "onboarding@resend.dev",
        to: "cicco.1905@gmail.com",
        subject: "Promemoria scadenza",
        html: "<p>" + testo + "</p>"
      });

      console.log("Email inviata per: " + listaScadenze[i].nome);

      let abbonamenti = await collezioneAbbonamenti.find().toArray();

      for (let j = 0; j < abbonamenti.length; j++) {
        let contenutoNotifica = JSON.stringify({ titolo: "Promemoria scadenza", testo: testo, badge: scadenzeUrgenti });

        webPush.sendNotification(abbonamenti[j], contenutoNotifica).catch(function(errore) {
          console.log("Errore nell'invio della notifica push: " + errore);
        });
      }
    }
  }
}

async function avviaServer() {
  await client.connect();
  console.log("Connesso a MongoDB!");

  const database = client.db("appScadenze");
  const collezioneScadenze = database.collection("scadenze");
  const collezioneAbbonamenti = database.collection("abbonamenti");

  controllaScadenze(collezioneScadenze, collezioneAbbonamenti);
  setInterval(function() {
    controllaScadenze(collezioneScadenze, collezioneAbbonamenti);
  }, 1000 * 60 * 60 * 24);

  const server = http.createServer(async (richiesta, risposta) => {
    console.log("Qualcuno ha chiesto:" + richiesta.url);

    if (richiesta.url === "/") {
      let listaScadenze = await collezioneScadenze.find().toArray();
      const paginaHtml = fs.readFileSync("index.html", "utf-8");
      const paginaConDati = paginaHtml.replace("DATI_SCADENZE", JSON.stringify(listaScadenze));
      risposta.end(paginaConDati);
    } else if (richiesta.url === "/storico") {
      let listaScadenze = await collezioneScadenze.find().toArray();
      const paginaHtml = fs.readFileSync("storico.html", "utf-8");
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
          });
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
  } else if (richiesta.url === "/modifica-scadenza") {
  let corpo = "";
  richiesta.on("data", function(pezzo) { corpo += pezzo; });
  richiesta.on("end", async () => {
    let datiRicevuti = JSON.parse(corpo);
    await collezioneScadenze.updateOne({ _id: new ObjectId(datiRicevuti.id) }, { $set: { data: datiRicevuti.data } });
    risposta.end("ok");
  });
  } else if (richiesta.url === "/rinnova-scadenza") {
  let corpo = "";
  richiesta.on("data", function(pezzo) { corpo += pezzo; });
  richiesta.on("end", async () => {
    let datiRicevuti = JSON.parse(corpo);
    let scadenza = await collezioneScadenze.findOne({ _id: new ObjectId(datiRicevuti.id) });

    let nuovaDurata = scadenza.durataMesi || 12;
    if (scadenza.nome === "revisione") {
      nuovaDurata = 24;
    }

    let nuovaData = aggiungiMesi(scadenza.data, nuovaDurata);

    let oggiStringa = new Date().toISOString().slice(0, 10);

    await collezioneScadenze.updateOne(
      { _id: new ObjectId(datiRicevuti.id) },
      {
        $set: { data: nuovaData, durataMesi: nuovaDurata },
        $push: { storicoPagamenti: { dataScaduta: scadenza.data, rinnovatoIl: oggiStringa } }
      }
    );
    risposta.end("ok");
  });
  } else if (richiesta.url === "/salva-abbonamento") {
  let corpo = "";
  richiesta.on("data", function(pezzo) { corpo += pezzo; });
  richiesta.on("end", async () => {
    let abbonamento = JSON.parse(corpo);
    await collezioneAbbonamenti.insertOne(abbonamento);
    risposta.end("ok");
  });
  } else if (richiesta.url === "/manifest.json") {
  const manifest = fs.readFileSync("manifest.json", "utf-8");
  risposta.writeHead(200, { "Content-Type": "application/json" });
  risposta.end(manifest);
} else if (richiesta.url === "/service-worker.js") {
  const serviceWorker = fs.readFileSync("service-worker.js", "utf-8");
  risposta.writeHead(200, { "Content-Type": "application/javascript" });
  risposta.end(serviceWorker);
} else if (richiesta.url === "/icone/icon-192.png") {
  const immagine = fs.readFileSync("icone/icon-192.png");
  risposta.writeHead(200, { "Content-Type": "image/png" });
  risposta.end(immagine);
} else if (richiesta.url === "/icone/icon-512.png") {
  const immagine = fs.readFileSync("icone/icon-512.png");
  risposta.writeHead(200, { "Content-Type": "image/png" });
  risposta.end(immagine);
} else if (richiesta.url === "/icone/icon-maskable-192.png") {
  const immagine = fs.readFileSync("icone/icon-maskable-192.png");
  risposta.writeHead(200, { "Content-Type": "image/png" });
  risposta.end(immagine);
} else if (richiesta.url === "/icone/icon-maskable-512.png") {
  const immagine = fs.readFileSync("icone/icon-maskable-512.png");
  risposta.writeHead(200, { "Content-Type": "image/png" });
  risposta.end(immagine);
} else if (richiesta.url === "/icone/apple-touch-icon.png") {
  const immagine = fs.readFileSync("icone/apple-touch-icon.png");
  risposta.writeHead(200, { "Content-Type": "image/png" });
  risposta.end(immagine);
    } else {
      risposta.end("Pagina non trovata");

    }
    });
    

  const porta = process.env.PORT || 3000;
  server.listen(porta);
  console.log(`Server acceso, in ascolto sulla porta ${porta}`);
}

avviaServer();
