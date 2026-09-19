// Versione minima: per ora serve solo a rendere l'app "installabile".
// Le notifiche push vere verranno aggiunte qui più avanti.

self.addEventListener("install", (evento) => {
  console.log("Service worker installato");
});

self.addEventListener("activate", (evento) => {
  console.log("Service worker attivo");
});
