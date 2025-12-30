// API Configuration
const API_BASE = 'http://localhost:8004';
const DEBUG = true;

// State Management
let currentMode = null; // 'pdf' or 'website'
let currentSessionId = null;
let currentFileName = null;
let uploadedPdfFile = null;
let totalFields = 0;
let answeredFields = 0;
let detectedFormFields = [];

// Debug Logger
function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[EXTENSION] ${message}`, data || '');
    }
}

// DOM Elements
const modeSelection = document.getElementById('modeSelection');
const pdfModeBtn = document.getElementById('pdfModeBtn');
const websiteModeBtn = document.getElementById('websiteModeBtn');

const uploadSection = document.getElementById('uploadSection');
const websiteSection = document.getElementById('websiteSection');
const chatSection = document.getElementById('chatSection');

const uploadArea = document.getElementById('uploadArea');
const pdfInput = document.getElementById('pdfInput');
const uploadBtn = document.getElementById('uploadBtn');

const scanFormBtn = document.getElementById('scanFormBtn');
const formDetectionResult = document.getElementById('formDetectionResult');
const detectionMessage = document.getElementById('detectionMessage');
const startWebsiteFormBtn = document.getElementById('startWebsiteFormBtn');

const chatContainer = document.getElementById('chatContainer');
const answerInput = document.getElementById('answerInput');
const sendBtn = document.getElementById('sendBtn');
const imageUploadContainer = document.getElementById('imageUploadContainer');
const imageUploadBtn = document.getElementById('imageUploadBtn');
const imageInput = document.getElementById('imageInput');

const downloadBtn = document.getElementById('downloadBtn');
const fillWebFormBtn = document.getElementById('fillWebFormBtn');

const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const healthIndicator = document.getElementById('healthIndicator');
const statusText = document.getElementById('statusText');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

const backFromPdf = document.getElementById('backFromPdf');
const backFromWebsite = document.getElementById('backFromWebsite');
const backFromChat = document.getElementById('backFromChat');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    debugLog('Extension popup loaded');
    checkAPIHealth();
    setupEventListeners();
});

// ============================================================================
// API HEALTH CHECK
// ============================================================================

async function checkAPIHealth() {
    debugLog('Checking API health...');
    try {
        const response = await fetch(`${API_BASE}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            debugLog('Health check data:', data);
            
            healthIndicator.classList.remove('unhealthy');
            healthIndicator.classList.add('healthy');
            statusText.textContent = '✅ API Connected';
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        debugLog('Health check failed:', error);
        healthIndicator.classList.remove('healthy');
        healthIndicator.classList.add('unhealthy');
        statusText.textContent = '❌ API Offline';
        showError('⚠️ Backend server is not running. Please start it on port 8004.');
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Mode selection
    pdfModeBtn.addEventListener('click', () => selectMode('pdf'));
    websiteModeBtn.addEventListener('click', () => selectMode('website'));

    // Back buttons
    backFromPdf.addEventListener('click', () => showModeSelection());
    backFromWebsite.addEventListener('click', () => showModeSelection());
    backFromChat.addEventListener('click', () => {
        if (currentMode === 'pdf') {
            showSection('uploadSection');
        } else {
            showSection('websiteSection');
        }
    });

    // PDF Upload
    uploadArea.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', handleFileSelect);
    uploadBtn.addEventListener('click', startPdfFormFilling);

    // Website Form
    scanFormBtn.addEventListener('click', scanWebsiteForm);
    startWebsiteFormBtn.addEventListener('click', startWebsiteFormFilling);

    // Chat
    sendBtn.addEventListener('click', sendAnswer);
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAnswer();
    });

    // Image upload
    imageUploadBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageUpload);

    // Footer buttons
    downloadBtn.addEventListener('click', downloadPDF);
    fillWebFormBtn.addEventListener('click', fillWebsiteFormNow);

    // Drag and drop for PDF
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            pdfInput.files = e.dataTransfer.files;
            handleFileSelect({ target: { files: [file] } });
        }
    });
}

