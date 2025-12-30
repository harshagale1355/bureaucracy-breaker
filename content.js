// Content Script for Bureaucracy Breaker
// Runs on every webpage to detect and interact with forms

const API_BASE = 'http://localhost:8004';
const DEBUG = true;

function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[CONTENT] ${message}`, data || '');
    }
}

// Listen for messages from extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog('Content script received message:', request.action);
    
    switch(request.action) {
        case 'detectForms':
            detectAndAnalyzeForms()
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'fillForm':
            fillWebsiteForm(request.answers)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        case 'extractFormHTML':
            const html = extractFormHTML();
            sendResponse({ success: true, data: html });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// ============================================================================
// FORM DETECTION & ANALYSIS
// ============================================================================

async function detectAndAnalyzeForms() {
    debugLog('Detecting forms on page...');
    
    const forms = document.querySelectorAll('form');
    
    if (forms.length === 0) {
        debugLog('No forms found on page');
        return {
            formsFound: 0,
            forms: []
        };
    }
    
    const formsList = [];
    
    forms.forEach((form, index) => {
        const formData = extractFormFields(form);
        
        if (formData.fields.length > 0) {
            formsList.push({
                id: `form_${index}`,
                name: form.getAttribute('name') || `Form ${index + 1}`,
                action: form.getAttribute('action') || '',
                method: form.getAttribute('method') || 'POST',
                fields: formData.fields,
                selector: generateSelector(form)
            });
        }
    });
    
    debugLog(`Found ${formsList.length} fillable forms`, formsList);
    
    return {
        formsFound: formsList.length,
        forms: formsList
    };
}

// Extract all fillable fields from a form
function extractFormFields(form) {
    const fields = [];
    
    // Input fields
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="number"], input[type="tel"], input[type="password"], input[type="date"]').forEach(input => {
        const label = getFieldLabel(input);
        fields.push({
            name: input.name || input.id || `field_${fields.length}`,
            type: 'text',
            label: label,
            id: input.id,
            className: input.className,
            value: input.value,
            placeholder: input.placeholder
        });
    });
    
    // Textarea
    form.querySelectorAll('textarea').forEach(textarea => {
        const label = getFieldLabel(textarea);
        fields.push({
            name: textarea.name || textarea.id || `field_${fields.length}`,
            type: 'textarea',
            label: label,
            id: textarea.id,
            className: textarea.className,
            value: textarea.value,
            placeholder: textarea.placeholder
        });
    });
    
    // Select (dropdown)
    form.querySelectorAll('select').forEach(select => {
        const label = getFieldLabel(select);
        const options = Array.from(select.querySelectorAll('option')).map(opt => ({
            value: opt.value,
            label: opt.textContent
        }));
        
        fields.push({
            name: select.name || select.id || `field_${fields.length}`,
            type: 'select',
            label: label,
            id: select.id,
            className: select.className,
            value: select.value,
            options: options
        });
    });
    
    // Checkboxes
    const checkboxGroups = {};
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        const name = checkbox.name;
        if (!checkboxGroups[name]) {
            const label = getFieldLabel(checkbox);
            checkboxGroups[name] = {
                name: name,
                type: 'checkbox',
                label: label,
                options: []
            };
        }
        checkboxGroups[name].options.push({
            value: checkbox.value,
            label: checkbox.nextElementSibling?.textContent || checkbox.value,
            id: checkbox.id
        });
    });
    
    Object.values(checkboxGroups).forEach(group => {
        fields.push(group);
    });
    
    // Radio buttons
    const radioGroups = {};
    form.querySelectorAll('input[type="radio"]').forEach(radio => {
        const name = radio.name;
        if (!radioGroups[name]) {
            const label = getFieldLabel(radio);
            radioGroups[name] = {
                name: name,
                type: 'radio',
                label: label,
                options: []
            };
        }
        radioGroups[name].options.push({
            value: radio.value,
            label: radio.nextElementSibling?.textContent || radio.value,
            id: radio.id
        });
    });
    
    Object.values(radioGroups).forEach(group => {
        fields.push(group);
    });
    
    return { fields };
}

// Get label for a form field
function getFieldLabel(input) {
    // Try to find associated label
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) {
            return label.textContent.trim();
        }
    }
    
    // Check parent for label
    const parent = input.closest('label');
    if (parent) {
        return parent.textContent.trim();
    }
    
    // Use placeholder or name
    return input.placeholder || input.name || 'Unknown field';
}

// Generate a CSS selector for a form element
function generateSelector(element) {
    if (element.id) {
        return `#${element.id}`;
    }
    
    const names = [];
    let current = element;
    
    while (current.parentElement) {
        const selector = current.tagName.toLowerCase();
        if (current.id) {
            names.unshift(`#${current.id}`);
            break;
        } else if (current.className) {
            names.unshift(`${selector}.${current.className.split(' ')[0]}`);
        } else {
            names.unshift(selector);
        }
        current = current.parentElement;
    }
    
    return names.join(' > ');
}

// Extract form HTML for sending to backend
function extractFormHTML() {
    debugLog('Extracting form HTML...');
    
    const forms = document.querySelectorAll('form');
    let formHTML = '';
    
    forms.forEach(form => {
        formHTML += form.outerHTML + '\n';
    });
    
    return formHTML;
}

// ============================================================================
// FORM FILLING
// ============================================================================

async function fillWebsiteForm(answers) {
    debugLog('Filling form with answers:', answers);
    
    const forms = document.querySelectorAll('form');
    let filledCount = 0;
    
    forms.forEach((form, formIndex) => {
        // Fill text inputs
        form.querySelectorAll('input[type="text"], input[type="email"], input[type="number"], input[type="tel"], input[type="password"], input[type="date"]').forEach(input => {
            const fieldName = input.name || input.id;
            if (fieldName && answers[fieldName]) {
                input.value = answers[fieldName];
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                filledCount++;
                debugLog(`Filled ${fieldName} with: ${answers[fieldName]}`);
            }
        });
        
        // Fill textareas
        form.querySelectorAll('textarea').forEach(textarea => {
            const fieldName = textarea.name || textarea.id;
            if (fieldName && answers[fieldName]) {
                textarea.value = answers[fieldName];
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                filledCount++;
            }
        });
        
        // Fill selects
        form.querySelectorAll('select').forEach(select => {
            const fieldName = select.name || select.id;
            if (fieldName && answers[fieldName]) {
                select.value = answers[fieldName];
                select.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
            }
        });
        
        // Fill checkboxes
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            const fieldName = checkbox.name;
            if (fieldName && answers[fieldName]) {
                const answerValue = answers[fieldName];
                
                // Handle multiple values
                if (Array.isArray(answerValue)) {
                    checkbox.checked = answerValue.includes(checkbox.value);
                } else if (typeof answerValue === 'string') {
                    checkbox.checked = answerValue.toLowerCase() === 'yes' || 
                                     answerValue === checkbox.value ||
                                     answerValue.includes(checkbox.value);
                }
                
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
            }
        });
        
        // Fill radio buttons
        form.querySelectorAll('input[type="radio"]').forEach(radio => {
            const fieldName = radio.name;
            if (fieldName && answers[fieldName]) {
                radio.checked = radio.value === answers[fieldName];
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
            }
        });
    });
    
    debugLog(`Filled ${filledCount} fields`);
    
    return {
        success: true,
        fieldsFilled: filledCount,
        message: `Successfully filled ${filledCount} form fields`
    };
}

debugLog('Content script loaded and ready');