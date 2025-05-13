// popup.js V3.3 - Corrected Allowlist, Start Cue, New Add Wait UI

// --- Allowlist Constants & Elements ---
const ALLOWLIST_STORAGE_KEY = 'allowedBaseUrls';
const allowlistUrlInput = document.getElementById('new-url-input');
const addAllowlistUrlButton = document.getElementById('add-url-button');
const addCurrentSiteToAllowlistButton = document.getElementById('add-current-site-button');
const allowlistUrlListElement = document.getElementById('url-list');

// --- Sequence Builder Constants & Elements ---
const SEQUENCE_STORAGE_KEY_PREFIX = 'uspi_sequence_tab_';
const sequenceListElement = document.getElementById('sequence-list');
const addWaitStepButton = document.getElementById('add-wait-step-button');
const addEnterStepButton = document.getElementById('add-enter-step-button');
const applySequenceButton = document.getElementById('apply-sequence-button');
const copySequenceUrlButton = document.getElementById('copy-sequence-url-button');
const clearSequenceButton = document.getElementById('clear-sequence-button');
const generatedUrlOutput = document.getElementById('generated-url-output');
const generatedUrlContainer = document.getElementById('generated-url-container');
// New DOM elements for Add Wait Form
const addWaitFormContainer = document.getElementById('add-wait-form-container');
const waitDurationInput = document.getElementById('wait-duration-input');
const waitUnitSelect = document.getElementById('wait-unit-select');
const confirmAddWaitButton = document.getElementById('confirm-add-wait-button');
const cancelAddWaitButton = document.getElementById('cancel-add-wait-button');

// --- General Elements ---
const statusMessageElement = document.getElementById('status-message');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

let currentTabId = null;
let currentTabUrlForSequence = null;

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
        // Hide add wait form if open
        addWaitFormContainer.style.display = 'none';

        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
        displayStatus("", false, 0);
        if (button.dataset.tab === "sequence-builder-tab") {
            loadSequenceForCurrentTab();
        } else if (button.dataset.tab === "allowlist-tab") {
            loadAllowlistUrls();
        }
    });
});

// --- Allowlist Logic (Stable version from V3.1 baseline) ---
function renderUrlList(urls) {
    allowlistUrlListElement.innerHTML = '';
    if (!Array.isArray(urls) || urls.length === 0) {
        const li = document.createElement('li'); li.textContent = 'No URLs added yet.';
        li.style.textAlign = 'center'; li.style.color = '#777';
        allowlistUrlListElement.appendChild(li); return;
    }
    urls.forEach(url => {
        const li = document.createElement('li'); const span = document.createElement('span');
        span.className = 'url-text'; span.textContent = url; span.title = url;
        const btn = document.createElement('button'); btn.textContent = 'Remove';
        btn.className = 'remove-btn'; btn.dataset.url = url;
        li.appendChild(span); li.appendChild(btn); allowlistUrlListElement.appendChild(li);
    });
}

async function loadAllowlistUrls() {
    try {
        const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] });
        const urls = data[ALLOWLIST_STORAGE_KEY];
        if (Array.isArray(urls)) { renderUrlList(urls); }
        else { console.error("USPI: Allowlist data not array:", urls); renderUrlList([]); await chrome.storage.sync.set({ [ALLOWLIST_STORAGE_KEY]: [] }); }
    } catch (e) { console.error("USPI: Error loading allowlist:", e); displayStatus("Error loading allowlist.", true, 0); renderUrlList([]); }
}

async function removeAllowlistUrl(urlToRemove) {
    if (!urlToRemove) return; displayStatus('', false);
    try {
        const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] });
        let urls = data[ALLOWLIST_STORAGE_KEY]; if (!Array.isArray(urls)) { urls = []; }
        const initialLength = urls.length; const updatedUrls = urls.filter(url => url !== urlToRemove);
        if (updatedUrls.length < initialLength) {
            await chrome.storage.sync.set({ [ALLOWLIST_STORAGE_KEY]: updatedUrls });
            renderUrlList(updatedUrls); displayStatus(`URL "${urlToRemove}" removed.`, false);
        }
    } catch (e) { console.error("USPI: Error removing allowlist URL:", e); displayStatus("Error removing URL.", true); }
}

