# Universal Search Parameter Injector (Chrome Extension)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This Chrome extension allows you to leverage functionality similar to Chrome's built-in custom search engines on virtually *any* website, even those that don't natively support it.

It works by letting you construct special URLs containing parameters that tell the extension which elements on a page to interact with (like input fields or buttons) and what actions to perform (like injecting text, clicking, waiting, or simulating an Enter key press). Actions are performed sequentially based on the order of parameters in the URL.

For security and control, the extension will only activate on websites whose base URL you have explicitly added to an **Allowlist** via the extension's popup.

## Key Features

*   **Parameter Injection:** Inject text values into input fields, textareas, or contenteditable elements using URL parameters.
*   **Click Simulation:** Simulate a click on buttons, links, or other elements.
*   **Wait Action:** Introduce timed pauses between actions.
*   **Enter Keypress Simulation:** Simulate pressing the "Enter" key, typically after filling an input.
*   **Flexible Element Identification:** Target elements using:
    *   ARIA Label (Often stable)
    *   Element ID (Ideal if stable)
    *   Data Attributes (e.g., `data-testid`, `data-cy`, `data-qa`, `data-component`)
    *   Name Attribute (Common for forms)
    *   Placeholder Attribute (For inputs)
    *   CSS Class combinations
*   **User-Managed Allowlist:** Extension only runs on sites you approve.
*   **Right-Click URL Builder:** Incrementally build the action sequence URL by right-clicking elements on allowed pages. Attempts to find the best stable identifier automatically. (Note: Reloads the page after each step).
*   **Manual URL Crafting:** Full control for advanced users to write parameters directly.
*   **Sequential Execution:** Parameters are processed in the order they appear in the URL.

## Installation

1.  Download or clone the extension files/repository.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **"Developer mode"** using the toggle switch (usually in the top right corner).
4.  Click the **"Load unpacked"** button.
5.  Select the directory containing the extension files (`manifest.json`, etc.).
6.  The extension icon should appear in your toolbar.

## How it Works Conceptually

The extension monitors page loads on allowed websites. If the URL contains special query parameters that the extension recognizes, it waits for the page elements specified by those parameters to potentially load. It then attempts to perform the requested actions (injecting text, clicking, waiting, pressing Enter) in the sequence defined by the parameter order.

## Usage Instructions

### 1. Allowlisting Websites (Required)

Before the extension can work on a site, you must add its base URL to the allowlist.

1.  Navigate to the website you want to enable the extension for (e.g., `https://www.example.com/some/path`).
2.  Click the **Universal Search Parameter Injector icon** in your Chrome toolbar to open the popup.
3.  **Option A (Easiest):** Click the **"Add Current Site to Allowlist"** button. This will automatically extract the base URL (e.g., `https://www.example.com/`) and add it.
4.  **Option B (Manual):** Enter the **base URL** (including `https://` or `http://` and preferably ending with a `/`, like `https://www.example.com/`) into the "Add New URL Manually" input field and click "Add".
5.  The URL will appear in the "Current List". You can remove URLs using the "Remove" button next to them.

### 2. Building the URL Sequence

You can create the sequence of actions in two ways:

#### Method A: Using Right-Click (Easier, With Reloads)

This method lets you build the URL step-by-step directly on the page. **Important Note:** Each step added via right-click will **automatically reload the page** with the new parameter appended to the URL. This provides immediate feedback but means:
*   Any state on the page (like filled forms not yet submitted, or dynamically opened menus) will be lost on each reload.
*   Some websites might have security measures that block rapid, automated reloads (like Realtor.com, Zillow.com), causing this method to fail with errors on those sites.

**Steps:**

1.  Ensure the website is **allowlisted**.
2.  Navigate to the base page on the site where you want the actions to start.
3.  **Right-click** on or near the first element you want to interact with (e.g., a search input field). The extension uses `.closest()` to find the nearest relevant interactive element (`input`, `button`, `a`, etc.).
4.  Choose the appropriate action from the context menu:
    *   **"Add to Injector: Set Value (search-text-here)"**: Select this for input fields, textareas, etc. It will add a parameter like `elementId=search-text-here` or `css:[aria-label...]=search-text-here` to the URL using the best identifier found.
    *   **"Add to Injector: Click Element"**: Select this for buttons, links, etc. It will add a parameter like `elementId=click` or `css:.selector=click`.
5.  The extension attempts to identify the element uniquely using this priority order: `aria-label` -> stable `id` -> `data-testid` -> `data-cy`/`data-cypress` -> `data-qa`/`data-qa-id` -> `name` -> `placeholder` -> `data-component`/`data-element`/`data-target`/`data-action` -> stable `class` combination. Check the background DevTools console (via `chrome://extensions/`) for logs about which identifier was chosen if needed.
6.  The page will **reload** with the new parameter added to the URL in the address bar.
7.  **Repeat steps 3-6** for each subsequent element.
8.  Once complete, **manually copy the final URL** from your address bar.

*(Note: If the right-click method fails to find a unique, stable identifier from the priority list, you may receive an alert. In these cases, use the Manual URL Crafting method.)*

#### Method B: Manual URL Crafting (Advanced / More Control)

