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
*   **Right-Click URL Builder:** Incrementally build the action sequence URL by right-clicking elements on allowed pages. Attempts to find the best stable identifier automatically. (Note: Reloads the page after each step, *prepends* new parameter).
*   **Manual URL Crafting:** Full control for advanced users to write parameters directly.
*   **Sequential Execution:** Parameters are processed in the order they appear in the URL. **Automation parameters should come first.**

## Installation

1.  Download or clone the extension files/repository.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable **"Developer mode"** using the toggle switch (usually in the top right corner).
4.  Click the **"Load unpacked"** button.
5.  Select the directory containing the extension files (`manifest.json`, etc.).
6.  The extension icon should appear in your toolbar.

## How it Works Conceptually

The extension monitors page loads on allowed websites. If the URL contains special query parameters that the extension recognizes, it waits for the page elements specified by those parameters to potentially load. It then attempts to perform the requested actions (injecting text, clicking, waiting, pressing Enter) in the sequence defined by the parameter order. **Crucially, the extension processes parameters from left to right in the URL.**

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

This method lets you build the URL step-by-step directly on the page. **Important Note:** Each step added via right-click will **automatically reload the page** with the new automation parameter added to the **beginning** of the URL's query string. This provides immediate feedback but means:
*   Any state on the page (like filled forms not yet submitted, or dynamically opened menus) will be lost on each reload.
*   Some websites might have security measures that block rapid, automated reloads (like Realtor.com, Zillow.com), causing this method to fail with errors on those sites.

**Steps:**

1.  Ensure the website is **allowlisted**.
2.  Navigate to the base page on the site where you want the actions to start (it can already have its own query parameters).
3.  **Right-click** on or near the first element you want to interact with. The extension uses `.closest()` to find the nearest relevant interactive element.
4.  Choose the appropriate action from the context menu ("Set Value" or "Click Element").
5.  The extension attempts to identify the element uniquely (priority: `aria-label` -> `id` -> `data-testid` -> `data-cy` -> `data-qa` -> `name` -> `placeholder` -> `data-*` -> `class`).
6.  The page will **reload** with the new automation parameter **prepended** to the query string in the address bar.
7.  **Repeat steps 3-6** for each subsequent element. Each new parameter will be added *before* the previous ones and any original site parameters.
8.  Once complete, **manually copy the final URL** from your address bar. The automation parameters should be at the beginning.

*(Note: If the right-click method fails to find a unique, stable identifier, you may receive an alert. Use Manual URL Crafting instead.)*

#### Method B: Manual URL Crafting (Advanced / More Control)

Construct the URL manually for precise control. This is the recommended method for complex sequences or sites sensitive to reloads.

**VERY IMPORTANT:** Place **all** Universal Search Parameter Injector parameters (`css:`, `id`, `wait`, `pressEnter`) at the **beginning** of the query string, *before* any parameters used by the website itself. This prevents delays and ensures correct execution order.

1.  Start with the base URL of the allowlisted site (e.g., `https://www.example.com/`).
2.  Add a `?` to start the query parameters.
3.  **Add ALL your automation parameters first**, separated by `&`.
4.  *Then*, if the site needs its own parameters, add `&` followed by the site's native parameters (e.g., `&sort=price&filter=active`).
5.  **Parameter Key Types (Identifier = value/click):**
    *   **Element ID:** `search-input=search-text-here`, `submit-button=click`
    *   **CSS Selector:** Prefix with `css:`. Most flexible method.
        *   *ARIA Label:* `css:[aria-label="Label Text"]=search-text-here`
        *   *Data Test ID:* `css:[data-testid="main-search"]=search-text-here`
        *   *Other Data Attributes:* `css:[data-cy="submit"]=click`, `css:[data-qa="login-button"]=click`
        *   *Name:* `css:[name="username"]=search-text-here`
        *   *Placeholder:* `css:[placeholder="Address, City..."]=search-text-here`
        *   *Class:* `css:.order-button.primary=click`
        *   *Structure:* `css:form#login > button[type='submit']=click`
        *   *Partial:* `css:[id^="dynamic-prefix-"]=click`

6.  **Special Action Parameters:**
    *   `wait=<duration>` (e.g., `wait=500ms`, `wait=1s`)
    *   `pressEnter=true` (Use after an input injection)
7.  **Combine Parameters (Automation First!):**
    *   *Correct:* `https://example.com/search?search-input=query&submit-btn=click&sort=relevant&filter=new`
    *   *Incorrect (Slow):* `https://example.com/search?sort=relevant&filter=new&search-input=query&submit-btn=click`
    *   *Example with Wait & ARIA:* `https://example.com/products?css:[aria-label="Filters"]=click&wait=1s&css:[aria-label="Color"]=click&category=shoes`

*(Note: Ensure special characters in manually crafted selectors are URL-encoded if needed.)*

### 3. Using the Generated URL (e.g., in Chrome Search Engines)

Once you have the final URL (with automation parameters correctly placed first):

1.  Identify `search-text-here` value(s).
2.  Go to `chrome://settings/searchEngines`, click "Add" site search.
3.  Configure:
    *   **Search engine:** Name (e.g., "Arive Rule Search").
    *   **Shortcut:** Keyword (e.g., `ars`).
    *   **URL with %s...:** Paste your URL. Replace `search-text-here` with `%s`.
        *   *Example:* `https://umortgage.myarive.com/app/settings/automation-rules?css:[placeholder="Search Rule Name or ID"]=search-text-here&pressEnter=true`
        *   *Becomes:* `https://umortgage.myarive.com/app/settings/automation-rules?css:[placeholder="Search Rule Name or ID"]=%s&pressEnter=true`
    *   Click "Add".
4.  Use: Type shortcut (`ars`), space/tab, query, Enter.

## Troubleshooting / Limitations

*   **Parameter Order is Crucial:** Automation parameters **must** come before native site parameters in the URL for reliable and fast execution.
*   **Site Blocking:** Some sites may block the rapid reloads from the right-click method. Use manual crafting.
*   **Dynamic Elements:** Manual crafting using robust selectors (`aria-label`, `data-testid`, stable IDs) found via DevTools is recommended for complex sites.
*   **`pressEnter` Compatibility:** Highly variable.
*   **Right-Click Target:** Uses `element.closest()`. Manual crafting offers precision.
*   **State Loss (Right-Click Method):** Each step reloads the page.

## Codebase Structure

```text
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