async function addAllowlistUrl(urlToAdd) {
    displayStatus('', false); let newUrl = urlToAdd.trim();
    if (!newUrl) { displayStatus("URL cannot be empty.", true); return; }
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl;
        if (!newUrl.includes('.')) { displayStatus("Invalid URL format.", true); return; }
    }
    try { const urlObject = new URL(newUrl); newUrl = `${urlObject.origin}/`; }
    catch (e) { displayStatus("Invalid URL format.", true); return; }

    try {
        const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] });
        let urls = data[ALLOWLIST_STORAGE_KEY]; if (!Array.isArray(urls)) { urls = []; }
        if (urls.includes(newUrl)) { displayStatus(`URL "${newUrl}" already in list.`, false, 2000); return; }
        urls.push(newUrl); urls.sort();
        await chrome.storage.sync.set({ [ALLOWLIST_STORAGE_KEY]: urls });
        renderUrlList(urls); allowlistUrlInput.value = '';
        displayStatus(`URL "${newUrl}" added.`, false);
    } catch (e) { console.error("USPI: Error adding allowlist URL:", e); displayStatus("Error saving URL.", true); }
}

async function handleAddCurrentSiteToAllowlist() {
    displayStatus('', false);
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            const tab = tabs[0];
            if (tab.url && tab.url.startsWith('http')) {
                const urlObject = new URL(tab.url); addAllowlistUrl(`${urlObject.origin}/`);
            } else { displayStatus("Current site has invalid URL.", true); }
        } else { displayStatus("Cannot get current tab.", true); }
    } catch (e) { console.error("USPI: Error adding current site:", e); displayStatus("Error getting current tab URL.", true); }
}

// --- Sequence Builder Logic ---
function getSequenceStorageKey(tabId) { return `${SEQUENCE_STORAGE_KEY_PREFIX}${tabId}`; }

async function loadSequenceForCurrentTab() {
    addWaitFormContainer.style.display = 'none'; // Ensure wait form is hidden
    if (!currentTabId) { renderSequence([]); sequenceListElement.innerHTML = '<li class="no-steps">Activate a web page tab to build its sequence.</li>'; return; }
    const key = getSequenceStorageKey(currentTabId);
    try { const data = await chrome.storage.local.get({ [key]: [] }); renderSequence(data[key] || []); }
    catch (e) { console.error("USPI: Error loading sequence:", e); displayStatus("Error loading sequence.", true); renderSequence([]);}
}

async function saveSequenceForCurrentTab(sequence) {
    if (!currentTabId) return;
    const key = getSequenceStorageKey(currentTabId);
    try { await chrome.storage.local.set({ [key]: sequence }); renderSequence(sequence); }
    catch (e) { console.error("USPI: Error saving sequence:", e); displayStatus("Error saving sequence.", true); }
}

