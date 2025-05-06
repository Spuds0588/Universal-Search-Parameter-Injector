// popup.js V3 - Tabbed UI with Sequence Builder

// --- Allowlist Constants & Elements ---
const ALLOWLIST_STORAGE_KEY = 'allowedBaseUrls';
const urlInput = document.getElementById('new-url-input');
const addButton = document.getElementById('add-url-button');
const addCurrentSiteButton = document.getElementById('add-current-site-button');
const urlListElement = document.getElementById('url-list');

// --- Sequence Builder Constants & Elements ---
const SEQUENCE_STORAGE_KEY_PREFIX = 'uspi_sequence_tab_'; // Key by tab ID
const sequenceListElement = document.getElementById('sequence-list');
const addWaitStepButton = document.getElementById('add-wait-step-button');
const addEnterStepButton = document.getElementById('add-enter-step-button');
const applySequenceButton = document.getElementById('apply-sequence-button');
const copySequenceUrlButton = document.getElementById('copy-sequence-url-button');
const clearSequenceButton = document.getElementById('clear-sequence-button');
const generatedUrlOutput = document.getElementById('generated-url-output');
const generatedUrlContainer = document.getElementById('generated-url-container');

// --- General Elements ---
const statusMessageElement = document.getElementById('status-message');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

let currentTabId = null; // To store the active tab ID for sequence operations
let currentTabUrl = null; // To store the active tab's base URL for sequence operations

// --- General Helper: Display Status Message ---
function displayStatus(message, isError = false, duration = 3000) {
    statusMessageElement.textContent = message;
    statusMessageElement.className = isError ? 'error' : 'success';
    if (duration > 0) {
        setTimeout(() => {
            if (statusMessageElement.textContent === message) {
                statusMessageElement.textContent = ''; statusMessageElement.className = '';
            }
        }, duration);
    }
}

// --- Tab Switching Logic ---
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
        displayStatus("", false, 0); // Clear status on tab switch
        // If switching to sequence builder, refresh its content
        if (button.dataset.tab === "sequence-builder-tab") {
            loadSequenceForCurrentTab();
        }
    });
});

// --- Allowlist Logic (Mostly from previous version) ---
function renderUrlList(urls) { /* ... same as v2.x ... */
    urlListElement.innerHTML = ''; if (!urls || urls.length === 0) { const li = document.createElement('li'); li.textContent = 'No URLs added yet.'; li.style.textAlign = 'center'; li.style.color = '#777'; urlListElement.appendChild(li); return; }
    urls.forEach(url => { const li = document.createElement('li'); const span = document.createElement('span'); span.className = 'url-text'; span.textContent = url; span.title = url; const btn = document.createElement('button'); btn.textContent = 'Remove'; btn.className = 'remove-btn'; btn.dataset.url = url; li.appendChild(span); li.appendChild(btn); urlListElement.appendChild(li); });
}
async function loadAllowlistUrls() { /* ... same as v2.x loadUrls ... */
    try { const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] }); const urls = data[ALLOWLIST_STORAGE_KEY]; if (Array.isArray(urls)) { renderUrlList(urls); } else { renderUrlList([]); } } catch (e) { displayStatus("Error loading allowlist.", true, 0); renderUrlList([]); }
}
async function removeAllowlistUrl(urlToRemove) { /* ... same as v2.x removeUrl ... */
    if (!urlToRemove) return; displayStatus('', false); try { const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] }); let urls = data[ALLOWLIST_STORAGE_KEY]; if (!Array.isArray(urls)) urls = []; const initialLength = urls.length; const updatedUrls = urls.filter(url => url !== urlToRemove); if (updatedUrls.length < initialLength) { await chrome.storage.sync.set({ [ALLOWLIST_STORAGE_KEY]: updatedUrls }); renderUrlList(updatedUrls); displayStatus(`URL "${urlToRemove}" removed.`, false); } } catch (e) { displayStatus("Error removing URL.", true); }
}
async function addAllowlistUrl(urlToAdd) { /* ... same as v2.x addUrl, normalized for base URL ... */
    displayStatus('', false); let newUrl = urlToAdd.trim(); if (!newUrl) { displayStatus("URL empty.", true); return; }
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) { newUrl = 'https://' + newUrl; if (!newUrl.includes('.')) { displayStatus("Invalid URL.", true); return; } /* displayStatus(`Prepended "https://". Add if correct: ${newUrl}`, false, 5000); urlInput.value = newUrl; return; */ }
    try { const urlObject = new URL(newUrl); newUrl = `${urlObject.origin}/`; } catch (e) { displayStatus("Invalid URL format.", true); return; }
    try { const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] }); let urls = data[ALLOWLIST_STORAGE_KEY]; if (!Array.isArray(urls)) urls = []; if (urls.includes(newUrl)) { displayStatus(`URL "${newUrl}" already exists.`, true); return; } urls.push(newUrl); urls.sort(); await chrome.storage.sync.set({ [ALLOWLIST_STORAGE_KEY]: urls }); renderUrlList(urls); urlInput.value = ''; displayStatus(`URL "${newUrl}" added.`, false); } catch (e) { displayStatus("Error saving URL.", true); }
}
async function handleAddCurrentSiteToAllowlist() { /* ... same as v2.x handleAddCurrentSite ... */
    displayStatus('', false); try { const tabs = await chrome.tabs.query({ active: true, currentWindow: true }); if (tabs && tabs.length > 0) { const tab = tabs[0]; if (tab.url && tab.url.startsWith('http')) { const urlObject = new URL(tab.url); addAllowlistUrl(`${urlObject.origin}/`); } else { displayStatus("Invalid site URL.", true); } } else { displayStatus("Cannot get tab.", true); } } catch (e) { displayStatus("Error getting tab URL.", true); }
}


