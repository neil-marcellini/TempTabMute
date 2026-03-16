const DEFAULT_DURATION = 30;

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("unmute-tab-")) return;

  const tabId = parseInt(alarm.name.replace("unmute-tab-", ""), 10);
  try {
    await chrome.tabs.update(tabId, { muted: false });
  } catch {
    // Tab may have been closed
  }

  await chrome.storage.local.remove(`mute-${tabId}`);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "muteTab") {
    handleMute(msg.tabId, msg.duration).then(sendResponse);
    return true;
  }

  if (msg.action === "unmuteTab") {
    handleUnmute(msg.tabId).then(sendResponse);
    return true;
  }

  if (msg.action === "getStatus") {
    getStatus(msg.tabId).then(sendResponse);
    return true;
  }
});

async function handleMute(tabId, durationSec) {
  await chrome.tabs.update(tabId, { muted: true });

  const unmuteAt = Date.now() + durationSec * 1000;
  await chrome.storage.local.set({ [`mute-${tabId}`]: unmuteAt });

  const alarmName = `unmute-tab-${tabId}`;
  await chrome.alarms.clear(alarmName);
  await chrome.alarms.create(alarmName, { when: unmuteAt });

  return { ok: true, unmuteAt };
}

async function handleUnmute(tabId) {
  await chrome.tabs.update(tabId, { muted: false });
  await chrome.alarms.clear(`unmute-tab-${tabId}`);
  await chrome.storage.local.remove(`mute-${tabId}`);
  return { ok: true };
}

async function getStatus(tabId) {
  const data = await chrome.storage.local.get(`mute-${tabId}`);
  const unmuteAt = data[`mute-${tabId}`];
  if (!unmuteAt) return { muted: false };

  const remaining = unmuteAt - Date.now();
  if (remaining <= 0) {
    await handleUnmute(tabId);
    return { muted: false };
  }

  return { muted: true, unmuteAt, remainingMs: remaining };
}