// ============================================================================
// MODE SELECTION
// ============================================================================

function selectMode(mode) {
    currentMode = mode;
    debugLog('Mode selected:', mode);
    
    if (mode === 'pdf') {
        showSection('uploadSection');
    } else if (mode === 'website') {
        showSection('websiteSection');
    }
}

function showModeSelection() {
    modeSelection.style.display = 'flex';
    uploadSection.style.display = 'none';
    websiteSection.style.display = 'none';
    chatSection.style.display = 'none';
    currentMode = null;
    resetState();
}

function showSection(sectionId) {
    modeSelection.style.display = 'none';
    uploadSection.style.display = 'none';
    websiteSection.style.display = 'none';
    chatSection.style.display = 'none';
    
    document.getElementById(sectionId).style.display = sectionId === 'chatSection' ? 'flex' : 'block';
}

function resetState() {
    currentSessionId = null;
    currentFileName = null;
    uploadedPdfFile = null;
    totalFields = 0;
    answeredFields = 0;
    detectedFormFields = [];
    chatContainer.innerHTML = '';
    progressFill.style.width = '0%';
    progressText.textContent = '0% Complete';
    downloadBtn.style.display = 'none';
    fillWebFormBtn.style.display = 'none';
    answerInput.disabled = false;
    sendBtn.disabled = false;
}

// ============================================================================
// PDF MODE - FILE HANDLING
// ============================================================================

function handleFileSelect(event) {
    const file = event.target.files[0];
    debugLog('File selected:', {
        name: file?.name,
        size: file?.size,
        type: file?.type
    });

    if (file && file.type === 'application/pdf') {
        uploadedPdfFile = file;
        currentFileName = file.name;
        uploadArea.querySelector('p').textContent = `✅ Selected: ${file.name}`;
        uploadBtn.style.display = 'block';
    } else {
        showError('❌ Please select a valid PDF file');
    }
}

