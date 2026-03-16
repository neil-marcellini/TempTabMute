const DEFAULT_DURATION = 30;

const DURATIONS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
];

const optionsContainer = document.getElementById("options");
const savedMsg = document.getElementById("saved-msg");

let flashTimeout = null;

function render(selectedValue) {
  optionsContainer.innerHTML = "";
  for (const dur of DURATIONS) {
    const btn = document.createElement("button");
    btn.className = "option-btn" + (dur.value === selectedValue ? " active" : "");
    btn.textContent = dur.label;
    btn.addEventListener("click", () => selectDuration(dur.value));
    optionsContainer.appendChild(btn);
  }
}

async function selectDuration(value) {
  await chrome.storage.sync.set({ duration: value });
  render(value);
  flashSaved();
}

function flashSaved() {
  savedMsg.classList.remove("hidden");
  if (flashTimeout) clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => savedMsg.classList.add("hidden"), 1500);
}

async function init() {
  const data = await chrome.storage.sync.get("duration");
  render(data.duration || DEFAULT_DURATION);
}

init();