function renderSequence(sequence) {
    sequenceListElement.innerHTML = '';
    generatedUrlContainer.style.display = 'none'; generatedUrlOutput.value = '';
    if (!Array.isArray(sequence) || sequence.length === 0) { sequenceListElement.innerHTML = '<li class="no-steps">No steps yet. Right-click &rarr; "Add to Sequence..."</li>'; return; }

    sequence.forEach((step, index) => {
        const li = document.createElement('li'); li.dataset.index = index;
        const mainLineDiv = document.createElement('div'); mainLineDiv.className = 'step-main-line';

        const stepNumberSpan = document.createElement('span'); stepNumberSpan.className = 'step-number';
        let numberText = `${index + 1}. `;
        if (index === 0) { numberText = `1. (Start) `; } // Add "(Start)" to the first item
        stepNumberSpan.textContent = numberText;
        mainLineDiv.appendChild(stepNumberSpan);

        const descSpan = document.createElement('span'); descSpan.className = 'step-description';
        let displayText = step.description || 'Step details missing';
        if (step.actionType === 'inject') {
            if (step.elementType === 'SELECT') {
                displayText = `Select option in ${step.description || step.fullIdentifier}`;
                if (step.optionsFetched && step.value !== undefined && step.value !== '') { const selectedOpt = (step.selectOptions || []).find(opt => opt.value === step.value); displayText = `Select "${selectedOpt ? (selectedOpt.text.length > 20 ? selectedOpt.text.substring(0,17)+'...' : selectedOpt.text) : step.value}" in ${step.description || step.fullIdentifier}`;
                } else if (!step.optionsFetched) { displayText = `Set value for SELECT ${step.description || step.fullIdentifier} (loading...)`; }
            } else { displayText = `Inject "${step.value}" into ${step.description || step.fullIdentifier}`; }
        } else if (step.actionType === 'click') { displayText = `Click ${step.description || step.fullIdentifier}`;
        } else if (step.command === 'wait') { displayText = `Wait for ${step.value}`;
        } else if (step.command === 'pressEnter') { displayText = `Press Enter`; }
        descSpan.textContent = displayText; descSpan.title = `Full ID: ${step.fullIdentifier || 'N/A'}\nAction: ${step.actionType || step.command}\nValue: ${step.value}`;
        mainLineDiv.appendChild(descSpan);

        const actionsDiv = document.createElement('div'); actionsDiv.className = 'step-actions';
        const upBtn = document.createElement('button'); upBtn.innerHTML = '&#x25B2;'; upBtn.title = "Move up"; upBtn.disabled = (index === 0);
        upBtn.addEventListener('click', async (e) => { e.stopPropagation(); if (index > 0) { const item = sequence.splice(index, 1)[0]; sequence.splice(index - 1, 0, item); await saveSequenceForCurrentTab(sequence); } });
        actionsDiv.appendChild(upBtn);
        const downBtn = document.createElement('button'); downBtn.innerHTML = '&#x25BC;'; downBtn.title = "Move down"; downBtn.disabled = (index === sequence.length - 1);
        downBtn.addEventListener('click', async (e) => { e.stopPropagation(); if (index < sequence.length - 1) { const item = sequence.splice(index, 1)[0]; sequence.splice(index + 1, 0, item); await saveSequenceForCurrentTab(sequence); } });
        actionsDiv.appendChild(downBtn);
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '&#x2715;'; deleteBtn.className = 'delete-step-btn'; deleteBtn.title = "Delete";
        deleteBtn.addEventListener('click', async (e) => { e.stopPropagation(); sequence.splice(index, 1); await saveSequenceForCurrentTab(sequence); });
        actionsDiv.appendChild(deleteBtn); mainLineDiv.appendChild(actionsDiv); li.appendChild(mainLineDiv);
        if (step.elementType === 'SELECT' && step.actionType === 'inject') { const selCont = document.createElement('div'); selCont.className = 'step-select-container'; if (!step.optionsFetched) { selCont.textContent = 'Fetching options...'; } else { createSelectWithOptionsUI(selCont, step, index, sequence); } li.appendChild(selCont); }
        sequenceListElement.appendChild(li);
    });
}

function createSelectWithOptionsUI(container, step, index, sequence) {
    container.innerHTML = ''; const selectEl = document.createElement('select'); selectEl.className = 'step-option-select'; let foundSelected = false;
    if (step.selectOptions && step.selectOptions.length > 0) {
        step.selectOptions.forEach(opt => { const optionEl = document.createElement('option'); optionEl.value = opt.value; optionEl.textContent = opt.text.length > 40 ? opt.text.substring(0, 37) + '...' : opt.text; optionEl.title = opt.text; if (opt.value === step.value) { optionEl.selected = true; foundSelected = true; } selectEl.appendChild(optionEl); });
        if (!foundSelected && step.selectOptions.length > 0 && (step.value === undefined || step.value === '')) { selectEl.selectedIndex = 0; if(sequence[index]) sequence[index].value = step.selectOptions[0].value; }
    } else { const optionEl = document.createElement('option'); optionEl.value = ""; optionEl.textContent = "No options available"; selectEl.appendChild(optionEl); }
    selectEl.addEventListener('change', async (e) => { if(sequence[index]) sequence[index].value = e.target.value; await saveSequenceForCurrentTab(sequence); }); container.appendChild(selectEl);
}

