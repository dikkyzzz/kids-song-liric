// ====================================
// DOM Elements
// ====================================
const elements = {
    // Auth
    authCard: document.getElementById('authCard'),
    geminiStatus: document.getElementById('geminiStatus'),
    driveStatus: document.getElementById('driveStatus'),
    authBtn: document.getElementById('authBtn'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Generator Form
    generatorCard: document.getElementById('generatorCard'),
    generateForm: document.getElementById('generateForm'),
    themeInput: document.getElementById('theme'),
    countInput: document.getElementById('count'),
    countDown: document.getElementById('countDown'),
    countUp: document.getElementById('countUp'),
    estimateTime: document.getElementById('estimateTime'),
    generateBtn: document.getElementById('generateBtn'),

    // Progress
    progressCard: document.getElementById('progressCard'),
    progressTitle: document.getElementById('progressTitle'),
    progressFill: document.getElementById('progressFill'),
    progressCount: document.getElementById('progressCount'),
    progressPercent: document.getElementById('progressPercent'),
    progressLog: document.getElementById('progressLog'),

    // Result
    resultCard: document.getElementById('resultCard'),
    resultText: document.getElementById('resultText'),
    driveLink: document.getElementById('driveLink'),
    newBatchBtn: document.getElementById('newBatchBtn')
};

// ====================================
// State
// ====================================
let state = {
    authenticated: false,
    hasAIKey: false,
    generating: false
};

// ====================================
// Utility Functions
// ====================================
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function updateEstimate() {
    const count = parseInt(elements.countInput.value) || 0;
    // ~5 seconds per song (generation + upload + delay)
    const seconds = count * 5;

    if (seconds < 60) {
        elements.estimateTime.textContent = `~${seconds} detik`;
    } else {
        const minutes = Math.ceil(seconds / 60);
        elements.estimateTime.textContent = `~${minutes} menit`;
    }
}

function setStatus(element, status, text) {
    const icons = {
        loading: '⏳',
        success: '✅',
        error: '❌'
    };

    const iconEl = element.querySelector('.status-icon');
    const textEl = element.querySelector('.status-text');

    iconEl.textContent = icons[status] || '⏳';
    textEl.textContent = text;
}

function addLogItem(message, type = '') {
    const item = document.createElement('div');
    item.className = 'log-item ' + type;
    item.textContent = message;
    elements.progressLog.appendChild(item);
    elements.progressLog.scrollTop = elements.progressLog.scrollHeight;
}

function clearLog() {
    elements.progressLog.innerHTML = '';
}

function showCard(card) {
    elements.generatorCard.style.display = 'none';
    elements.progressCard.style.display = 'none';
    elements.resultCard.style.display = 'none';
    card.style.display = 'block';
}

// ====================================
// API Functions
// ====================================
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        state.authenticated = data.authenticated;
        state.hasAIKey = data.hasAIKey;

        updateAuthUI();
    } catch (error) {
        console.error('Failed to check auth status:', error);
        setStatus(elements.geminiStatus, 'error', 'Connection Error');
        setStatus(elements.driveStatus, 'error', 'Connection Error');
    }
}

function updateAuthUI() {
    // AI status (Groq - Llama 3.1)
    if (state.hasAIKey) {
        setStatus(elements.geminiStatus, 'success', 'Groq AI ✓');
    } else {
        setStatus(elements.geminiStatus, 'error', 'Groq API Key Missing');
    }

    // Drive status
    if (state.authenticated) {
        setStatus(elements.driveStatus, 'success', 'Google Drive ✓');
        elements.authBtn.style.display = 'none';
        elements.logoutBtn.style.display = 'inline-flex';
    } else {
        setStatus(elements.driveStatus, 'error', 'Google Drive');
        elements.authBtn.style.display = 'flex';
        elements.logoutBtn.style.display = 'none';
    }

    // Enable/disable generate button
    elements.generateBtn.disabled = !state.authenticated || !state.hasAIKey;
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        state.authenticated = false;
        updateAuthUI();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

async function generateSongs(theme, count) {
    const sessionId = generateSessionId();

    // Start SSE for progress updates
    const eventSource = new EventSource(`/api/generate/progress/${sessionId}`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleProgressUpdate(data);
    };

    eventSource.onerror = () => {
        eventSource.close();
    };

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ theme, count, sessionId })
        });

        const result = await response.json();

        eventSource.close();

        if (result.success) {
            showResult(result);
        } else {
            throw new Error(result.error || 'Generation failed');
        }
    } catch (error) {
        eventSource.close();
        alert('Error: ' + error.message);
        showCard(elements.generatorCard);
    }
}