// --- Sequence Builder Logic ---
function getSequenceStorageKey(tabId) {
    return `${SEQUENCE_STORAGE_KEY_PREFIX}${tabId}`;
}

async function loadSequenceForCurrentTab() {
    if (!currentTabId) {
        renderSequence([]); // Or show a message like "No active tab for sequence"
        sequenceListElement.innerHTML = '<li class="no-steps">Activate a tab to build its sequence.</li>';
        return;
    }
    const key = getSequenceStorageKey(currentTabId);
    // Using chrome.storage.local for sequence as it might be larger and session is better
    const data = await chrome.storage.local.get({ [key]: [] });
    renderSequence(data[key] || []);
}

async function saveSequenceForCurrentTab(sequence) {
    if (!currentTabId) return;
    const key = getSequenceStorageKey(currentTabId);
    await chrome.storage.local.set({ [key]: sequence });
    renderSequence(sequence); // Re-render after saving
}

function renderSequence(sequence) {
    sequenceListElement.innerHTML = '';
    generatedUrlContainer.style.display = 'none'; // Hide generated URL by default
    generatedUrlOutput.value = '';

    if (!sequence || sequence.length === 0) {
        sequenceListElement.innerHTML = '<li class="no-steps">No steps yet. Right-click on an allowed page element and choose "Add to Sequence..."</li>';
        return;
    }

    sequence.forEach((step, index) => {
        const li = document.createElement('li');
        li.dataset.index = index; // For drag/drop or reordering later if implemented

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '☰'; // Simple drag handle, no actual drag yet
        // li.appendChild(handle); // Add if/when drag implemented

        const desc = document.createElement('span');
        desc.className = 'step-description';
        if (step.type === 'inject') {
            desc.textContent = `Inject "${step.value}" into ${step.identifier}`;
        } else if (step.type === 'click') {
            desc.textContent = `Click ${step.identifier}`;
        } else if (step.type === 'wait') {
            desc.textContent = `Wait for ${step.value}`;
        } else if (step.type === 'pressEnter') {
            desc.textContent = `Press Enter`;
        }
        li.appendChild(desc);

        const actions = document.createElement('div');
        actions.className = 'step-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '✕'; // '✖' or '🗑️'
        deleteBtn.title = "Delete step";
        deleteBtn.addEventListener('click', async () => {
            sequence.splice(index, 1);
            await saveSequenceForCurrentTab(sequence);
        });
        actions.appendChild(deleteBtn);
        li.appendChild(actions);

        sequenceListElement.appendChild(li);
    });
}

async function addStepToSequence(step) {
    if (!currentTabId) {
        displayStatus("No active tab to add sequence step.", true);
        return;
    }
    const key = getSequenceStorageKey(currentTabId);
    const data = await chrome.storage.local.get({ [key]: [] });
    const sequence = data[key] || [];
    sequence.push(step);
    await saveSequenceForCurrentTab(sequence);
    displayStatus("Step added to sequence.", false, 1500);
}

// Handlers for adding special steps
addWaitStepButton.addEventListener('click', () => {
    const duration = prompt("Enter wait duration (e.g., 500ms, 2s):", "1s");
    if (duration) { // Basic validation could be added here
        addStepToSequence({ type: 'special', command: 'wait', value: duration, identifier: 'wait' }); // Identifier is 'wait' for sorting
    }
});

addEnterStepButton.addEventListener('click', () => {
    addStepToSequence({ type: 'special', command: 'pressEnter', value: 'true', identifier: 'pressEnter' });
});

