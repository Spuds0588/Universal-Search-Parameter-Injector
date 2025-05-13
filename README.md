# Universal Search Parameter Injector (Chrome Extension)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Supercharge your browsing! Universal Search Parameter Injector lets you automate web page interactions like filling forms, clicking buttons, and more, simply by crafting special URLs. It's perfect for creating powerful custom search engine shortcuts in Chrome's Omnibox for *any* website, even those that don't natively support it.

The extension operates by processing command parameters in your URL sequentially. For security, it only activates on websites you explicitly add to an **Allowlist**.

## Key Features

*   **Multi-Step Automation:** Inject text, click elements, select dropdown options, add timed waits, and simulate Enter key presses.
*   **Popup Sequence Builder:** A user-friendly interface to build, reorder, and manage multi-step action sequences.
*   **Smart Element Identification (via Right-Click):**
    *   Right-click an element on an allowed page to add it to your sequence.
    *   Prioritizes stable identifiers: `aria-label` -> `id` -> `data-testid` -> `data-cy` / `data-cypress` -> `data-qa` / `data-qa-id` -> `name` -> `placeholder` -> various other `data-*` attributes (like `data-component`, `data-element`, `data-target`, `data-action`) -> CSS classes.
*   **Flexible Manual Control:** Craft URLs directly for advanced targeting using element IDs or any CSS selector (including attributes like `placeholder`, `data-component`, etc.).
*   **User-Managed Allowlist:** You control exactly which sites the extension can interact with.
*   **Sequential Execution:** Actions are performed in the order defined in your sequence or URL.

## Installation

**1. Recommended: Install from Chrome Web Store (Easiest & Automatic Updates)**

