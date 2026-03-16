const DEFAULT_DURATION = 30;

const PRESETS = [
  { value: 30, label: "30s" },
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 900, label: "15 min" },
  { value: 1800, label: "30 min" },
  { value: 3600, label: "1 hr" },
];

const DURATION_LABELS = Object.fromEntries(PRESETS.map((p) => [p.value, p.label]));

// Pages
const pageMain = document.getElementById("page-main");
const pageSettings = document.getElementById("page-settings");

// Main page elements
const muteBtn = document.getElementById("mute-btn");
const countdownSection = document.getElementById("countdown-section");
const countdownEl = document.getElementById("countdown");
const unmuteBtn = document.getElementById("unmute-btn");
const settingsBtn = document.getElementById("settings-btn");
const tabTitleEl = document.getElementById("tab-title");

// Settings page elements
const backBtn = document.getElementById("back-btn");
const customInput = document.getElementById("custom-input");
const customSetBtn = document.getElementById("custom-set-btn");
const parseHint = document.getElementById("parse-hint");
const presetsContainer = document.getElementById("presets");

let currentTabId = null;
let tickInterval = null;
let unmuteAt = null;

// --- Duration text parsing ---

function parseDurationText(text) {
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return null;

  let totalSeconds = 0;
  let matched = false;

  const pattern = /(\d+)\s*(h|m|s)/g;
  let match;
  while ((match = pattern.exec(cleaned)) !== null) {
    matched = true;
    const num = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === "h") totalSeconds += num * 3600;
    else if (unit === "m") totalSeconds += num * 60;
    else if (unit === "s") totalSeconds += num;
  }

  // If no unit-based match, try bare number (treat as seconds)
  if (!matched && /^\d+$/.test(cleaned)) {
    totalSeconds = parseInt(cleaned, 10);
    matched = true;
  }

  return matched && totalSeconds > 0 ? totalSeconds : null;
}

function formatDuration(seconds) {
  if (DURATION_LABELS[seconds]) return DURATION_LABELS[seconds];
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

function formatCountdown(ms) {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// --- Storage ---

async function getDuration() {
  const data = await chrome.storage.sync.get("duration");
  return data.duration || DEFAULT_DURATION;
}

async function setDuration(value) {
  await chrome.storage.sync.set({ duration: value });
}

// --- Page navigation ---

function showPage(page) {
  pageMain.classList.add("hidden");
  pageSettings.classList.add("hidden");
  page.classList.remove("hidden");
}

// --- Main page logic ---

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentTabId = tab.id;
  tabTitleEl.textContent = tab.title || "";

  const duration = await getDuration();
  muteBtn.textContent = `Mute ${formatDuration(duration)}`;

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
    getDuration().then((d) => {
      muteBtn.textContent = `Mute ${formatDuration(d)}`;
    });
  }
});

settingsBtn.addEventListener("click", () => {
  showPage(pageSettings);
  initSettings();
});

// --- Settings page logic ---

async function initSettings() {
  const current = await getDuration();
  renderPresets(current);
  customInput.value = "";
  parseHint.textContent = "";
  parseHint.className = "parse-hint";
  customInput.focus();
}

function renderPresets(selectedValue) {
  presetsContainer.innerHTML = "";
  for (const preset of PRESETS) {
    const btn = document.createElement("button");
    btn.className = "preset-btn" + (preset.value === selectedValue ? " active" : "");
    btn.textContent = preset.label;
    btn.addEventListener("click", () => applyDuration(preset.value));
    presetsContainer.appendChild(btn);
  }
}

async function applyDuration(seconds) {
  await setDuration(seconds);
  muteBtn.textContent = `Mute ${formatDuration(seconds)}`;
  renderPresets(seconds);
  parseHint.textContent = `Set to ${formatDuration(seconds)}`;
  parseHint.className = "parse-hint success";
}

customInput.addEventListener("input", () => {
  const parsed = parseDurationText(customInput.value);
  if (!customInput.value.trim()) {
    parseHint.textContent = "";
    parseHint.className = "parse-hint";
  } else if (parsed) {
    parseHint.textContent = `= ${formatDuration(parsed)}`;
    parseHint.className = "parse-hint success";
  } else {
    parseHint.textContent = "Could not parse duration";
    parseHint.className = "parse-hint error";
  }
});

customInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyCustom();
});

customSetBtn.addEventListener("click", applyCustom);

async function applyCustom() {
  const parsed = parseDurationText(customInput.value);
  if (!parsed) {
    parseHint.textContent = "Enter a duration like 1h 3m, 70s, 3m";
    parseHint.className = "parse-hint error";
    return;
  }
  await applyDuration(parsed);
  customInput.value = "";
}

backBtn.addEventListener("click", () => {
  showPage(pageMain);
});

// --- Start ---
init();
