/**
 * Service worker de Questline.
 *
 * Il ne fait qu'une chose : recevoir les rappels et les ouvrir au bon endroit.
 * Aucune mise en cache, aucune interception de requête — la base est la source
 * de vérité, et un cache mal réglé afficherait une journée d'hier. Un service
 * worker minuscule est un service worker qui ne casse rien.
 *
 * Le fichier est servi tel quel depuis `public/` : il doit vivre à la racine
 * pour couvrir toute l'application, ce qu'une route Next ne garantirait pas.
 */

self.addEventListener("install", () => {
  // Prendre la main tout de suite : sans cela, un abonnement fraîchement posé
  // attendrait la fermeture de tous les onglets pour devenir actif.
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(self.clients.claim());
});

self.addEventListener("push", (evenement) => {
  let donnees = {};
  try {
    donnees = evenement.data ? evenement.data.json() : {};
  } catch {
    // Une charge illisible ne doit pas faire disparaître le rappel : on montre
    // ce qu'on peut plutôt que rien.
    donnees = { titre: "Questline", corps: evenement.data ? evenement.data.text() : "" };
  }

  const titre = donnees.titre || "Questline";
  const options = {
    body: donnees.corps || "",
    icon: "/icones/icone-192.png",
    badge: "/icones/icone-192.png",
    // Une étiquette par créneau : un second envoi remplace le premier au lieu
    // d'empiler deux fois la même chose.
    tag: donnees.etiquette || "questline",
    renotify: false,
    silent: false,
    data: { url: donnees.url || "/jour" },
  };

  evenement.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const cible = (evenement.notification.data && evenement.notification.data.url) || "/jour";

  evenement.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Une fenêtre déjà ouverte est réutilisée et amenée sur l'écran visé —
      // ouvrir un second exemplaire de l'app serait déroutant.
      for (const fenetre of fenetres) {
        if ("navigate" in fenetre) {
          await fenetre.navigate(cible);
          return fenetre.focus();
        }
      }

      return self.clients.openWindow(cible);
    })(),
  );
});

/**
 * Un abonnement peut être renouvelé par le navigateur sans qu'on le demande.
 * On prévient alors le serveur, sinon les rappels suivants partiraient vers un
 * point de terminaison mort.
 */
self.addEventListener("pushsubscriptionchange", (evenement) => {
  evenement.waitUntil(
    (async () => {
      const ancienne = evenement.oldSubscription;
      const nouvelle =
        evenement.newSubscription ||
        (await self.registration.pushManager.subscribe(
          evenement.oldSubscription
            ? evenement.oldSubscription.options
            : { userVisibleOnly: true },
        ));

      await fetch("/api/push/abonner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          abonnement: nouvelle.toJSON(),
          remplace: ancienne ? ancienne.endpoint : null,
          agent: "renouvellement automatique",
        }),
      });
    })(),
  );
});
