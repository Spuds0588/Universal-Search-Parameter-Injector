// content.js V3.6 - Smart Select Injection & Fix Double Injection Error

if (!window.universalSearchParameterInjectorRan_v3_6) {
    window.universalSearchParameterInjectorRan_v3_6 = true;

    const CLICK_ACTION_VALUE = 'click';
    const WAIT_TIMEOUT_MS = 15000;
    const CSS_SELECTOR_PREFIX = "css:";
    const WAIT_PARAM_KEY = "wait";
    const PRESS_ENTER_PARAM_KEY = "pressenter";

    function waitForTarget(targetSpecifier, timeout) {
        return new Promise((resolve) => { let el=null; const isCss=targetSpecifier.startsWith(CSS_SELECTOR_PREFIX); const lVal=isCss?targetSpecifier.substring(CSS_SELECTOR_PREFIX.length):targetSpecifier; const find=()=>{try{return isCss?document.querySelector(lVal):document.getElementById(lVal);}catch(e){console.warn("USPI Sel Error",e);return null;}}; el=find(); if(el){resolve(el);return;} let obs,to; const cl=()=>{if(obs)obs.disconnect();if(to)clearTimeout(to);}; obs=new MutationObserver(()=>{el=find();if(el){cl();resolve(el);}}); obs.observe(document.body||document.documentElement,{childList:true,subtree:true}); to=setTimeout(()=>{console.warn(`USPI Timeout for "${lVal}"`);cl();resolve(null);},timeout);});
    }

    function performInjection(element, valueToInject) {
        try {
            const targetIdForLog = element.id || (element.classList?.length > 0 ? '.' + Array.from(element.classList).join('.') : element.tagName);
            if (element.tagName === 'SELECT') {
                let optionFound = false;
                for (let i = 0; i < element.options.length; i++) {
                    if (element.options[i].value === valueToInject) {
                        element.selectedIndex = i; optionFound = true; break;
                    }
                }
                if (optionFound) { console.log(`USPI: Selected option value "${valueToInject}" in SELECT (${targetIdForLog}).`); element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true })); element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); return true;
                } else { console.warn(`USPI: Option value "${valueToInject}" not found in SELECT (${targetIdForLog}).`); return false; }
            } else if ('value' in element) { element.value = valueToInject; element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true })); console.log(`USPI: Injected value "${valueToInject}" into element (${targetIdForLog}).`); return true;
            } else if (element.isContentEditable) { element.textContent = valueToInject; element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); console.log(`USPI: Injected value "${valueToInject}" into contentEditable element (${targetIdForLog}).`); return true;
            } else { console.warn(`USPI: Element (${targetIdForLog}) is not injectable.`); return false; }
        } catch (error) { console.error(`USPI: Error injecting value:`, error); return false; }
    }

    function performClick(element) {
         try { const targetId = element.id || (element.classList?.length > 0 ? '.' + Array.from(element.classList).join('.') : element.tagName); const isClickable = element.click && ( element.tagName === 'BUTTON' || element.tagName === 'A' || (element.tagName === 'INPUT' && ['button', 'submit', 'reset', 'image'].includes(element.type?.toLowerCase())) || element.getAttribute('role') === 'button' ); if (!isClickable) { console.warn(`USPI: Element (${targetId}) may not be clickable.`); } element.click(); console.log(`USPI: Clicked element (${targetId}).`); return true; } catch (error) { console.error(`USPI: Error clicking element:`, error); return false; }
    }

    function parseWaitDuration(value) {
        if (!value) return 0; const match = value.match(/^(\d+)\s*(ms|s)$/i); if (match) { const num = parseInt(match[1], 10); const unit = match[2].toLowerCase(); if (!isNaN(num) && num > 0) { return (unit === 's') ? num * 1000 : num; } } console.warn(`USPI: Invalid wait format: "${value}".`); return 0;
    }

    function simulateEnterKeyPress(targetElement) {
        if (!targetElement || typeof targetElement.dispatchEvent !== 'function') { console.warn("USPI: Invalid target for Enter."); return; } console.log(`USPI: Simulating Enter on:`, targetElement); const eventOptions = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }; targetElement.dispatchEvent(new KeyboardEvent('keydown', eventOptions)); setTimeout(() => { targetElement.dispatchEvent(new KeyboardEvent('keyup', eventOptions)); }, 50);
    }

    function parseQueryStringManually(queryString) {
        const params = []; if (!queryString || queryString.length <= 1) { return params; } const pairs = queryString.substring(1).split('&'); for (const pair of pairs) { let key, value = ''; const sepIdx = pair.indexOf('='); if (sepIdx === -1) { key = pair; } else { key = pair.substring(0, sepIdx); value = pair.substring(sepIdx + 1); } try { const decKey = decodeURIComponent(key.replace(/\+/g, ' ')); const decVal = decodeURIComponent(value.replace(/\+/g, ' ')); params.push([decKey, decVal]); } catch (e) { console.warn(`USPI: Error decoding param: "${pair}"`, e); } } return params;
    }

    async function processUrlParametersSequentially() {
        // console.log("USPI: Starting sequential processing (manual parser)."); // Less verbose
        const urlParams = parseQueryStringManually(window.location.search);
        let actionCount = 0; let lastInjectedInputElement = null;

        for (const [key, value] of urlParams) {
            const currentKeyLower = key.toLowerCase(); let currentActionProcessed = false;
            if (!key || key.trim() === '') { continue; }
            actionCount++; const currentActionLabel = `action #${actionCount}`;

            if (currentKeyLower === WAIT_PARAM_KEY) {
                const waitMs = parseWaitDuration(value); if (waitMs > 0) { console.log(`USPI: ${currentActionLabel}: Waiting ${waitMs}ms...`); await new Promise(resolve => setTimeout(resolve, waitMs)); console.log(`USPI: Wait finished.`); } else { console.warn(`USPI: Skipped invalid wait ${currentActionLabel}.`); } lastInjectedInputElement = null; currentActionProcessed = true;
            }
            else if (currentKeyLower === PRESS_ENTER_PARAM_KEY) {
                 console.log(`USPI: ${currentActionLabel}: Simulating Enter.`); if (lastInjectedInputElement && document.body.contains(lastInjectedInputElement)) { simulateEnterKeyPress(lastInjectedInputElement); } else { console.warn(`USPI: Cannot simulate Enter for ${currentActionLabel}: No previous input target.`); } lastInjectedInputElement = null; currentActionProcessed = true;
            }

            if (currentActionProcessed) { continue; }

            const targetSpecifier = key;
            console.log(`USPI: Processing ${currentActionLabel}: Target="${targetSpecifier}", Value="${value}"`);
            lastInjectedInputElement = null;
            const element = await waitForTarget(targetSpecifier, WAIT_TIMEOUT_MS);

            if (element) {
                if (value.toLowerCase() === CLICK_ACTION_VALUE) { performClick(element); }
                else { const success = performInjection(element, value); if (success && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)) { lastInjectedInputElement = element; } }
            } else { console.warn(`USPI: Skipped ${currentActionLabel} for Target "${targetSpecifier}" (not found).`); }
        }
        if (actionCount > 0) { console.log(`USPI: Finished processing ${actionCount} actions.`); }
    }

    requestAnimationFrame(() => {
        processUrlParametersSequentially().catch(error => {
             console.error("USPI: Unhandled error during sequential processing:", error);
        });
    });
}