async function handleNewStep(newStepDataFromBg) {
    if (!currentTabId) { displayStatus("No active tab for sequence.", true); return; }
    const key = getSequenceStorageKey(currentTabId);
    const data = await chrome.storage.local.get({ [key]: [] });
    let sequence = data[key] || []; const stepToAdd = { ...newStepDataFromBg };

    if (stepToAdd.elementType === 'SELECT' && stepToAdd.actionType === 'inject') {
        stepToAdd.optionsFetched = false; stepToAdd.selectOptions = [];
        sequence.push(stepToAdd); await saveSequenceForCurrentTab(sequence);
        displayStatus(`Fetching options for SELECT...`, false, 0);
        chrome.runtime.sendMessage( { action: "getSelectOptions", tabId: currentTabId, selectIdentifier: stepToAdd.fullIdentifier }, async (response) => {
            const currentSequenceData = await chrome.storage.local.get(getSequenceStorageKey(currentTabId)); let currentSeq = currentSequenceData[getSequenceStorageKey(currentTabId)] || [];
            const stepIndex = currentSeq.findIndex(s => s.fullIdentifier === stepToAdd.fullIdentifier && s.elementType === 'SELECT' && !s.optionsFetched); // Find by fullIdentifier & not fetched
            if (stepIndex > -1) {
                if (response && response.status === "success") {
                    currentSeq[stepIndex].selectOptions = response.options || []; currentSeq[stepIndex].optionsFetched = true;
                    if (!currentSeq[stepIndex].value && response.options && response.options.length > 0) { currentSeq[stepIndex].value = response.options[0].value; }
                    displayStatus("Options loaded. Please select one.", false, 3000);
                } else { displayStatus(`Failed to fetch options: ${response?.message || 'Error'}`, true); currentSeq[stepIndex].optionsFetched = true; currentSeq[stepIndex].selectOptions = [{text: "Error loading options", value:""}]; }
                await saveSequenceForCurrentTab(currentSeq);
            } else { console.warn("USPI: Provisional SELECT step not found in sequence to update options."); displayStatus("Error updating options for step.", true); }
        });
    } else { sequence.push(stepToAdd); await saveSequenceForCurrentTab(sequence); displayStatus("Step added to sequence.", false, 1500); }
}

addWaitStepButton.addEventListener('click', () => {
    addWaitFormContainer.style.display = 'flex';
    waitDurationInput.value = "1"; waitUnitSelect.value = "s"; waitDurationInput.focus();
});
confirmAddWaitButton.addEventListener('click', () => {
    const duration = parseInt(waitDurationInput.value, 10); const unit = waitUnitSelect.value;
    if (isNaN(duration) || duration <= 0) { displayStatus("Enter valid positive duration.", true); return; }
    const waitValue = `${duration}${unit}`;
    handleNewStep({ fullIdentifier: 'wait', identifierType: 'special', elementType: 'SPECIAL_COMMAND', actionType: 'special', command: 'wait', value: waitValue, description: `Wait ${waitValue}` });
    addWaitFormContainer.style.display = 'none';
});
cancelAddWaitButton.addEventListener('click', () => { addWaitFormContainer.style.display = 'none'; });

