// popup.js V3.1 - Fix rendering, Add Select Option Prompting

const ALLOWLIST_STORAGE_KEY = 'allowedBaseUrls';
const allowlistUrlInput = document.getElementById('new-url-input');
const addAllowlistUrlButton = document.getElementById('add-url-button');
const addCurrentSiteToAllowlistButton = document.getElementById('add-current-site-button');
const allowlistUrlListElement = document.getElementById('url-list');

const SEQUENCE_STORAGE_KEY_PREFIX = 'uspi_sequence_tab_';
const sequenceListElement = document.getElementById('sequence-list');
const addWaitStepButton = document.getElementById('add-wait-step-button');
const addEnterStepButton = document.getElementById('add-enter-step-button');
const applySequenceButton = document.getElementById('apply-sequence-button');
const copySequenceUrlButton = document.getElementById('copy-sequence-url-button');
const clearSequenceButton = document.getElementById('clear-sequence-button');
const generatedUrlOutput = document.getElementById('generated-url-output');
const generatedUrlContainer = document.getElementById('generated-url-container');

const statusMessageElement = document.getElementById('status-message');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

let currentTabId = null;
let currentTabUrlForSequence = null; // Base URL of the active tab for sequence URL generation

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

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
        displayStatus("", false, 0);
        if (button.dataset.tab === "sequence-builder-tab") {
            loadSequenceForCurrentTab();
        }
    });
});

function renderUrlList(urls) {
    allowlistUrlListElement.innerHTML = ''; if (!urls || urls.length === 0) { const li = document.createElement('li'); li.textContent = 'No URLs added yet.'; li.style.textAlign = 'center'; li.style.color = '#777'; allowlistUrlListElement.appendChild(li); return; }
    urls.forEach(url => { const li = document.createElement('li'); const span = document.createElement('span'); span.className = 'url-text'; span.textContent = url; span.title = url; const btn = document.createElement('button'); btn.textContent = 'Remove'; btn.className = 'remove-btn'; btn.dataset.url = url; li.appendChild(span); li.appendChild(btn); allowlistUrlListElement.appendChild(li); });
}
async function loadAllowlistUrls() {
    try { const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] }); const urls = data[ALLOWLIST_STORAGE_KEY]; if (Array.isArray(urls)) { renderUrlList(urls); } else { renderUrlList([]); } } catch (e) { console.error("Allowlist load error:", e); displayStatus("Error loading allowlist.", true, 0); renderUrlList([]); }
}
async function removeAllowlistUrl(urlToRemove) {
    if (!urlToRemove) return; displayStatus('', false); try { const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] }); let urls = data[ALLOWLIST_STORAGE_KEY]; if (!Array.isArray(urls)) urls = []; const initialLength = urls.length; const updatedUrls = urls.filter(url => url !== urlToRemove); if (updatedUrls.length < initialLength) { await chrome.storage.sync.set({ [ALLOWLIST_STORAGE_KEY]: updatedUrls }); renderUrlList(updatedUrls); displayStatus(`URL "${urlToRemove}" removed.`, false); } } catch (e) { console.error("Allowlist remove error:", e); displayStatus("Error removing URL.", true); }
}
async function addAllowlistUrl(urlToAdd) {
    displayStatus('', false); let newUrl = urlToAdd.trim(); if (!newUrl) { displayStatus("URL cannot be empty.", true); return; }
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl;
        if (!newUrl.includes('.')) { displayStatus("Invalid URL format.", true); return; }
    }
    try { const urlObject = new URL(newUrl); newUrl = `${urlObject.origin}/`; } catch (e) { displayStatus("Invalid URL format.", true); return; }
    try { const data = await chrome.storage.sync.get({ [ALLOWLIST_STORAGE_KEY]: [] }); let urls = data[ALLOWLIST_STORAGE_KEY]; if (!Array.isArray(urls)) urls = []; if (urls.includes(newUrl)) { displayStatus(`URL "${newUrl}" already in list.`, false); return; } urls.push(newUrl); urls.sort(); await chrome.storage.sync.set({ [ALLOWLIST_STORAGE_KEY]: urls }); renderUrlList(urls); allowlistUrlInput.value = ''; displayStatus(`URL "${newUrl}" added.`, false); } catch (e) { console.error("Allowlist add error:", e); displayStatus("Error saving URL.", true); }
}
async function handleAddCurrentSiteToAllowlist() {
    displayStatus('', false); try { const tabs = await chrome.tabs.query({ active: true, currentWindow: true }); if (tabs && tabs.length > 0) { const tab = tabs[0]; if (tab.url && tab.url.startsWith('http')) { const urlObject = new URL(tab.url); addAllowlistUrl(`${urlObject.origin}/`); } else { displayStatus("Current site has invalid URL.", true); } } else { displayStatus("Cannot get current tab.", true); } } catch (e) { console.error("Add current site error:", e); displayStatus("Error getting current tab URL.", true); }
}