async function startPdfFormFilling() {
    if (!uploadedPdfFile) return;

    debugLog('Starting PDF form filling with file:', uploadedPdfFile.name);
    showLoading(true);
    hideError();

    try {
        // Upload PDF
        const formData = new FormData();
        formData.append('file', uploadedPdfFile);

        debugLog('Uploading PDF...');
        const uploadResponse = await fetch(`${API_BASE}/upload-pdf`, {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        const uploadData = await uploadResponse.json();
        debugLog('Upload successful:', uploadData);

        const sessionId = uploadData.session_id;
        totalFields = uploadData.total_fields || 0;

        if (totalFields === 0) {
            showError('❌ This PDF has no fillable form fields.');
            return;
        }

        // Start session
        const startResponse = await fetch(`${API_BASE}/start-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ session_id: sessionId })
        });

        if (!startResponse.ok) {
            throw new Error(`Session start failed: ${startResponse.status}`);
        }

        const startData = await startResponse.json();
        debugLog('Session started:', startData);

        currentSessionId = sessionId;
        answeredFields = 0;

        // Switch to chat view
        showSection('chatSection');
        addMessageToChat(`🎯 Found ${totalFields} fields in your PDF form!`, 'ai');

        // Display first question
        if (startData.question) {
            displayQuestion(startData.question);
        }

    } catch (error) {
        debugLog('Error in startPdfFormFilling:', error);
        showError(error.message || '❌ Failed to process PDF. Please try again.');
    } finally {
        showLoading(false);
    }
}

// ============================================================================
// WEBSITE MODE - FORM SCANNING
// ============================================================================

async function scanWebsiteForm() {
    debugLog('Scanning website form...');
    showLoading(true);
    hideError();

    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }

        // Send message to content script to detect forms
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'detectForms' });
        
        debugLog('Form detection response:', response);

        if (!response.success) {
            throw new Error(response.error || 'Failed to detect forms');
        }

        const formData = response.data;

        if (formData.formsFound === 0) {
            showError('❌ No forms detected on this page. Make sure you\'re on a page with a form.');
            return;
        }

        // Extract form HTML for backend processing
        const htmlResponse = await chrome.tabs.sendMessage(tab.id, { action: 'extractFormHTML' });
        
        if (!htmlResponse.success) {
            throw new Error('Failed to extract form HTML');
        }

        const formHTML = htmlResponse.data;

        // Send to backend for analysis
        const analysisResponse = await fetch(`${API_BASE}/analyze-website-form`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                form_html: formHTML,
                forms_data: formData.forms
            })
        });

        if (!analysisResponse.ok) {
            throw new Error(`Analysis failed: ${analysisResponse.status}`);
        }

        const analysisData = await analysisResponse.json();
        debugLog('Form analysis:', analysisData);

        detectedFormFields = analysisData.fields || [];
        totalFields = analysisData.total_fields || 0;

        // Show success
        formDetectionResult.style.display = 'block';
        detectionMessage.textContent = `✅ Found ${formData.formsFound} form(s) with ${totalFields} fillable fields!`;

    } catch (error) {
        debugLog('Error in scanWebsiteForm:', error);
        showError(error.message || '❌ Failed to scan form. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function startWebsiteFormFilling() {
    debugLog('Starting website form filling...');
    showLoading(true);
    hideError();

    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Extract form HTML
        const htmlResponse = await chrome.tabs.sendMessage(tab.id, { action: 'extractFormHTML' });
        const formHTML = htmlResponse.data;

        // Create session
        const sessionResponse = await fetch(`${API_BASE}/analyze-website-form`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ form_html: formHTML })
        });

        if (!sessionResponse.ok) {
            throw new Error(`Session creation failed: ${sessionResponse.status}`);
        }

        const sessionData = await sessionResponse.json();
        currentSessionId = sessionData.session_id;
        totalFields = sessionData.total_fields;

        // Start conversation
        const startResponse = await fetch(`${API_BASE}/start-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ session_id: currentSessionId })
        });

        if (!startResponse.ok) {
            throw new Error(`Start session failed: ${startResponse.status}`);
        }

        const startData = await startResponse.json();
        answeredFields = 0;

        // Switch to chat
        showSection('chatSection');
        addMessageToChat(`🌐 Ready to fill your website form!`, 'ai');
        addMessageToChat(`📝 Found ${totalFields} fields. Let's get started!`, 'system');

        // Display first question
        if (startData.question) {
            displayQuestion(startData.question);
        }

    } catch (error) {
        debugLog('Error in startWebsiteFormFilling:', error);
        showError(error.message || '❌ Failed to start form filling. Please try again.');
    } finally {
        showLoading(false);
    }
}

// ============================================================================
// CHAT INTERACTION
// ============================================================================

