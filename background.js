// Firefox compatibility — Firefox uses `browser` instead of `chrome`
if (typeof chrome === "undefined" && typeof browser !== "undefined") {
  globalThis.chrome = browser;
}

// Background service worker — manages extension state and blocked counter

const DEFAULT_STATE = {
  enabled: true,
  blockedCount: 0,
  featureModal: true,
  featureVideo: true,
  featureSidebar: true,
  leftOffset: 60,
};

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULT_STATE, (data) => {
    chrome.storage.local.set({
      enabled: data.enabled ?? true,
      blockedCount: data.blockedCount ?? 0,
      featureModal: data.featureModal ?? true,
      featureVideo: data.featureVideo ?? true,
      featureSidebar: data.featureSidebar ?? true,
      leftOffset: data.leftOffset ?? 0,
    });
  });
});

// Listen for reset from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "RESET_BLOCKED") {
    chrome.storage.local.set({ blockedCount: 0 }, () => {
      sendResponse({ success: true, blockedCount: 0 });
    });
    return true;
  }
});