function getSequenceStorageKey(tabId) { return `${SEQUENCE_STORAGE_KEY_PREFIX}${tabId}`; }

async function loadSequenceForCurrentTab() {
    if (!currentTabId) { renderSequence([]); sequenceListElement.innerHTML = '<li class="no-steps">Activate a web page tab to build its sequence.</li>'; return; }
    const key = getSequenceStorageKey(currentTabId);
    const data = await chrome.storage.local.get({ [key]: [] });
    renderSequence(data[key] || []);
}

async function saveSequenceForCurrentTab(sequence) {
    if (!currentTabId) return;
    const key = getSequenceStorageKey(currentTabId);
    await chrome.storage.local.set({ [key]: sequence });
    renderSequence(sequence);
}

function renderSequence(sequence) {
    sequenceListElement.innerHTML = '';
    generatedUrlContainer.style.display = 'none'; generatedUrlOutput.value = '';

    if (!Array.isArray(sequence) || sequence.length === 0) {
        sequenceListElement.innerHTML = '<li class="no-steps">No steps yet. Right-click on an allowed page element &rarr; "Add to Sequence..."</li>';
        return;
    }

    sequence.forEach((step, index) => {
        const li = document.createElement('li');
        li.dataset.index = index;

        const mainLineDiv = document.createElement('div');
        mainLineDiv.className = 'step-main-line';

        const descSpan = document.createElement('span');
        descSpan.className = 'step-description';
        let displayText = step.description || 'Step detail missing'; // Fallback

        if (step.actionType === 'inject') {
            if (step.elementType === 'SELECT') {
                displayText = `Select option in ${step.description || step.fullIdentifier}`;
                if (step.optionsFetched && step.value !== undefined && step.value !== '') { // Show chosen value if available
                     const selectedOption = (step.selectOptions || []).find(opt => opt.value === step.value);
                     displayText = `Select "${selectedOption ? selectedOption.text.substring(0,20)+'...' : step.value}" in ${step.description || step.fullIdentifier}`;
                } else if (!step.optionsFetched) {
                    displayText = `Set value for SELECT ${step.description || step.fullIdentifier} (loading options...)`;
                }
            } else {
                displayText = `Inject "${step.value}" into ${step.description || step.fullIdentifier}`;
            }
        } else if (step.actionType === 'click') {
            displayText = `Click ${step.description || step.fullIdentifier}`;
        } else if (step.command === 'wait') {
            displayText = `Wait for ${step.value}`;
        } else if (step.command === 'pressEnter') {
            displayText = `Press Enter`;
        }
        descSpan.textContent = displayText;
        descSpan.title = `Full ID: ${step.fullIdentifier || 'N/A'}\nAction: ${step.actionType || step.command}\nValue: ${step.value}`;
        mainLineDiv.appendChild(descSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'step-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&#x2715;'; // HTML entity for X
        deleteBtn.title = "Delete step";
        deleteBtn.addEventListener('click', async (e) => { e.stopPropagation(); sequence.splice(index, 1); await saveSequenceForCurrentTab(sequence); });
        actionsDiv.appendChild(deleteBtn);
        mainLineDiv.appendChild(actionsDiv);
        li.appendChild(mainLineDiv);

        // If it's a SELECT element for injection, add its specific UI
        if (step.elementType === 'SELECT' && step.actionType === 'inject') {
            const selectContainer = document.createElement('div');
            selectContainer.className = 'step-select-container';
            if (!step.optionsFetched) {
                selectContainer.textContent = 'Fetching options...';
            } else {
                createSelectWithOptionsUI(selectContainer, step, index, sequence);
            }
            li.appendChild(selectContainer);
        }
        sequenceListElement.appendChild(li);
    });
}

function createSelectWithOptionsUI(container, step, index, sequence) {
    container.innerHTML = '';
    const selectEl = document.createElement('select');
    selectEl.className = 'step-option-select';
    let foundSelected = false;

    if (step.selectOptions && step.selectOptions.length > 0) {
        step.selectOptions.forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt.value;
            optionEl.textContent = opt.text.length > 40 ? opt.text.substring(0, 37) + '...' : opt.text;
            optionEl.title = opt.text;
            if (opt.value === step.value) {
                optionEl.selected = true;
                foundSelected = true;
            }
            selectEl.appendChild(optionEl);
        });
        // If step.value was not among options (e.g. first load), select the first option
        if (!foundSelected && step.selectOptions.length > 0 && (step.value === undefined || step.value === '')) {
             selectEl.selectedIndex = 0;
             sequence[index].value = step.selectOptions[0].value; // Update sequence data
        }

    } else {
        const optionEl = document.createElement('option'); optionEl.value = ""; optionEl.textContent = "No options found";
        selectEl.appendChild(optionEl);
    }
    selectEl.addEventListener('change', async (e) => { sequence[index].value = e.target.value; await saveSequenceForCurrentTab(sequence); });
    container.appendChild(selectEl);
}