async function sendAnswer() {
    const answer = answerInput.value.trim();
    
    if (!answer) {
        showError('⚠️ Please enter an answer');
        return;
    }

    debugLog('Sending answer:', answer);
    addMessageToChat(answer, 'user');
    answerInput.value = '';
    
    showLoading(true);
    hideError();

    try {
        const response = await fetch(`${API_BASE}/next-question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                answer: answer
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        debugLog('Next question response:', data);

        answeredFields++;
        updateProgress();

        if (data.completed) {
            showCompletion();
        } else if (data.question) {
            displayQuestion(data.question);
        }

    } catch (error) {
        debugLog('Error in sendAnswer:', error);
        showError(error.message || '❌ Something went wrong. Please try again.');
    } finally {
        showLoading(false);
    }
}

function displayQuestion(question) {
    const questionText = question.text || question.question;
    const progress = question.current && question.total ? `(${question.current}/${question.total}) ` : '';
    
    addMessageToChat(progress + questionText, 'ai');
    
    if (question.explanation) {
        addMessageToChat(`💡 ${question.explanation}`, 'system');
    }

    // Check if image upload needed
    if (question.field_type === 'image' || 
        questionText.toLowerCase().includes('signature') || 
        questionText.toLowerCase().includes('photo')) {
        imageUploadContainer.style.display = 'block';
    } else {
        imageUploadContainer.style.display = 'none';
    }
}

// ============================================================================
// IMAGE UPLOAD
// ============================================================================

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        showError('❌ Please upload a valid image file (PNG, JPG, JPEG, GIF)');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showError('❌ Image file is too large. Max 5MB.');
        return;
    }

    debugLog('Image selected:', file.name);
    showLoading(true);
    addMessageToChat(`📸 Uploading ${file.name}...`, 'system');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
            `${API_BASE}/upload-image?session_id=${currentSessionId}&field_name=signature`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }

        addMessageToChat(`✅ Image uploaded: ${file.name}`, 'success');
        imageUploadContainer.style.display = 'none';
        answeredFields++;
        updateProgress();

        // Auto-advance
        await sendAnswerDirect('IMAGE_UPLOADED');

    } catch (error) {
        debugLog('Error in handleImageUpload:', error);
        showError(error.message || '❌ Failed to upload image.');
    } finally {
        showLoading(false);
        imageInput.value = '';
    }
}

async function sendAnswerDirect(answer) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/next-question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                answer: answer
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.completed) {
                showCompletion();
            } else if (data.question) {
                displayQuestion(data.question);
            }
        }
    } catch (error) {
        debugLog('Error in sendAnswerDirect:', error);
    } finally {
        showLoading(false);
    }
}

// ============================================================================
// FORM FILLING & DOWNLOAD
// ============================================================================

async function fillWebsiteFormNow() {
    debugLog('Filling website form...');
    showLoading(true);

    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }

        // Get answers from backend session
        const answersResponse = await fetch(`${API_BASE}/fill-website-form`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                session_id: currentSessionId,
                answers: {} // Backend will use stored answers
            })
        });

        if (!answersResponse.ok) {
            throw new Error('Failed to get form data');
        }

        const answersData = await answersResponse.json();
        
        // Send answers to content script to fill form
        const fillResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'fillForm',
            answers: answersData.field_values || {}
        });

        if (!fillResponse.success) {
            throw new Error(fillResponse.error || 'Failed to fill form');
        }

        addMessageToChat(`✅ Form filled! ${fillResponse.data.fieldsFilled} fields populated.`, 'success');
        addMessageToChat(`📝 Please review the form and submit when ready.`, 'system');

    } catch (error) {
        debugLog('Error in fillWebsiteFormNow:', error);
        showError(error.message || '❌ Failed to fill form. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function downloadPDF() {
    if (!currentSessionId) return;

    debugLog('Downloading PDF...');
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/generate-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ session_id: currentSessionId })
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `completed_${currentFileName || 'form.pdf'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        addMessageToChat('✅ PDF downloaded successfully!', 'success');

    } catch (error) {
        debugLog('Error in downloadPDF:', error);
        showError('❌ Failed to generate PDF. Please try again.');
    } finally {
        showLoading(false);
    }
}

// ============================================================================
// UI HELPERS
// ============================================================================

function addMessageToChat(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    let label;
    switch(type) {
        case 'ai':
            label = '🤖 ';
            break;
        case 'user':
            label = '👤 ';
            break;
        case 'system':
            label = 'ℹ️ ';
            break;
        case 'error':
            label = '❌ ';
            break;
        case 'success':
            label = '✅ ';
            break;
        default:
            label = '';
    }

    messageDiv.textContent = label + message;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateProgress() {
    const percentage = totalFields > 0 ? (answeredFields / totalFields) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}% Complete`;
}

function showCompletion() {
    addMessageToChat('🎉 All done! Your form is ready.', 'success');
    
    if (currentMode === 'pdf') {
        addMessageToChat('Click the download button below to get your filled PDF.', 'system');
        downloadBtn.style.display = 'block';
    } else {
        addMessageToChat('Click the button below to fill the form on the webpage.', 'system');
        fillWebFormBtn.style.display = 'block';
    }
    
    answerInput.disabled = true;
    sendBtn.disabled = true;
    imageUploadContainer.style.display = 'none';
    progressFill.style.width = '100%';
    progressText.textContent = '100% Complete';
}

function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function hideError() {
    errorMessage.style.display = 'none';
}
