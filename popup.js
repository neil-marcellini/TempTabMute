const DEFAULT_DURATION = 30;

const muteBtn = document.getElementById("mute-btn");
const countdownSection = document.getElementById("countdown-section");
const countdownEl = document.getElementById("countdown");
const unmuteBtn = document.getElementById("unmute-btn");
const settingsBtn = document.getElementById("settings-btn");
const tabTitleEl = document.getElementById("tab-title");

let currentTabId = null;
let tickInterval = null;
let unmuteAt = null;

const DURATION_LABELS = {
  30: "30s",
  60: "1 min",
  300: "5 min",
  900: "15 min",
  1800: "30 min",
  3600: "1 hour",
};

function formatLabel(seconds) {
  return DURATION_LABELS[seconds] || `${seconds}s`;
}

function formatCountdown(ms) {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function getDuration() {
  const data = await chrome.storage.sync.get("duration");
  return data.duration || DEFAULT_DURATION;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentTabId = tab.id;
  tabTitleEl.textContent = tab.title || "";

  const duration = await getDuration();
  muteBtn.textContent = `Mute ${formatLabel(duration)}`;

  const resp = await chrome.runtime.sendMessage({
    action: "getStatus",
    tabId: currentTabId,
  });

  if (resp?.muted) {
    showMutedState(resp.unmuteAt);
  } else {
    showReadyState();
  }
}

function showMutedState(targetTime) {
  unmuteAt = targetTime;
  muteBtn.classList.add("muted");
  muteBtn.disabled = true;
  countdownSection.classList.remove("hidden");
  startTick();
}

function showReadyState() {
  unmuteAt = null;
  muteBtn.classList.remove("muted");
  muteBtn.disabled = false;
  countdownSection.classList.add("hidden");
  stopTick();
}

function startTick() {
  tick();
  tickInterval = setInterval(tick, 200);
}

function stopTick() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function tick() {
  if (!unmuteAt) return;
  const remaining = unmuteAt - Date.now();
  if (remaining <= 0) {
    showReadyState();
    init();
    return;
  }
  countdownEl.textContent = formatCountdown(remaining);
}

muteBtn.addEventListener("click", async () => {
  if (!currentTabId || muteBtn.disabled) return;
  const duration = await getDuration();
  const resp = await chrome.runtime.sendMessage({
    action: "muteTab",
    tabId: currentTabId,
    duration,
  });
  if (resp?.ok) {
    showMutedState(resp.unmuteAt);
  }
});

unmuteBtn.addEventListener("click", async () => {
  if (!currentTabId) return;
  const resp = await chrome.runtime.sendMessage({
    action: "unmuteTab",
    tabId: currentTabId,
  });
  if (resp?.ok) {
    showReadyState();
    const duration = await getDuration();
    muteBtn.textContent = `Mute ${formatLabel(duration)}`;
  }
});

settingsBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "settings.html" });
});

init();
