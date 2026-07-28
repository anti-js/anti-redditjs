// Firefox compatibility — Firefox uses `browser` instead of `chrome`
if (typeof chrome === "undefined" && typeof browser !== "undefined") {
  globalThis.chrome = browser;
}

// Popup script — manages UI state and communicates with background/content

const DEFAULTS = {
  enabled: true,
  blockedCount: 0,
  featureModal: true,
  featureVideo: true,
  featureSidebar: true,
  leftOffset: 60,
};

// Elements
const enableToggle = document.getElementById("enableToggle");
const toggleStatus = document.getElementById("toggleStatus");
const modalToggle = document.getElementById("modalToggle");
const videoToggle = document.getElementById("videoToggle");
const sidebarToggle = document.getElementById("sidebarToggle");
const leftOffsetSlider = document.getElementById("leftOffset");
const leftOffsetValue = document.getElementById("leftOffsetValue");
const blockedCountEl = document.getElementById("blockedCount");
const resetBtn = document.getElementById("resetBtn");

function updateToggleUI(enabled) {
  enableToggle.checked = enabled;
  if (enabled) {
    toggleStatus.textContent = "Active — blocking removed";
    toggleStatus.className = "toggle-status active";
  } else {
    toggleStatus.textContent = "Disabled — Reddit blocks visible";
    toggleStatus.className = "toggle-status inactive";
  }
}

function updateOffsetUI(value) {
  leftOffsetSlider.value = value;
  leftOffsetValue.textContent = value + "px";
}

function loadState() {
  chrome.storage.local.get(DEFAULTS, (data) => {
    updateToggleUI(data.enabled ?? true);
    modalToggle.checked = data.featureModal ?? true;
    videoToggle.checked = data.featureVideo ?? true;
    sidebarToggle.checked = data.featureSidebar ?? true;
    updateOffsetUI(data.leftOffset ?? 0);
    blockedCountEl.textContent = data.blockedCount ?? 0;
  });
}

// Master toggle
enableToggle.addEventListener("change", () => {
  const enabled = enableToggle.checked;
  chrome.storage.local.set({ enabled }, () => updateToggleUI(enabled));
});

// Feature toggles
modalToggle.addEventListener("change", () => {
  chrome.storage.local.set({ featureModal: modalToggle.checked });
});

videoToggle.addEventListener("change", () => {
  chrome.storage.local.set({ featureVideo: videoToggle.checked });
});

sidebarToggle.addEventListener("change", () => {
  chrome.storage.local.set({ featureSidebar: sidebarToggle.checked });
});

// Left offset slider
leftOffsetSlider.addEventListener("input", () => {
  const value = parseInt(leftOffsetSlider.value, 10);
  leftOffsetValue.textContent = value + "px";
});

leftOffsetSlider.addEventListener("change", () => {
  const value = parseInt(leftOffsetSlider.value, 10);
  chrome.storage.local.set({ leftOffset: value });
});

// Reset button
resetBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESET_BLOCKED" }, () => {
    blockedCountEl.textContent = "0";
  });
});

// Live update when storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedCount) {
    blockedCountEl.textContent = changes.blockedCount.newValue;
  }
  if (changes.enabled) {
    updateToggleUI(changes.enabled.newValue);
  }
  if (changes.featureModal !== undefined) {
    modalToggle.checked = changes.featureModal.newValue;
  }
  if (changes.featureVideo !== undefined) {
    videoToggle.checked = changes.featureVideo.newValue;
  }
  if (changes.featureSidebar !== undefined) {
    sidebarToggle.checked = changes.featureSidebar.newValue;
  }
  if (changes.leftOffset !== undefined) {
    updateOffsetUI(changes.leftOffset.newValue);
  }
});

loadState();
