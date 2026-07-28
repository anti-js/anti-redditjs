// Firefox compatibility — Firefox uses `browser` instead of `chrome`
if (typeof chrome === "undefined" && typeof browser !== "undefined") {
  globalThis.chrome = browser;
}

(function () {
  "use strict";

  var extensionEnabled = true;
  var featureModal = true;
  var featureVideo = true;
  var featureSidebar = true;
  var leftOffset = 60;
  var currentUrl = location.href;
  var countedForUrl = {};

  // Set attribute immediately so CSS hides blockers before storage loads
  document.documentElement.setAttribute("data-nsfw-bypass", "on");
  applyFeatureAttributes();
  applyLeftOffset();

  function applyBypassAttribute() {
    if (extensionEnabled) {
      document.documentElement.setAttribute("data-nsfw-bypass", "on");
    } else {
      document.documentElement.removeAttribute("data-nsfw-bypass");
    }
  }

  function applyFeatureAttributes() {
    var root = document.documentElement;
    if (featureModal) root.setAttribute("data-nsfw-modal", "on");
    else root.removeAttribute("data-nsfw-modal");
    if (featureVideo) root.setAttribute("data-nsfw-video", "on");
    else root.removeAttribute("data-nsfw-video");
    if (featureSidebar) root.setAttribute("data-nsfw-sidebar", "on");
    else root.removeAttribute("data-nsfw-sidebar");
  }

  function applyLeftOffset() {
    document.documentElement.style.setProperty(
      "--nsfw-left-offset",
      leftOffset + "px"
    );
  }

  function incrementCounter() {
    try {
      chrome.storage.local.get(["blockedCount"], function (data) {
        var current = data.blockedCount || 0;
        chrome.storage.local.set({ blockedCount: current + 1 });
      });
    } catch (e) {}
  }

  // Load all settings from storage
  try {
    chrome.storage.local.get(
      ["enabled", "featureModal", "featureVideo", "featureSidebar", "leftOffset"],
      function (data) {
        extensionEnabled = data.enabled !== false;
        featureModal = data.featureModal !== false;
        featureVideo = data.featureVideo !== false;
        featureSidebar = data.featureSidebar !== false;
        leftOffset = data.leftOffset ?? 60;
        applyBypassAttribute();
        applyFeatureAttributes();
        applyLeftOffset();
        if (extensionEnabled && document.body) {
          removeBlockingElements();
        }
      }
    );
  } catch (e) {
    applyBypassAttribute();
    applyFeatureAttributes();
  }

  // Listen for state changes from popup
  try {
    chrome.storage.onChanged.addListener(function (changes) {
      var needsRemoval = false;

      if (changes.enabled) {
        extensionEnabled = changes.enabled.newValue !== false;
        applyBypassAttribute();
        needsRemoval = true;
      }
      if (changes.featureModal !== undefined) {
        featureModal = changes.featureModal.newValue !== false;
        applyFeatureAttributes();
        needsRemoval = true;
      }
      if (changes.featureVideo !== undefined) {
        featureVideo = changes.featureVideo.newValue !== false;
        applyFeatureAttributes();
        needsRemoval = true;
      }
      if (changes.featureSidebar !== undefined) {
        featureSidebar = changes.featureSidebar.newValue !== false;
        applyFeatureAttributes();
        needsRemoval = true;
      }
      if (changes.leftOffset !== undefined) {
        leftOffset = changes.leftOffset.newValue || 0;
        applyLeftOffset();
      }

      if (needsRemoval && extensionEnabled) {
        removeBlockingElements();
      }
    });
  } catch (e) {}

  function removeBlockingElements() {
    if (!extensionEnabled) return;

    var removed = 0;

    // Remove NSFW blocking modals (if enabled)
    if (featureModal) {
      document
        .querySelectorAll(
          'configured-xpromo-modal, ' +
          'rpl-dialog[blocking], ' +
          'rpl-dialog[dialog-id^="configured-xpromo-blocking_xpromo_nsfw"], ' +
          'protected-community-modal, ' +
          '#blocking-modal-contents, ' +
          'div.rpl-dialog.configured-xpromo-modal, ' +
          'div[id^="configured-xpromo-blocking_xpromo_nsfw"]'
        )
        .forEach(function (el) {
          el.remove();
          removed++;
        });
    }

    // Remove sidebar banner (if enabled)
    if (featureSidebar) {
      var sidebar = document.querySelector('#left-sidebar-container');
      if (sidebar) {
        sidebar.remove();
        removed++;
      }
    }

    // Remove video NSFW overlay and reveal blurred content (if enabled)
    if (featureVideo) {
      document.querySelectorAll('xpromo-nsfw-blocking-container').forEach(function (container) {
        if (container.shadowRoot) {
          Array.from(container.shadowRoot.children).forEach(function (child) {
            if (child.tagName === 'DIV') {
              child.remove();
              removed++;
            }
          });
        }
      });

      document.querySelectorAll('shreddit-blurred-container[blurred]').forEach(function (el) {
        el.removeAttribute('blurred');
        removed++;
      });

      document.querySelectorAll('img.post-background-image-filter').forEach(function (img) {
        img.style.filter = 'none';
        img.style.opacity = '1';
        img.style.transform = 'none';
        removed++;
      });
    }

    // Remove the data protection consent sheet
    var consentSheet = document.querySelector(
      'rpl-dialog-sheet#data-protection-consent-sheet'
    );
    if (consentSheet) {
      consentSheet.remove();
      removed++;
    }

    // Remove scroll lock from body
    if (document.body) {
      document.body.classList.remove("rpl-scroll-lock");
      document.body.style.removeProperty("overflow");
      document.body.style.overflow = "auto";
    }

    // Also remove scroll lock from html
    document.documentElement.style.removeProperty("overflow");

    // Increment counter once per URL
    if (removed > 0 && !countedForUrl[currentUrl]) {
      countedForUrl[currentUrl] = true;
      incrementCounter();
    }
  }

  // Run immediately in case the DOM is already available
  if (document.body) {
    removeBlockingElements();
  }

  // Run on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", removeBlockingElements);

  // Run on load (all resources loaded)
  window.addEventListener("load", removeBlockingElements);

  // Use MutationObserver to catch dynamically inserted blocking elements
  var observer = new MutationObserver(function (mutations) {
    if (!extensionEnabled) return;
    var shouldRemove = false;
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) {
        shouldRemove = true;
        break;
      }
    }
    if (shouldRemove) {
      removeBlockingElements();
    }
  });

  // Start observing — keep it running indefinitely for SPA navigations
  function startObserver() {
    var target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["blurred", "open", "blocking"],
      });
    } else {
      setTimeout(startObserver, 10);
    }
  }
  startObserver();

  // Detect SPA navigation via URL polling + catch blocking elements
  setInterval(function () {
    if (!extensionEnabled) return;

    // Ensure the bypass attribute is always set (Reddit SPA may reset it)
    if (!document.documentElement.hasAttribute("data-nsfw-bypass")) {
      document.documentElement.setAttribute("data-nsfw-bypass", "on");
      applyFeatureAttributes();
    }

    // Check for URL change (SPA navigation)
    var newUrl = location.href;
    if (newUrl !== currentUrl) {
      currentUrl = newUrl;
      removeBlockingElements();
      setTimeout(removeBlockingElements, 500);
      setTimeout(removeBlockingElements, 1500);
    }

    // Check for blocking elements based on feature toggles
    var selectors = [];
    if (featureModal) {
      selectors.push('configured-xpromo-modal, rpl-dialog[blocking], protected-community-modal, div.rpl-dialog.configured-xpromo-modal, div[id^="configured-xpromo-blocking_xpromo_nsfw"]');
    }
    if (featureSidebar) {
      selectors.push('#left-sidebar-container');
    }
    if (featureVideo) {
      selectors.push('shreddit-blurred-container[blurred]');
    }

    var hasBlocking = selectors.length > 0 && document.querySelector(selectors.join(', '));
    if (hasBlocking || (document.body && document.body.classList.contains("rpl-scroll-lock"))) {
      removeBlockingElements();
    }
  }, 300);
})();
