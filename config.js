const CHANNEL = "merishall";
const CHANNEL_URL = `https://www.twitch.tv/${CHANNEL}`;

// Liens affichés dans le popup, en plus de ceux renseignés sur le profil Twitch
const LINKS = [
  { title: "Limeris", url: "https://limeris.fr" },
];

const DEFAULT_SETTINGS = {
  notifyLive: true,
  notifyGame: true,
  sound: true,
  volume: 0.6,
};

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...settings };
}