// Handler for Applying Sequence
applySequenceButton.addEventListener('click', async () => {
    if (!currentTabId || !currentTabUrl) {
        displayStatus("Cannot apply: No active tab context.", true); return;
    }
    const key = getSequenceStorageKey(currentTabId);
    const data = await chrome.storage.local.get({ [key]: [] });
    const sequence = data[key] || [];

    if (sequence.length === 0) {
        displayStatus("Sequence is empty.", true); return;
    }

    // Send sequence to background script to build URL and reload
    chrome.runtime.sendMessage(
        {
            action: "buildAndReload",
            tabId: currentTabId,
            baseUrl: currentTabUrl, // Send base URL of the current tab
            sequence: sequence
        },
        (response) => {
            if (chrome.runtime.lastError) {
                displayStatus(`Error: ${chrome.runtime.lastError.message}`, true);
            } else if (response && response.status === "success") {
                displayStatus("Page reloading with sequence...", false);
                // Optionally close popup: window.close();
            } else {
                displayStatus("Failed to apply sequence.", true);
            }
        }
    );
});

// Handler for Copying URL
copySequenceUrlButton.addEventListener('click', async () => {
    if (!currentTabUrl) { displayStatus("No active tab context.", true); return; }
    const key = getSequenceStorageKey(currentTabId);
    const data = await chrome.storage.local.get({ [key]: [] });
    const sequence = data[key] || [];
    if (sequence.length === 0) { displayStatus("Sequence empty, nothing to copy.", false); return; }

    let params = sequence.map(step => {
        let key = step.identifier;
        if (step.type !== 'id' && step.type !== 'special') key = `css:${key}`; // Assume css if not id or special
        if (step.command === 'wait') key = 'wait';
        if (step.command === 'pressEnter') key = 'pressEnter';
        return `${encodeURIComponent(key)}=${encodeURIComponent(step.value)}`;
    }).join('&');

    const finalUrl = `${currentTabUrl}${currentTabUrl.includes('?') ? '&' : '?'}${params}`;
    generatedUrlOutput.value = finalUrl;
    generatedUrlContainer.style.display = 'block';
    try {
        await navigator.clipboard.writeText(finalUrl);
        displayStatus("Full URL copied to clipboard!", false);
    } catch (err) {
        displayStatus("Failed to copy URL. See console.", true);
        console.error("Clipboard copy failed:", err);
    }
});


// Handler for Clearing Sequence
clearSequenceButton.addEventListener('click', async () => {
    if (!currentTabId) return;
    if (confirm("Are you sure you want to clear the sequence for this tab?")) {
        await saveSequenceForCurrentTab([]);
        displayStatus("Sequence cleared.", false);
    }
});


// --- Initialization ---
async function initializePopup() {
    // Get current tab info to key sequence storage
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            currentTabId = tabs[0].id;
            // Try to get a base URL for currentTabUrl
            if (tabs[0].url && tabs[0].url.startsWith('http')) {
                 const urlObj = new URL(tabs[0].url);
                 currentTabUrl = `${urlObj.origin}${urlObj.pathname}`; // Base URL without query/hash
            } else {
                 currentTabUrl = null; // Not an http page
            }

            // Check if opened by background script for sequence building
            const storageData = await chrome.storage.local.get('uspi_new_step_for_tab_' + currentTabId);
            const newStepData = storageData['uspi_new_step_for_tab_' + currentTabId];

            if (newStepData) {
                document.querySelector('.tab-button[data-tab="sequence-builder-tab"]').click(); // Switch to sequence builder
                await addStepToSequence(newStepData.step);
                await chrome.storage.local.remove('uspi_new_step_for_tab_' + currentTabId); // Clear the pending step
            } else {
                loadSequenceForCurrentTab(); // Load sequence if not adding a new step
            }
        } else {
            // Handle case where no active tab is found (e.g., popup opened from extensions page)
             sequenceListElement.innerHTML = '<li class="no-steps">No active web page tab found.</li>';
        }
    } catch (e) {
        console.error("Error initializing popup:", e);
        displayStatus("Error initializing popup.", true, 0);
    }
    loadAllowlistUrls(); // Always load allowlist
}

// Event Listeners for Allowlist
addButton.addEventListener('click', () => addAllowlistUrl(urlInput.value));
urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addAllowlistUrl(urlInput.value); });
addCurrentSiteButton.addEventListener('click', handleAddCurrentSiteToAllowlist);
urlListElement.addEventListener('click', (e) => { if (e.target.classList.contains('remove-btn')) removeAllowlistUrl(e.target.dataset.url); });

// Initialize
document.addEventListener('DOMContentLoaded', initializePopup);