importScripts("config.js");

// Client-ID public du site twitch.tv (aucun compte ni clé API à créer)
const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const ALARM = "check-live";
const CHECK_EVERY_MINUTES = 1;

const ICONS_LIVE = { 16: "icons/icon16.png", 32: "icons/icon32.png", 48: "icons/icon48.png" };
const ICONS_OFFLINE = { 16: "icons/icon16-off.png", 32: "icons/icon32-off.png", 48: "icons/icon48-off.png" };

const QUERY = `query($login: String!) {
  user(login: $login) {
    displayName
    profileImageURL(width: 300)
    channel { socialMedias { title url } }
    stream {
      id title viewersCount createdAt
      previewImageURL(width: 440, height: 248)
      game { name }
    }
  }
}`;

async function fetchUser() {
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Client-ID": CLIENT_ID, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login: CHANNEL } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Twitch HTTP ${res.status}`);
  const json = await res.json();
  if (!json.data?.user) throw new Error("Chaîne introuvable");
  return json.data.user;
}

async function updateAction(live) {
  await chrome.action.setIcon({ path: live ? ICONS_LIVE : ICONS_OFFLINE });
  await chrome.action.setBadgeBackgroundColor({ color: "#e91916" });
  await chrome.action.setBadgeText({ text: live ? "LIVE" : "" });
}

// Un service worker ne peut pas lire d'audio : on passe par un document offscreen
async function playSound(volume) {
  try {
    if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
    await chrome.offscreen.createDocument({
      url: `offscreen.html?volume=${volume}`,
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Jouer le son d'alerte au lancement du live",
    });
  } catch (err) {
    console.warn("Lecture du son impossible :", err);
  }
}

function notify(id, settings, { title, message, contextMessage = "", withSound = false }) {
  const sound = withSound && settings.sound;
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title,
    message,
    contextMessage,
    priority: 2,
    // Évite le doublon avec le son Windows quand on joue le nôtre
    silent: sound,
  });
  if (sound) playSound(settings.volume);
}

async function checkLive() {
  const stored = await chrome.storage.local.get(["status", "lastNotifiedStreamId"]);
  const previous = stored.status;

  let user;
  try {
    user = await fetchUser();
  } catch (err) {
    // Erreur réseau : on garde le dernier état connu, on réessaiera à la prochaine alarme
    console.warn("Vérification du live impossible :", err);
    return previous ?? null;
  }

  const stream = user.stream;
  const status = {
    live: Boolean(stream),
    streamId: stream?.id ?? null,
    title: stream?.title ?? "",
    game: stream?.game?.name ?? "",
    viewers: stream?.viewersCount ?? 0,
    startedAt: stream?.createdAt ?? null,
    thumbnail: stream?.previewImageURL ?? null,
    displayName: user.displayName,
    avatar: user.profileImageURL,
    socials: user.channel?.socialMedias ?? [],
    checkedAt: Date.now(),
  };

  await chrome.storage.local.set({ status });
  await updateAction(status.live);

  const settings = await getSettings();

  // Une seule notification par live, même si le service worker redémarre entre-temps
  if (status.live && stored.lastNotifiedStreamId !== status.streamId) {
    await chrome.storage.local.set({ lastNotifiedStreamId: status.streamId });
    if (settings.notifyLive) {
      notify(`live-${status.streamId}`, settings, {
        title: `${status.displayName} est en live !`,
        message: status.title || "Le live vient de commencer.",
        contextMessage: status.game,
        withSound: true,
      });
    }
  } else if (
    settings.notifyGame &&
    status.live &&
    previous?.streamId === status.streamId &&
    previous.game &&
    status.game &&
    previous.game !== status.game
  ) {
    notify(`game-${status.streamId}-${Date.now()}`, settings, {
      title: `${status.displayName} change de jeu`,
      message: `Maintenant sur ${status.game}`,
      contextMessage: `Avant : ${previous.game}`,
    });
  }

  return status;
}

async function ensureAlarm() {
  const alarm = await chrome.alarms.get(ALARM);
  if (!alarm) {
    chrome.alarms.create(ALARM, { periodInMinutes: CHECK_EVERY_MINUTES });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  checkLive();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  checkLive();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) checkLive();
});

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.tabs.create({ url: CHANNEL_URL });
  chrome.notifications.clear(notificationId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    // Le popup demande un rafraîchissement immédiat à l'ouverture
    case "refresh":
      checkLive().then(sendResponse);
      return true;
    case "sound-done":
      chrome.offscreen.closeDocument().catch(() => {});
      return;
    // Bouton « Tester » de la page de réglages
    case "test-notification":
      getSettings().then((settings) =>
        notify(`test-${Date.now()}`, settings, {
          title: "Merishall est en live !",
          message: "Ceci est une notification de test.",
          withSound: true,
        })
      );
      return;
  }
});
