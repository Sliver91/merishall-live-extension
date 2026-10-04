const volume = Number(new URLSearchParams(location.search).get("volume"));
const audio = new Audio("sounds/live.wav");
audio.volume = Math.min(1, Math.max(0, volume || 0));

// Le service worker ferme ce document une fois le son terminé
const done = () => chrome.runtime.sendMessage({ type: "sound-done" });
audio.addEventListener("ended", done);
audio.play().catch(done);