Construct the URL manually for precise control, especially if the right-click method fails or if you need to target elements in specific ways using DevTools (`F12` -> Inspect Element).

1.  Start with the base URL of the allowlisted site (e.g., `https://www.example.com/`).
2.  Add a `?` to start the query parameters.
3.  Add parameters in the format `key=value`, separated by `&`. The **order matters** - actions execute sequentially.
4.  **Parameter Key Types (Identifier = value/click):**
    *   **Element ID:** Use the element's `id` directly if it's stable and unique.
        *   `search-input=search-text-here`
        *   `submit-button=click`
    *   **CSS Selector:** Use the prefix `css:` followed by a standard CSS selector. This is the **most flexible and recommended method** for complex sites.
        *   *ARIA Label:* `css:[aria-label="Label Text"]=search-text-here`
        *   *Data Test ID:* `css:[data-testid="main-search"]=search-text-here`
        *   *Other Data Attributes:* `css:[data-cy="submit"]=click`, `css:[data-qa="login-button"]=click`, `css:[data-component="modal-close"]=click`
        *   *Name Attribute:* `css:[name="username"]=search-text-here`
        *   *Placeholder Attribute:* `css:[placeholder="Address, City, etc..."]=search-text-here`
        *   *Class:* `css:.order-button.primary=click`
        *   *Structure:* `css:form#login > button[type='submit']=click`
        *   *Partial/Starts With:* `css:[id^="dynamic-prefix-"]=click`

5.  **Special Action Parameters:**
    *   **Wait Action:** Introduce a pause. Key: `wait`. Value: duration like `500ms` or `2s`.
        *   `wait=500ms`
        *   `wait=3s`
    *   **Press Enter Action:** Simulate Enter key press on the *last successfully injected* input/textarea/contentEditable. Key: `pressEnter`. Value: typically `true`.
        *   `pressEnter=true`
        *   *(Note: Compatibility varies.)*
6.  **Combine Parameters:** Chain actions using `&`.
    *   *Example:* Inject using ID, wait, click using `data-testid`.
        `https://www.example.com/?search-input=search-text-here&wait=500ms&css:[data-testid="submit-search"]=click`
    *   *Example:* Click ARIA-label, inject into placeholder, press Enter.
        `https://www.example.com/?css:[aria-label="Category"]=click&css:[placeholder="Keyword Search"]=search-text-here&pressEnter=true`

*(Note: When manually crafting URLs with special characters in selectors (spaces, quotes, brackets, etc.), ensure they are properly URL-encoded if pasting directly into the address bar or using in contexts outside Chrome's search engine settings. The extension handles decoding correctly.)*

### 3. Using the Generated URL (e.g., in Chrome Search Engines)

Once you have the final URL:

1.  **Identify Placeholder:** Locate `search-text-here` value(s).
2.  **Go to Chrome Search Engine Settings:** `chrome://settings/searchEngines`.
3.  Click "Add" next to "Site search".
4.  **Configure:**
    *   **Search engine:** Descriptive name (e.g., "eBay Search Specific").
    *   **Shortcut:** Short keyword (e.g., `ebs`).
    *   **URL with %s in place of query:** Paste your URL. **Carefully replace** `search-text-here` with `%s`.
        *   *Example URL:* `https://www.ebay.com/?css:[aria-label="Search for anything"]=search-text-here&pressEnter=true`
        *   *Becomes:* `https://www.ebay.com/?css:[aria-label="Search for anything"]=%s&pressEnter=true`
    *   Click "Add".
5.  **Use:** Type your shortcut (`ebs`) in the address bar, press `Space` or `Tab`, type your query, press `Enter`. Chrome navigates, and the extension executes the sequence.

## Troubleshooting / Limitations

*   **Site Blocking:** Some websites may block the rapid page reloads from the right-click method (`429` errors). Manual URL crafting is necessary for such sites.
*   **Dynamic Elements:** The extension tries its best, but highly dynamic sites or elements within Shadow DOM / iframes may require manual crafting with robust selectors (`aria-label`, `data-testid`, stable IDs) found via DevTools. The automatic identification priority is: `aria-label` > stable `id` > `data-testid` > `data-cy`/`data-cypress` > `data-qa`/`data-qa-id` > `name` > `placeholder` > `data-component`/`data-element`/`data-target`/`data-action` > stable `class` combination.
*   **`pressEnter` Compatibility:** Highly variable depending on site implementation.
*   **Right-Click Target:** Uses `element.closest()` to find interactive elements near the click. Manual crafting provides ultimate precision.
*   **State Loss (Right-Click Method):** Each step reloads the page, losing temporary state.

## Codebase Structure

.
├── background.js         # Service worker (main logic, event handling, context menus, reload)
├── content.js            # Content script (parameter parsing, sequential execution, DOM interaction)
├── listener.js           # Content script (minimal listener for right-clicks)
├── manifest.json         # Extension configuration and permissions
├── popup.css             # Styles for the popup
├── popup.html            # HTML structure for the popup
├── popup.js              # Logic for the allowlist management popup
├── README.md             # This file (GitHub version)
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png

## License

This project is licensed under the MIT License.

MIT License

Copyright (c) 2025 Corey Burns

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

