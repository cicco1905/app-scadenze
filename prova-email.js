require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

resend.emails.send({
  from: "onboarding@resend.dev",
  to: "cicco.1905@gmail.com",
  subject: "Promemoria scadenza - prova",
  html: "<p>Questa e' una email di prova mandata dal nostro codice Node.js!</p>"
});

console.log("Email inviata (controlla la tua casella)");
