// Versione minima per l'installabilità della PWA, più la gestione delle notifiche push vere.

self.addEventListener("install", (evento) => {
  console.log("Service worker installato");
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  console.log("Service worker attivo");
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("push", (evento) => {
  let dati = evento.data.json();

  evento.waitUntil(
    self.registration.showNotification(dati.titolo, {
      body: dati.testo,
      icon: "/icone/icon-192.png"
    })
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(
    clients.openWindow("/")
  );
});
