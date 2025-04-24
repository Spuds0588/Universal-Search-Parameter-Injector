# Universal Search Parameter Injector (Chrome Extension)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This Chrome extension provides a mechanism to automatically populate HTML form elements or `contentEditable` areas based on URL query parameters. Unlike Chrome's native custom search engine feature which relies on specific website implementations (like OpenSearch), this extension directly injects values into the DOM based on element IDs found in the URL parameters.

Crucially, this functionality is restricted to run only on base URLs explicitly added to an allowlist managed by the user via the extension's popup interface. This prevents the extension from attempting to inject scripts or manipulate the DOM on unintended websites.

## Architecture

The extension follows a standard Manifest V3 architecture utilizing a service worker, content scripts (injected programmatically), and a popup action.

*   **`manifest.json`**: Defines permissions, entry points (service worker, action popup), icons, and crucially, the `host_permissions` needed for dynamic script injection.
*   **`background.js` (Service Worker)**: Acts as the central coordinator.
    *   Listens for tab navigation events (`chrome.tabs.onUpdated`).
    *   Manages the allowlist of base URLs stored in `chrome.storage.sync`.
    *   Determines if the current navigation URL matches an allowed base URL.
    *   If a match occurs, uses the `chrome.scripting.executeScript` API to dynamically inject `content.js` into the relevant tab.
*   **`content.js`**: The script executed within the context of the target web page.
    *   Parses the `window.location.search` string using `URLSearchParams`.
    *   Iterates through all query parameters, treating each key as a potential target element ID and the corresponding value as the data to inject.
    *   Attempts to find elements using `document.getElementById(key)`.
    *   Injects the value into the `.value` property for standard form elements (`input`, `textarea`, `select`) or `.textContent` for `contentEditable` elements.
    *   Dispatches `input` and `change` events programmatically after value injection to ensure compatibility with JavaScript frameworks and event listeners on the host page.
    *   Implements a `MutationObserver` to handle cases where target elements might be loaded dynamically *after* the initial DOM load. It observes the `document.body` for additions and attempts injection if a previously missing target element appears. Includes a timeout to prevent indefinite observation.
    *   Uses a simple guard (`window.universalSearchParameterInjectorRan`) to prevent its core logic from executing multiple times if injected more than once per page load cycle.
*   **`popup.html` / `popup.css` / `popup.js`**: Provides the user interface for managing the allowlist.
    *   Uses `chrome.storage.sync` to load, display, add, and remove allowed base URLs.
    *   Provides basic input validation (requires `http://` or `https://` prefix).
    *   Changes are saved immediately to synced storage.
*   **`icons/`**: Contains standard extension icons for different contexts.

## Detailed Workflow

1.  **Initialization / Navigation**: When a tab finishes loading (`changeInfo.status === 'complete'` in `tabs.onUpdated`), the `background.js` service worker is triggered.
2.  **URL Check**: The service worker retrieves the tab's URL. It ignores non-HTTP/S URLs.
3.  **Allowlist Check**: It asynchronously fetches the `allowedBaseUrls` array from `chrome.storage.sync`.
4.  **Matching**: It iterates through the `allowedBaseUrls` and checks if the tab's current URL `startsWith()` any of the allowed base URLs.
5.  **Dynamic Injection**: If a match is found:
    *   The service worker calls `chrome.scripting.executeScript`, targeting the specific `tabId` and specifying `content.js` as the file to inject.
    *   **Permission Requirement**: This step requires the `"scripting"` permission and, critically, the `"host_permissions": ["<all_urls>"]` (or appropriately broad patterns). The host permission is necessary for the extension to *gain the capability* to inject into arbitrary origins *if* the user adds them to the allowlist later. It does *not* mean the script runs everywhere automatically.
