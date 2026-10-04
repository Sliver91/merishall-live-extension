const $ = (id) => document.getElementById(id);

function formatUptime(startedAt) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

function renderLinks(socials = []) {
  const known = new Set();
  const links = [...LINKS, ...socials].filter(({ url }) => {
    if (!/^https?:\/\//.test(url) || known.has(url)) return false;
    known.add(url);
    return true;
  });

  $("links").replaceChildren(
    ...links.map(({ title, url }) => {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = title;
      return a;
    })
  );
}

function render(status) {
  if (!status) {
    $("state").textContent = "Statut indisponible";
    return;
  }

  document.body.classList.toggle("live", status.live);
  $("name").textContent = status.displayName;
  if (status.avatar) $("avatar").src = status.avatar;
  $("state").textContent = status.live ? "EN LIVE" : "Hors ligne";
  $("watch").textContent = status.live ? "Regarder le live" : "Ouvrir la chaîne";
  renderLinks(status.socials);

  $("details").hidden = !status.live;
  if (status.live) {
    $("thumbnail-link").hidden = !status.thumbnail;
    // Twitch garde la même URL pour la miniature : le paramètre force son rafraîchissement
    if (status.thumbnail) $("thumbnail").src = `${status.thumbnail}?t=${status.checkedAt}`;
    $("title").textContent = status.title;
    const viewers = `${status.viewers.toLocaleString("fr-FR")} spectateurs`;
    $("meta").textContent = [status.game, viewers, `depuis ${formatUptime(status.startedAt)}`]
      .filter(Boolean)
      .join(" · ");
  }
}

async function init() {
  $("watch").href = CHANNEL_URL;
  $("thumbnail-link").href = CHANNEL_URL;
  renderLinks();

  const { status } = await chrome.storage.local.get("status");
  render(status);

  // Affiche d'abord l'état en cache, puis l'état frais
  const fresh = await chrome.runtime.sendMessage({ type: "refresh" });
  if (fresh) render(fresh);
}

$("settings").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
});

init();
