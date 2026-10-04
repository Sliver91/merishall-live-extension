const $ = (id) => document.getElementById(id);
const TOGGLES = ["notifyLive", "notifyGame", "sound"];

let savedTimer;

function renderVolume() {
  $("volumeValue").textContent = `${$("volume").value} %`;
  $("volume").disabled = !$("sound").checked;
  $("volume").closest(".volume").classList.toggle("disabled", !$("sound").checked);
}

async function save() {
  const settings = { volume: Number($("volume").value) / 100 };
  for (const id of TOGGLES) settings[id] = $(id).checked;
  await chrome.storage.local.set({ settings });

  $("saved").textContent = "Réglages enregistrés.";
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => ($("saved").textContent = ""), 2000);
}

async function init() {
  const settings = await getSettings();
  for (const id of TOGGLES) $(id).checked = settings[id];
  $("volume").value = Math.round(settings.volume * 100);
  renderVolume();
}

for (const id of TOGGLES) {
  $(id).addEventListener("change", () => {
    renderVolume();
    save();
  });
}

$("volume").addEventListener("input", renderVolume);
$("volume").addEventListener("change", save);

$("test").addEventListener("click", () => chrome.runtime.sendMessage({ type: "test-notification" }));

init();