*   Visit the official extension page:
    [**Universal Search Parameter Injector on Chrome Web Store**](https://chromewebstore.google.com/detail/universal-search-paramete/mipgaemiejdnnaffeniniojohjidaklf)
*   Click "Add to Chrome".

**2. Alternative: Manual Installation (For Development / Testing)**

1.  Download or clone this repository's files.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **"Developer mode"** (toggle switch, usually top-right).
4.  Click **"Load unpacked"**.
5.  Select the directory containing the extension files (where `manifest.json` is located).
6.  The extension icon will appear in your toolbar.

## How it Works

1.  **Allowlist Sites:** Use the extension popup to add base URLs where you want to use the injector.
2.  **Build a Sequence:**
    *   **Right-Click + Popup:** Right-click an element on an allowlisted page, choose "Add to Injector Sequence...". The popup opens to the "Sequence Builder" tab, adding the identified element.
    *   **Manage in Popup:**
        *   For `<select>` elements (dropdowns), if you choose to "Set Value", the popup will fetch its options from the page, allowing you to pick the desired option directly in the popup.
        *   Add "Wait" steps with a custom duration (ms or s) using the inline form.
        *   Add "Press Enter" steps.
        *   Reorder steps using up/down arrows. The first step will be marked "(Start)".
        *   Delete steps.
3.  **Apply or Copy URL:**
    *   **"Apply & Reload Page":** The popup constructs a URL with your sequence parameters (automation parameters are placed first) and reloads the current page.
    *   **"Copy Full URL":** Copies the generated URL to your clipboard for manual use or saving. An output box shows the generated URL.
4.  **Execution:** When you navigate to a URL containing these special parameters (on an allowlisted site), `content.js` parses them and executes the actions in order, waiting for elements if necessary.

## Using the Popup Sequence Builder

1.  **Access:**
    *   Click the extension icon to open the popup. Navigate to the "Sequence Builder" tab.
    *   Or, right-click an element on an allowlisted page and select "Add to Injector Sequence...". This will open the popup and add the first step.
2.  **Adding Steps:**
    *   **From Page:** Right-click elements on the page. The extension tries to find the best identifier and adds a step (click or set value `search-text-here`). For `<select>` elements where you intend to set a value, the popup will guide you to select the specific option after its options are fetched from the page.
    *   **"Add Wait Step":** Click this in the popup. An inline form appears to enter duration and units (ms/s). Click "Add This Wait" to confirm.
    *   **"Add Press Enter Step":** Adds a step to simulate pressing Enter (targets the last input field that received text).
3.  **Managing Steps:**
    *   Each step shows its action (e.g., "1. (Start) Inject 'search-text-here' into #search-input").
    *   Use the **▲** and **▼** arrows to reorder steps.
    *   Click the **✕** to delete a step.
4.  **Generating the URL:**
    *   **"Apply & Reload Page":** Constructs the URL with all automation parameters placed *first* and reloads the current tab.
    *   **"Copy Full URL":** Generates the full URL with automation parameters first and copies it. An output box shows the generated URL.
    *   **"Clear Sequence":** Deletes all steps for the current tab's sequence.

*(Sequences are stored per-tab locally and cleared when the browser session ends or when manually cleared).*

## Manual URL Crafting (Advanced)

For maximum control or if the right-click method struggles, craft URLs manually.

**Key Rule:** Place **all** Universal Search Parameter Injector parameters at the **beginning** of the query string, *before* any parameters native to the website itself.

1.  Start with the base URL (e.g., `https://www.example.com/`).
2.  Add `?`.
3.  Add **your automation parameters first**, separated by `&`.
4.  If needed, add `&` then the site's native parameters (e.g., `&siteParam=value`).
5.  **Parameter Types:**
    *   **Element ID:** `search-input=search-text-here`, `submit-button=click`
    *   **CSS Selector:** Prefix with `css:`. Most flexible method.
        *   *ARIA Label:* `css:[aria-label="Search"]=search-text-here`
        *   *Data Test ID:* `css:[data-testid="login-btn"]=click`
        *   *Other Common Data Attributes:*
            *   `css:[data-cy="submit-button"]=click`
            *   `css:[data-qa="login-field"]=search-text-here`
            *   `css:[data-component="modal-dialog"] [data-element="close-button"]=click` (Combining data attributes)
            *   `css:[data-target="nav.menu"]=click`
            *   `css:[data-action="openProfile"]=click`
        *   *Name Attribute:* `css:[name="username"]=your_user`
        *   *Placeholder Attribute:* `css:[placeholder="Enter city..."]=search-text-here`
        *   *Class:* `css:.main-nav > li:nth-child(2) > a=click`
        *   *Structure:* `css:form#login > button[type='submit']=click`
        *   *Partial/Starts With:* `css:[id^="dynamic-prefix-"]=click`
    *   **Wait:** `wait=500ms` or `wait=3s`
    *   **Press Enter:** `pressEnter=true` (acts on last injected input)
6.  **Example (Automation First):**
    `https://example.com/search?css:[placeholder="Search term"]=myquery&pressEnter=true&wait=1s&css:button.filter=click&nativeFilter=true&page=1`

## Using with Chrome Custom Search Engines

1.  Build/craft your final URL with automation parameters first.
2.  Replace the placeholder value (e.g., `search-text-here`) with `%s`.
3.  Go to `chrome://settings/searchEngines` -> "Site search" -> "Add".
4.  Fill in:
    *   Search engine: (e.g., "My Site Automated Search")
    *   Shortcut: (e.g., `mys`)
    *   URL with %s... : Paste your modified URL.
5.  Now, type `mys yourquery` in the Omnibox!

## Troubleshooting / Limitations

*   **Parameter Order:** Automation parameters **must** be first in the URL for reliable and fast execution.
*   **Site Blocking / `429` Errors:** Some sites block rapid automated interactions/reloads. The "Apply & Reload" or right-click method might fail. Manually crafting the full URL and navigating once is more robust for these sites.
*   **Dynamic Elements:** While the extension tries hard, manual CSS selectors are best for highly dynamic sites or elements in Shadow DOM/iframes. The automatic identification priority is: `aria-label` > stable `id` > `data-testid` > `data-cy`/`data-cypress` > `data-qa`/`data-qa-id` > `name` > `placeholder` > other common `data-*` attributes > stable `class` combination.
*   **`pressEnter` Reliability:** Varies greatly by site.
*   **Right-Click Target:** Uses `element.closest()` to find interactive elements near the click. Manual crafting offers precision.

## Codebase Structure
```
├── background.js         # Service worker (main logic, context menus, URL construction)
├── content.js            # Content script (parameter parsing, DOM interaction)
├── listener.js           # Content script (right-click listener)
├── manifest.json         # Extension configuration
├── popup.html            # Popup UI (tabs, allowlist, sequence builder)
├── popup.css             # Popup styles
├── popup.js              # Popup logic (allowlist, sequence UI, messaging)
├── README.md             # This file (GitHub version)
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
License

This project is licensed under the MIT License.

MIT License

Copyright (c) 2025 Burns Development

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