async function handleNewStep(newStepDataFromBg) {
    if (!currentTabId) { displayStatus("No active tab.", true); return; }
    const key = getSequenceStorageKey(currentTabId);
    const data = await chrome.storage.local.get({ [key]: [] });
    let sequence = data[key] || [];
    const stepToAdd = { ...newStepDataFromBg }; // Create a copy

    if (stepToAdd.elementType === 'SELECT' && stepToAdd.actionType === 'inject') {
        stepToAdd.optionsFetched = false;
        stepToAdd.selectOptions = [];
        sequence.push(stepToAdd);
        await saveSequenceForCurrentTab(sequence); // Show "Loading options..."
        displayStatus(`Fetching options for SELECT...`, false, 0);

        chrome.runtime.sendMessage(
            { action: "getSelectOptions", tabId: currentTabId, selectIdentifier: stepToAdd.fullIdentifier },
            async (response) => {
                const currentSequenceData = await chrome.storage.local.get(getSequenceStorageKey(currentTabId));
                let currentSeq = currentSequenceData[getSequenceStorageKey(currentTabId)] || [];
                const stepIndex = currentSeq.findIndex(s => s.fullIdentifier === stepToAdd.fullIdentifier && s.elementType === 'SELECT' && !s.optionsFetched);

                if (stepIndex > -1) {
                    if (response && response.status === "success") {
                        currentSeq[stepIndex].selectOptions = response.options || [];
                        currentSeq[stepIndex].optionsFetched = true;
                        if (!currentSeq[stepIndex].value && response.options && response.options.length > 0) {
                             currentSeq[stepIndex].value = response.options[0].value; // Default to first option
                        }
                        displayStatus("Options loaded. Choose one.", false, 3000);
                    } else {
                        displayStatus(`Failed to fetch options: ${response?.message || 'Error'}`, true);
                        currentSeq[stepIndex].optionsFetched = true;
                        currentSeq[stepIndex].selectOptions = [{text: "Error loading options", value:""}];
                    }
                    await saveSequenceForCurrentTab(currentSeq);
                } else {
                     console.warn("Could not find provisional SELECT step to update options.");
                     displayStatus("Error updating options for step.", true);
                }
            }
        );
    } else {
        sequence.push(stepToAdd);
        await saveSequenceForCurrentTab(sequence);
        displayStatus("Step added to sequence.", false, 1500);
    }
}

addWaitStepButton.addEventListener('click', () => {
    const duration = prompt("Wait duration (e.g., 500ms, 2s):", "1s");
    if (duration) {
        handleNewStep({ fullIdentifier: 'wait', identifierType: 'special', elementType: 'SPECIAL_COMMAND', actionType: 'special', command: 'wait', value: duration, description: `Wait ${duration}` });
    }
});
addEnterStepButton.addEventListener('click', () => {
    handleNewStep({ fullIdentifier: 'pressEnter', identifierType: 'special', elementType: 'SPECIAL_COMMAND', actionType: 'special', command: 'pressEnter', value: 'true', description: `Press Enter Key` });
});

