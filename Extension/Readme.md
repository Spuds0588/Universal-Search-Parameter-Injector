# Universal Search Parameter Injector (Chrome Extension) - Codebase README

## Project Goal

This Chrome extension enables users to automate interactions (text input, clicks, waits, Enter key presses) on specified websites by embedding commands as URL query parameters. It provides a simple right-click interface to incrementally build these command URLs and manages an allowlist of sites where the extension is permitted to run.

## Architecture (Manifest V3)

*   **Service Worker (`background.js`):** The central orchestrator.
    *   Manages the site allowlist (`chrome.storage.sync`).
    *   Creates and handles context menu events (`chrome.contextMenus`).
    *   Checks if a navigated URL is allowlisted before injecting scripts or processing context menu clicks.
    *   Receives identifier information from the content script context after a context menu click.
    *   Constructs the new URL with the appended parameter.
    *   Reloads the tab with the new URL (`chrome.tabs.update`).
    *   Injects `listener.js` and `content.js` into allowlisted pages upon navigation completion (`chrome.tabs.onUpdated`).
*   **Content Script (`listener.js`):** A minimal script injected early into allowlisted pages. Its sole purpose is to listen for `contextmenu` events and store the `event.target` in `window.lastRightClickedElement` for the background script to query later.
*   **Content Script (`content.js`):** Injected into allowlisted pages. Reads the `window.location.search` parameters on load and executes the specified actions sequentially:
    *   Handles `wait=<duration>` parameter.
    *   Handles `pressEnter=true` parameter (attempts to simulate Enter on the last interacted input).
    *   Handles standard `elementIdentifier=value` or `elementIdentifier=click` parameters.
    *   Uses `waitForTarget` (with MutationObserver) to find elements specified by ID or CSS selector (including `css:` prefix).
    *   Performs value injection or `.click()`.
*   **Popup (`popup.html`, `popup.js`, `popup.css`):** Provides the UI for users to manage the allowlist of base URLs. Includes "Add Current Site" functionality. Uses `chrome.storage.sync`.
*   **Manifest (`manifest.json`):** Declares permissions (`storage`, `scripting`, `tabs`, `contextMenus`), background service worker, action popup, host permissions (`<all_urls>` needed for `scripting.executeScript` targetting potentially any user-added host), and icons.

## Core Workflows Explained

### 1. Allowlisting

*   User opens the popup.
*   `popup.js` loads the current list from `chrome.storage.sync`.
*   User clicks "Add Current Site" -> `popup.js` gets the active tab's origin via `chrome.tabs.query` and adds it (via `addUrl`) to storage.
*   User manually adds URL -> `popup.js` validates and adds it (via `addUrl`) to storage.
*   `addUrl` ensures format (`https://.../`) and prevents duplicates before saving.

### 2. Right-Click URL Building

1.  User right-clicks on an allowlisted page.
2.  `listener.js` (already injected) captures `event.target` into `window.lastRightClickedElement`.
3.  User selects a custom context menu item ("Set Value" or "Click Element").
4.  `background.js` `onClicked` listener fires.
5.  It verifies the URL is still allowlisted (redundant check, but safe).
6.  It calls `chrome.scripting.executeScript` to execute the `getElementIdentifier` function *within the context of the page*.
7.  `getElementIdentifier`:
    *   Retrieves `window.lastRightClickedElement`.
    *   Calls `.closest()` on it to find the nearest relevant interactive element (`input`, `button`, `a`, etc.).
    *   Analyzes the found element, checking for identifiers in order: unique `aria-label`, stable & unique `id`, unique stable class combination. Uses heuristics to judge ID/class stability.
    *   Returns an object `{ type: 'id'|'css', identifier: '...' }` or `null`.
8.  `background.js` receives the result in the `.then()` block.
9.  If successful, it constructs the parameter key (prefixing CSS selectors with `css:`) and value (`search-text-here` or `click`).
10. It constructs the `newUrl` by appending the URL-encoded parameter to the tab's current URL.
11. It calls `chrome.tabs.update(tabId, { url: newUrl })` to **reload the page**.
12. If identification fails, it attempts to show an `alert()` on the page.

### 3. URL Parameter Execution (on Page Load)