addEnterStepButton.addEventListener('click', () => handleNewStep({ fullIdentifier: 'pressEnter', identifierType: 'special', elementType: 'SPECIAL_COMMAND', actionType: 'special', command: 'pressEnter', value: 'true', description: `Press Enter Key` }));
applySequenceButton.addEventListener('click', async () => { /* ... (same as V3.2 logic) ... */
    if (!currentTabId || !currentTabUrlForSequence) { displayStatus("No active tab.", true); return; } const key = getSequenceStorageKey(currentTabId); const data = await chrome.storage.local.get({ [key]: [] }); const sequence = data[key] || []; if (sequence.length === 0) { displayStatus("Sequence empty.", true); return; } chrome.runtime.sendMessage({ action: "buildAndReload", tabId: currentTabId, baseUrl: currentTabUrlForSequence, sequence: sequence }, (response) => { if (chrome.runtime.lastError) { displayStatus(`Error: ${chrome.runtime.lastError.message}`, true); } else if (response && response.status === "success") { displayStatus("Page reloading...", false); window.close(); } else { displayStatus(`Failed to apply: ${response?.message || 'Unknown'}`, true); } });
});
copySequenceUrlButton.addEventListener('click', async () => { /* ... (same as V3.2 logic) ... */
    if (!currentTabUrlForSequence) { displayStatus("No active tab for URL.", true); return; } const key = getSequenceStorageKey(currentTabId); const data = await chrome.storage.local.get({ [key]: [] }); const sequence = data[key] || []; if (sequence.length === 0) { displayStatus("Sequence empty.", false); return; } let params = sequence.map(step => { let pk = step.command === 'wait' ? 'wait' : (step.command === 'pressEnter' ? 'pressEnter' : step.fullIdentifier); return `${encodeURIComponent(pk)}=${encodeURIComponent(step.value)}`; }).join('&'); const finalUrl = `${currentTabUrlForSequence}${currentTabUrlForSequence.includes('?') ? (params ? '&' : '') : (params ? '?' : '')}${params}`; generatedUrlOutput.value = finalUrl; generatedUrlContainer.style.display = 'block'; try { await navigator.clipboard.writeText(finalUrl); displayStatus("Full URL copied!", false); } catch (err) { displayStatus("Failed to copy.", true); console.error(err); }
});
clearSequenceButton.addEventListener('click', async () => { if (!currentTabId) return; if (confirm("Clear sequence for this tab?")) { await saveSequenceForCurrentTab([]); displayStatus("Sequence cleared.", false); } });

async function initializePopup() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            currentTabId = tabs[0].id;
            if (tabs[0].url && tabs[0].url.startsWith('http')) {
                 const urlObj = new URL(tabs[0].url);
                 currentTabUrlForSequence = `${urlObj.origin}${urlObj.pathname}`; // Base URL for sequence
            } else { currentTabUrlForSequence = null; }

            const storageKeyForNewStep = 'uspi_new_step_for_tab_' + currentTabId;
            const data = await chrome.storage.local.get(storageKeyForNewStep);
            const newStepDataFromBg = data[storageKeyForNewStep];

            if (newStepDataFromBg && newStepDataFromBg.step) {
                document.querySelector('.tab-button[data-tab="sequence-builder-tab"]').click(); // Activate sequence tab
                await handleNewStep(newStepDataFromBg.step);
                await chrome.storage.local.remove(storageKeyForNewStep); // Clean up temp storage
            } else {
                // Default to allowlist if not adding a step, but ensure sequence for current tab is loaded.
                await loadSequenceForCurrentTab();
                if (!document.querySelector('.tab-button[data-tab="sequence-builder-tab"]').classList.contains('active')){
                    document.querySelector('.tab-button[data-tab="allowlist-tab"]').click();
                }
            }
        } else {
             sequenceListElement.innerHTML = '<li class="no-steps">No active web page found.</li>';
             document.querySelector('.tab-button[data-tab="sequence-builder-tab"]').disabled = true;
        }
    } catch (e) { console.error("USPI: Error initializing popup:", e); displayStatus("Popup initialization error.", true, 0); }
    loadAllowlistUrls(); // Always load allowlist
}

addAllowlistUrlButton.addEventListener('click', () => addAllowlistUrl(allowlistUrlInput.value));
allowlistUrlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addAllowlistUrl(allowlistUrlInput.value); });
addCurrentSiteToAllowlistButton.addEventListener('click', handleAddCurrentSiteToAllowlist);
allowlistUrlListElement.addEventListener('click', (e) => { if (e.target.classList.contains('remove-btn')) removeAllowlistUrl(e.target.dataset.url); });

document.addEventListener('DOMContentLoaded', initializePopup);