function handleProgressUpdate(data) {
    switch (data.status) {
        case 'starting':
        case 'creating_folder':
            elements.progressTitle.textContent = 'Mempersiapkan...';
            addLogItem(data.message);
            break;

        case 'folder_created':
            addLogItem(data.message, 'success');
            break;

        case 'generating':
        case 'uploading':
            elements.progressTitle.textContent = `Lagu ${data.current} dari ${data.total}`;
            elements.progressCount.textContent = `${data.current} / ${data.total}`;

            const percent = Math.round((data.current / data.total) * 100);
            elements.progressFill.style.width = percent + '%';
            elements.progressPercent.textContent = percent + '%';

            addLogItem(data.message);
            break;

        case 'song_complete':
            addLogItem(data.message, 'success');
            break;

        case 'song_error':
            addLogItem(data.message, 'error');
            break;

        case 'complete':
            elements.progressFill.style.width = '100%';
            elements.progressPercent.textContent = '100%';
            break;

        case 'error':
            addLogItem(data.message, 'error');
            break;
    }
}

function showResult(result) {
    const successCount = result.songs.length;
    const errorCount = result.errors.length;

    let message = `${successCount} lagu berhasil dibuat`;
    if (errorCount > 0) {
        message += ` (${errorCount} error)`;
    }
    message += ' dan disimpan ke Google Drive';

    elements.resultText.textContent = message;
    elements.driveLink.href = result.parentFolderLink;

    showCard(elements.resultCard);
}

// ====================================
// Event Handlers
// ====================================
function initEventListeners() {
    // Auth button
    elements.authBtn.addEventListener('click', () => {
        window.location.href = '/api/auth/google';
    });

    // Logout button
    elements.logoutBtn.addEventListener('click', logout);

    // Count buttons
    elements.countDown.addEventListener('click', () => {
        const current = parseInt(elements.countInput.value) || 0;
        if (current > 1) {
            elements.countInput.value = current - 1;
            updateEstimate();
        }
    });

    elements.countUp.addEventListener('click', () => {
        const current = parseInt(elements.countInput.value) || 0;
        if (current < 100) {
            elements.countInput.value = current + 1;
            updateEstimate();
        }
    });

    // Count input change
    elements.countInput.addEventListener('input', updateEstimate);

    // Form submit
    elements.generateForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (state.generating) return;

        const theme = elements.themeInput.value.trim();
        const count = parseInt(elements.countInput.value);

        if (!theme) {
            alert('Masukkan tema lagu');
            return;
        }

        if (count < 1 || count > 100) {
            alert('Jumlah lagu harus antara 1-100');
            return;
        }

        state.generating = true;
        clearLog();
        showCard(elements.progressCard);

        await generateSongs(theme, count);

        state.generating = false;
    });

    // New batch button
    elements.newBatchBtn.addEventListener('click', () => {
        elements.themeInput.value = '';
        elements.countInput.value = '10';
        updateEstimate();
        showCard(elements.generatorCard);
    });
}

// ====================================
// URL Parameter Handling
// ====================================
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);

    if (params.get('auth') === 'success') {
        // Clear URL params
        window.history.replaceState({}, '', '/');
        // Show success message briefly
        setTimeout(() => {
            checkAuthStatus();
        }, 500);
    }

    if (params.get('error')) {
        alert('Authentication failed: ' + params.get('error'));
        window.history.replaceState({}, '', '/');
    }
}

// ====================================
// Initialize
// ====================================
document.addEventListener('DOMContentLoaded', () => {
    handleUrlParams();
    checkAuthStatus();
    initEventListeners();
    updateEstimate();
});