1.  User navigates to (or is reloaded to) an allowlisted URL containing injector parameters (e.g., `...?search-input=query&wait=500ms&submit-btn=click`).
2.  `background.js` `checkAndInject` function injects `listener.js` and `content.js`.
3.  `content.js` execution starts.
4.  `processUrlParametersSequentially` function runs:
    *   Parses `window.location.search` using `URLSearchParams`.
    *   Iterates through parameters **in order**.
    *   Uses a `lastInjectedInputElement` variable to track state for `pressEnter`.
    *   If key is `wait`, parses duration and `await`s a `setTimeout`.
    *   If key is `pressEnter`, calls `simulateEnterKeyPress` on `lastInjectedInputElement` if available.
    *   Otherwise, treats the key as a `targetSpecifier`.
    *   Calls `await waitForTarget(targetSpecifier)` to find the element (handling `css:` prefix), potentially waiting with MutationObserver.
    *   If element found:
        *   If value is `click`, calls `performClick`.
        *   Otherwise, calls `performInjection`. If successful on an input-type, updates `lastInjectedInputElement`.
    *   If element not found within timeout, logs a warning and continues.

## Element Identification Strategy (`getElementIdentifier`)

The goal is to find the most stable and unique identifier for the element closest to the user's right-click.

1.  **Find Target:** Start with `window.lastRightClickedElement` (set by `listener.js`). Use `element.closest('input, textarea, button, a, [role="button"], [contenteditable="true"]')` to find the nearest interactive element (or the element itself). If none found, return `null`.
2.  **Check ARIA Label:** Get `aria-label` from the found element. If present and non-empty, construct `[aria-label="..."]` selector. Check if `document.querySelectorAll` with this selector returns exactly one element which is the target element. If yes, return `{ type: 'css', identifier: selector }`. Handle quote escaping within the label for the selector string.
3.  **Check ID:** Get `id`. If present and non-empty, apply heuristics (regex checks for UUIDs, framework patterns, long strings, etc.) to guess if it's stable. If it seems stable, double-check uniqueness with `querySelectorAll('#escapedId')`. If unique, return `{ type: 'id', identifier: id }`.
4.  **Check Classes:** Get `classList`. Filter out potentially unstable classes (e.g., containing numbers, starting with `_`, containing `:`). If stable classes remain, join them into a compound selector (e.g., `.classA.classB`). Check uniqueness with `querySelectorAll`. If unique, return `{ type: 'css', identifier: selector }`.
5.  **Failure:** If none of the above succeed, return `null`.

## Special Parameters Reference

*   `wait=<duration>`: Pauses execution. `<duration>` should be like `500ms` or `2s`. Invalid formats are ignored.
*   `pressEnter=true`: Simulates an Enter key press (`keydown` and `keyup`) on the element that was the target of the *immediately preceding* successful text injection action. If the preceding action wasn't a text injection into an input/textarea/contentEditable, or if that element is gone, it logs a warning. (Compatibility varies greatly).

## Codebase Structure


.
├── background.js # Service worker (main logic, event handling, context menus, reload)
├── content.js # Content script (parameter parsing, sequential execution, DOM interaction)
├── listener.js # Content script (minimal listener for right-clicks)
├── manifest.json # Extension configuration and permissions
├── popup.css # Styles for the popup
├── popup.html # HTML structure for the popup
├── popup.js # Logic for the allowlist management popup
├── README.md # This file (Developer notes)
└── icons/ # Extension icons
├── icon16.png
├── icon48.png
└── icon128.png```

Known Limitations & Considerations

Anti-Bot / Rate Limiting: The right-click/reload method can trigger anti-bot defenses on some sites (e.g., Realtor.com, Zillow.com), causing page load errors (429) and preventing the extension from working reliably via that method. Manual URL crafting is necessary for such sites.

Dynamic Content: While waitForTarget uses MutationObserver, extremely dynamic sites or elements within Shadow DOM / iframes may still pose challenges for identification and interaction.

Selector Stability: The generated selectors (aria-label, class) are based on the state of the page at the time of the right-click. If the site structure changes significantly later, these selectors might break. Stable IDs are preferred when available.

pressEnter Reliability: Highly dependent on how the target website handles keyboard events.

State Loss on Reload: The right-click build method loses all page state with each step.

License

MIT License - see separate LICENSE file or text block below.

MIT License

Copyright (c) [Year] [Your Name/Organization]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.