applySequenceButton.addEventListener('click', async () => {
    if (!currentTabId || !currentTabUrlForSequence) { displayStatus("No active tab context.", true); return; }
    const key = getSequenceStorageKey(currentTabId); const data = await chrome.storage.local.get({ [key]: [] }); const sequence = data[key] || [];
    if (sequence.length === 0) { displayStatus("Sequence empty.", true); return; }
    chrome.runtime.sendMessage({ action: "buildAndReload", tabId: currentTabId, baseUrl: currentTabUrlForSequence, sequence: sequence }, (response) => {
        if (chrome.runtime.lastError) { displayStatus(`Error: ${chrome.runtime.lastError.message}`, true); } else if (response && response.status === "success") { displayStatus("Page reloading...", false); window.close(); /* Close popup on success */ } else { displayStatus(`Failed to apply: ${response?.message || 'Unknown'}`, true); }
    });
});
copySequenceUrlButton.addEventListener('click', async () => {
    if (!currentTabUrlForSequence) { displayStatus("No active tab context for URL generation.", true); return; }
    const key = getSequenceStorageKey(currentTabId); const data = await chrome.storage.local.get({ [key]: [] }); const sequence = data[key] || [];
    if (sequence.length === 0) { displayStatus("Sequence empty, nothing to copy.", false); return; }
    let params = sequence.map(step => { let paramKey = step.command === 'wait' ? 'wait' : (step.command === 'pressEnter' ? 'pressEnter' : step.fullIdentifier); return `${encodeURIComponent(paramKey)}=${encodeURIComponent(step.value)}`; }).join('&');
    const finalUrl = `${currentTabUrlForSequence}${currentTabUrlForSequence.includes('?') ? (params ? '&' : '') : (params ? '?' : '')}${params}`;
    generatedUrlOutput.value = finalUrl; generatedUrlContainer.style.display = 'block';
    try { await navigator.clipboard.writeText(finalUrl); displayStatus("Full URL copied!", false); } catch (err) { displayStatus("Failed to copy.", true); console.error(err); }
});
clearSequenceButton.addEventListener('click', async () => {
    if (!currentTabId) return; if (confirm("Clear sequence for this tab?")) { await saveSequenceForCurrentTab([]); displayStatus("Sequence cleared.", false); }
});

async function initializePopup() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
            currentTabId = tabs[0].id;
            if (tabs[0].url && tabs[0].url.startsWith('http')) {
                 const urlObj = new URL(tabs[0].url);
                 currentTabUrlForSequence = `${urlObj.origin}${urlObj.pathname}`;
            } else { currentTabUrlForSequence = "No Active HTTP Page"; } // Fallback

            const storageKeyForNewStep = 'uspi_new_step_for_tab_' + currentTabId;
            const data = await chrome.storage.local.get(storageKeyForNewStep);
            const newStepDataFromBg = data[storageKeyForNewStep];

            if (newStepDataFromBg && newStepDataFromBg.step) {
                document.querySelector('.tab-button[data-tab="sequence-builder-tab"]').click();
                await handleNewStep(newStepDataFromBg.step);
                await chrome.storage.local.remove(storageKeyForNewStep);
            } else {
                // Default to allowlist tab if not adding a step, but still load sequence data silently
                await loadSequenceForCurrentTab();
                if (!document.querySelector('.tab-button[data-tab="sequence-builder-tab"]').classList.contains('active')){
                     document.querySelector('.tab-button[data-tab="allowlist-tab"]').click();
                }
            }
        } else {
             sequenceListElement.innerHTML = '<li class="no-steps">No active web page.</li>';
             document.querySelector('.tab-button[data-tab="sequence-builder-tab"]').disabled = true; // Disable sequence builder if no tab
        }
    } catch (e) { console.error("Error initializing popup:", e); displayStatus("Init error.", true, 0); }
    loadAllowlistUrls();
}

addAllowlistUrlButton.addEventListener('click', () => addAllowlistUrl(allowlistUrlInput.value));
allowlistUrlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addAllowlistUrl(allowlistUrlInput.value); });
addCurrentSiteToAllowlistButton.addEventListener('click', handleAddCurrentSiteToAllowlist);
allowlistUrlListElement.addEventListener('click', (e) => { if (e.target.classList.contains('remove-btn')) removeAllowlistUrl(e.target.dataset.url); });

document.addEventListener('DOMContentLoaded', initializePopup);