6.  **Content Script Execution (`content.js`)**:
    *   The script runs within the sandboxed environment of the target webpage.
    *   The `window.universalSearchParameterInjectorRan` flag is checked; if true, the script exits early. Otherwise, the flag is set to true.
    *   `new URLSearchParams(window.location.search)` extracts the query parameters.
    *   The script iterates through each `[key, value]` pair from the parameters.
    *   **Immediate Injection Attempt**: For each key, `document.getElementById(key)` is called.
        *   If an element is found:
            *   Its type is checked (`'value' in element` or `isContentEditable`).
            *   The `value` (from the URL parameter) is assigned to the element's `value` or `textContent`.
            *   `new Event('input', { bubbles: true })` and `new Event('change', { bubbles: true })` are dispatched on the element. This is crucial for triggering potential framework bindings or event listeners that rely on user interaction events.
        *   If the element is *not* found, the `[key, value]` pair is added to a `pendingInjections` map.
    *   **Delayed Injection Setup**: If `pendingInjections` is not empty after the initial pass:
        *   A `MutationObserver` is configured to watch `document.body` (and its `subtree`) for `childList` changes (nodes being added/removed).
        *   When mutations occur, the observer's callback iterates through the `pendingInjections`. For each pending key, it checks `document.getElementById(key)` again.
        *   If a pending element is now found, the injection (value assignment + event dispatching) is attempted, and the key is removed from `pendingInjections`.
        *   If all pending injections are completed, the observer `disconnect()`s itself.
        *   A `setTimeout` is also established (e.g., 15 seconds) to `disconnect()` the observer regardless, preventing it from running indefinitely on highly dynamic pages or if target elements never appear.
7.  **User Interaction (Popup)**:
    *   Clicking the extension action icon opens `popup.html`.
    *   `popup.js` fetches the `allowedBaseUrls` from `chrome.storage.sync` and renders the list.
    *   Adding/removing URLs via the popup UI updates the list in the UI and saves the modified array back to `chrome.storage.sync`.

## Key Implementation Details & Considerations

*   **Permissions Rationale**:
    *   `storage`: Required for persisting the user's `allowedBaseUrls` list using `chrome.storage.sync`.
    *   `scripting`: Required for programmatic injection via `chrome.scripting.executeScript`.
    *   `tabs`: Used by the background script to get the URL of updated tabs (`tabs.onUpdated`). An alternative could be `webNavigation` (`onCompleted` event), which might offer slightly more precision, especially for SPA transitions if filtered correctly (e.g., `frameId === 0`).
    *   `host_permissions: ["<all_urls>"]`: Essential for `chrome.scripting.executeScript` to function on *any* potential host the user might add to their allowlist. The actual execution is gated by the explicit check against `allowedBaseUrls` in `background.js`.
*   **Manifest V3 Service Worker**: Adheres to MV3's event-driven model. The background script is non-persistent and wakes up only when needed (e.g., on `tabs.onUpdated`). State must be managed via storage APIs.
*   **URL Parameter Mapping**: The current implementation assumes a direct mapping: `?elementId=value`. Any query parameter key is treated as a potential element ID. This offers flexibility but requires users to construct URLs precisely. There's no specific prefix (like `?inject_elementId=value`) required.
*   **Dynamic Element Handling**: The use of `MutationObserver` provides robustness for pages where target elements are rendered client-side after the initial HTML parse (common in SPAs or with heavy JavaScript). The timeout ensures resource cleanup.
*   **Event Dispatching**: Manually dispatching `input` and `change` events is vital for ensuring that host page JavaScript (especially in frameworks like React, Vue, Angular) recognizes the value change as if it were user-initiated. Simply setting `.value` often isn't sufficient.
*   **Sync Storage**: Using `chrome.storage.sync` allows the user's allowlist to synchronize across different devices where they are logged into the same Chrome profile.

## Potential Future Enhancements

*   Support for more flexible URL matching (e.g., wildcards, regex) instead of just `startsWith`.
*   Allow targeting elements via CSS selectors in addition to IDs (e.g., `?cssSelector=.search-field&value=query`).
*   Implement a specific prefix for query parameters to avoid clashes with existing site parameters (e.g., `?usp_elementId=value`).
*   More sophisticated detection of SPA navigation events beyond basic `tabs.onUpdated`.
*   Provide visual feedback on the page when an injection occurs (e.g., brief element highlighting).
*   Add import/export functionality for the allowlist in the popup.

## License

This project is licensed under the MIT License.

```text
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
