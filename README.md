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
    *   ARIA Label (Recommended for dynamic sites)
    *   Element ID
    *   CSS Class combinations
*   **User-Managed Allowlist:** Extension only runs on sites you approve.
*   **Right-Click URL Builder:** Incrementally build the action sequence URL by right-clicking elements on allowed pages (Note: This method reloads the page after each step).
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
3.  **Right-click** on the first element you want to interact with (e.g., a search input field).
4.  Choose the appropriate action from the context menu:
    *   **"Add to Injector: Set Value (search-text-here)"**: Select this for input fields, textareas, etc. where you want to inject text later. It will add a parameter like `elementId=search-text-here` or `css:[aria-label...]=search-text-here` to the URL.
    *   **"Add to Injector: Click Element"**: Select this for buttons, links, etc. It will add a parameter like `elementId=click` or `css:.selector=click`.
5.  The extension will try to identify the element using `aria-label`, then ID, then CSS classes.
6.  The page will **reload** with the new parameter added to the URL in the address bar.
7.  **Repeat steps 3-6** for each subsequent element you want to interact with (e.g., right-click the submit button after adding the input parameter). The parameters will be added sequentially to the URL in the address bar.
8.  Once you have added all the steps, **manually copy the final URL** from your address bar. This is the URL you will use (see Step 3 below).

*(Note: If the right-click method fails to identify an element, you may receive an alert, or it might silently fail. In these cases, you'll need to use the Manual URL Crafting method below.)*

#### Method B: Manual URL Crafting (Advanced / More Control)

You can construct the URL manually, giving you precise control over selectors and actions. This is useful if the right-click method fails or if you prefer using specific CSS selectors found via DevTools (`F12` -> Inspect Element).

1.  Start with the base URL of the allowlisted site (e.g., `https://www.example.com/`).
2.  Add a `?` to start the query parameters.
3.  Add parameters in the format `key=value`, separated by `&`. The **order matters** - actions execute sequentially.
4.  **Parameter Key Types:**
    *   **Element ID:** Use the element's `id` directly as the key.
        *   `https://www.example.com/?search-input=search-text-here`
        *   `https://www.example.com/?submit-button=click`
    *   **CSS Selector:** Use the prefix `css:` followed by a valid CSS selector. This is powerful for targeting elements without stable IDs or using attributes like `aria-label`.
        *   *ARIA Label:* `css:[aria-label="Label Text"]=search-text-here` (Quotes inside the label value might need care, but often work).
        *   *Class:* `css:.some-class.another-class=click`
        *   *Attribute:* `css:[data-testid="main-search"]=search-text-here`
        *   *Partial ID:* `css:[id^="dynamic-prefix-"]=click` (Targets ID starting with "dynamic-prefix-")
    *   **Wait Action:** Introduce a pause. The key is `wait`. The value specifies duration (case-insensitive).
        *   `wait=500ms` (Wait 500 milliseconds)
        *   `wait=2s` (Wait 2 seconds)
    *   **Press Enter Action:** Simulate pressing the Enter key on the *last element* that had text injected into it. The key is `pressEnter`, the value is typically `true`.
        *   `pressEnter=true`
        *   *(Note: Compatibility for `pressEnter` varies significantly between websites.)*
5.  **Combine Parameters:** Chain actions using `&`.
    *   *Example:* Inject text, wait, then click a button by ID.
        `https://www.example.com/?search-input=search-text-here&wait=500ms&submit-button=click`
    *   *Example:* Click an ARIA-labeled element, inject text into another ARIA-labeled element, then press Enter.
        `https://www.example.com/?css:[aria-label="Category"]=click&css:[aria-label="Keyword Input"]=search-text-here&pressEnter=true`

*(Note: The extension automatically handles necessary URL encoding when appending parameters via right-click or reloading.)*

### 3. Using the Generated URL (e.g., in Chrome Search Engines)

Once you have the final URL (either copied after using right-click or manually crafted):

1.  **Identify the Placeholder:** Locate the `search-text-here` value(s) in your URL. This is where your actual search query or input value will go.
2.  **Go to Chrome Search Engine Settings:**
    *   Navigate to `chrome://settings/searchEngines`.
    *   Click "Add" next to "Site search".
3.  **Configure the Search Engine:**
    *   **Search engine:** Give it a descriptive name (e.g., "Example Site Search").
    *   **Shortcut:** Assign a short keyword you'll type in the address bar (e.g., `exs`).
    *   **URL with %s in place of query:** Paste your **copied/crafted URL** into this field. Then, **carefully replace** the `search-text-here` placeholder with `%s`.
        *   *Example URL:* `https://www.example.com/?search-input=search-text-here&submit-button=click`
        *   *Becomes:* `https://www.example.com/?search-input=%s&submit-button=click`
    *   Click "Add".
4.  **Use It:** Now, in your Chrome address bar, you can type your shortcut (e.g., `exs`), press `Space` or `Tab`, type your search query, and press `Enter`. Chrome will navigate to the constructed URL, and the extension (if the site is allowlisted) will execute the sequence, injecting your query into the correct place.

## Troubleshooting / Limitations

*   **Site Blocking:** Some websites (e.g., Realtor.com, Zillow.com) have strong anti-bot measures that may detect the rapid page reloads used by the right-click method, resulting in errors (`429 Too Many Requests`) or failed page loads. On these sites, you *must* use the Manual URL Crafting method and navigate to the final URL directly.
*   **Dynamic Elements:** The extension tries its best to identify elements using `aria-label`, stable IDs, or unique classes. However, on highly dynamic websites or those using Shadow DOM, the selectors might not be stable or the extension might fail to find the element. Manual crafting using robust selectors found via DevTools is the best approach here.
*   **`pressEnter` Compatibility:** Simulating keyboard events is not always reliable and may not work as expected on all websites due to their specific event handling.
*   **Right-Click Target:** Sometimes right-clicking might target an overlay or container instead of the intended element. Try clicking more precisely on the interactive part. The extension uses `element.closest()` to try and find the nearest relevant element.
*   **State Loss (Right-Click Method):** Remember that each step added via right-click reloads the page, losing any temporary state.

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
