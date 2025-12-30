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

    // Mode Toggle (V2)
    modeToggle: document.getElementById('modeToggle'),
    modeManual: document.getElementById('modeManual'),
    modeBatch: document.getElementById('modeBatch'),

    // Generator Form (Manual Mode)
    generatorCard: document.getElementById('generatorCard'),
    generateForm: document.getElementById('generateForm'),
    themeInput: document.getElementById('theme'),
    countInput: document.getElementById('count'),
    countDown: document.getElementById('countDown'),
    countUp: document.getElementById('countUp'),
    estimateTime: document.getElementById('estimateTime'),
    generateBtn: document.getElementById('generateBtn'),

    // Batch Upload Card (V2)
    batchCard: document.getElementById('batchCard'),
    fileUploadArea: document.getElementById('fileUploadArea'),
    themeFile: document.getElementById('themeFile'),
    themePreview: document.getElementById('themePreview'),
    themeCount: document.getElementById('themeCount'),
    themeList: document.getElementById('themeList'),
    batchEstimate: document.getElementById('batchEstimate'),
    batchEstimateTime: document.getElementById('batchEstimateTime'),
    startBatchBtn: document.getElementById('startBatchBtn'),

    // Progress
    progressCard: document.getElementById('progressCard'),
    progressTitle: document.getElementById('progressTitle'),
    progressFill: document.getElementById('progressFill'),
    progressCount: document.getElementById('progressCount'),
    progressPercent: document.getElementById('progressPercent'),
    progressLog: document.getElementById('progressLog'),

    // Batch Progress (V2)
    batchProgress: document.getElementById('batchProgress'),
    currentThemeName: document.getElementById('currentThemeName'),
    themeProgress: document.getElementById('themeProgress'),
    countdownSection: document.getElementById('countdownSection'),
    countdownTimer: document.getElementById('countdownTimer'),

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
    generating: false,
    currentMode: 'manual', // 'manual' or 'batch'
    batchThemes: [],       // Array of theme strings for V2
    batchResults: []       // Store results from all themes
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

function updateBatchEstimate() {
    const themeCount = state.batchThemes.length;
    if (themeCount === 0) return;

    // 20 songs per theme * 5 seconds + 2 minutes delay between themes
    const songsPerTheme = 20;
    const secondsPerTheme = songsPerTheme * 5; // 100 seconds per theme
    const delayBetweenThemes = 120; // 2 minutes

    const totalSeconds = (themeCount * secondsPerTheme) + ((themeCount - 1) * delayBetweenThemes);
    const totalMinutes = Math.ceil(totalSeconds / 60);

    if (totalMinutes < 60) {
        elements.batchEstimateTime.textContent = `~${totalMinutes} menit`;
    } else {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        elements.batchEstimateTime.textContent = `~${hours} jam ${mins} menit`;
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
    elements.batchCard.style.display = 'none';
    elements.progressCard.style.display = 'none';
    elements.resultCard.style.display = 'none';
    card.style.display = 'block';
}

function formatCountdown(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ====================================
// Mode Switching (V2)
// ====================================
function switchMode(mode) {
    state.currentMode = mode;

    // Update toggle buttons
    elements.modeManual.classList.toggle('active', mode === 'manual');
    elements.modeBatch.classList.toggle('active', mode === 'batch');

    // Show appropriate card
    if (mode === 'manual') {
        elements.generatorCard.style.display = 'block';
        elements.batchCard.style.display = 'none';
    } else {
        elements.generatorCard.style.display = 'none';
        elements.batchCard.style.display = 'block';
    }
}

// ====================================
// File Upload Handling (V2)
// ====================================
function handleFileUpload(file) {
    if (!file || !file.name.endsWith('.txt')) {
        alert('Hanya file .txt yang diperbolehkan');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        state.batchThemes = lines;
        displayThemePreview(lines);
    };
    reader.readAsText(file);
}

function displayThemePreview(themes) {
    elements.themeCount.textContent = themes.length;

    // Build preview list
    elements.themeList.innerHTML = themes.map((theme, i) =>
        `<div class="preview-item"><span class="num">${i + 1}.</span><span>${theme}</span></div>`
    ).join('');

    // Show preview and estimate
    elements.themePreview.style.display = 'block';
    elements.batchEstimate.style.display = 'flex';
    elements.fileUploadArea.classList.add('has-file');

    // Update estimate
    updateBatchEstimate();

    // Enable start button if authenticated
    elements.startBatchBtn.disabled = !state.authenticated || !state.hasAIKey;
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

    // Enable/disable generate buttons
    const canGenerate = state.authenticated && state.hasAIKey;
    elements.generateBtn.disabled = !canGenerate;
    elements.startBatchBtn.disabled = !canGenerate || state.batchThemes.length === 0;
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

// ====================================
// Single Theme Generation (Manual Mode)
// ====================================
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

// ====================================
// Batch Theme Generation (V2)
// ====================================
async function startBatchGeneration() {
    if (state.batchThemes.length === 0) return;

    state.generating = true;
    state.batchResults = [];
    clearLog();

    // Show progress card with batch elements
    showCard(elements.progressCard);
    elements.batchProgress.style.display = 'flex';

    const totalThemes = state.batchThemes.length;
    const songsPerTheme = 20;

    for (let i = 0; i < totalThemes; i++) {
        const theme = state.batchThemes[i];
        const themeNum = i + 1;

        // Update batch progress UI
        elements.currentThemeName.textContent = theme;
        elements.themeProgress.textContent = `${themeNum} / ${totalThemes} tema`;

        addLogItem(`\n📂 === TEMA ${themeNum}/${totalThemes}: ${theme} ===`, 'success');

        try {
            // Generate songs for this theme
            await generateThemeSongs(theme, songsPerTheme, themeNum, totalThemes);
        } catch (error) {
            addLogItem(`❌ Error pada tema "${theme}": ${error.message}`, 'error');
        }

        // Delay between themes (except for last theme)
        if (i < totalThemes - 1) {
            await showCountdownDelay(120); // 2 minutes = 120 seconds
        }
    }

    // Show final result
    showBatchResult();
    state.generating = false;
}

async function generateThemeSongs(theme, count, themeNum, totalThemes) {
    return new Promise((resolve, reject) => {
        const sessionId = generateSessionId();

        // Start SSE for progress updates
        const eventSource = new EventSource(`/api/generate/progress/${sessionId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleBatchProgressUpdate(data, themeNum, totalThemes);
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ theme, count, sessionId })
        })
            .then(response => response.json())
            .then(result => {
                eventSource.close();
                if (result.success) {
                    state.batchResults.push({
                        theme,
                        songs: result.songs,
                        errors: result.errors,
                        folderLink: result.parentFolderLink
                    });
                    resolve(result);
                } else {
                    reject(new Error(result.error || 'Generation failed'));
                }
            })
            .catch(error => {
                eventSource.close();
                reject(error);
            });
    });
}

function handleBatchProgressUpdate(data, themeNum, totalThemes) {
    // Update progress bar based on current song within theme
    if (data.current && data.total) {
        elements.progressTitle.textContent = `Tema ${themeNum}/${totalThemes} - Lagu ${data.current}/${data.total}`;
        elements.progressCount.textContent = `${data.current} / ${data.total}`;

        const percent = Math.round((data.current / data.total) * 100);
        elements.progressFill.style.width = percent + '%';
        elements.progressPercent.textContent = percent + '%';
    }

    // Add log item
    if (data.message) {
        const type = data.status === 'error' || data.status === 'upload_error' ? 'error' :
            data.status === 'complete' || data.status === 'uploaded' ? 'success' : '';
        addLogItem(data.message, type);
    }
}

async function showCountdownDelay(seconds) {
    elements.countdownSection.style.display = 'block';

    return new Promise(resolve => {
        let remaining = seconds;

        const interval = setInterval(() => {
            elements.countdownTimer.textContent = formatCountdown(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                elements.countdownSection.style.display = 'none';
                resolve();
            }
            remaining--;
        }, 1000);

        // Initial display
        elements.countdownTimer.textContent = formatCountdown(remaining);
    });
}

function showBatchResult() {
    const totalSongs = state.batchResults.reduce((sum, r) => sum + r.songs.length, 0);
    const totalErrors = state.batchResults.reduce((sum, r) => sum + r.errors.length, 0);
    const totalThemes = state.batchResults.length;

    let message = `${totalSongs} lagu dari ${totalThemes} tema berhasil dibuat`;
    if (totalErrors > 0) {
        message += ` (${totalErrors} error)`;
    }
    message += ' dan disimpan ke Google Drive';

    elements.resultText.textContent = message;

    // Link to first folder or show multiple
    if (state.batchResults.length > 0) {
        elements.driveLink.href = state.batchResults[0].folderLink;
    }

    showCard(elements.resultCard);

    // Hide batch progress elements
    elements.batchProgress.style.display = 'none';
    elements.countdownSection.style.display = 'none';
}

// ====================================
// Progress Update Handler (Manual Mode)
// ====================================
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

    // Mode toggle (V2)
    elements.modeManual.addEventListener('click', () => switchMode('manual'));
    elements.modeBatch.addEventListener('click', () => switchMode('batch'));

    // File upload area (V2)
    elements.fileUploadArea.addEventListener('click', () => {
        elements.themeFile.click();
    });

    elements.themeFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Drag and drop (V2)
    elements.fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.fileUploadArea.classList.add('dragover');
    });

    elements.fileUploadArea.addEventListener('dragleave', () => {
        elements.fileUploadArea.classList.remove('dragover');
    });

    elements.fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.fileUploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    // Start batch button (V2)
    elements.startBatchBtn.addEventListener('click', async () => {
        if (state.generating) return;
        await startBatchGeneration();
    });

    // Count buttons (Manual mode)
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

    // Form submit (Manual mode)
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
        elements.batchProgress.style.display = 'none'; // Hide batch UI for manual mode
        showCard(elements.progressCard);

        await generateSongs(theme, count);

        state.generating = false;
    });

    // New batch button
    elements.newBatchBtn.addEventListener('click', () => {
        // Reset state
        state.batchThemes = [];
        state.batchResults = [];

        // Reset UI based on current mode
        if (state.currentMode === 'manual') {
            elements.themeInput.value = '';
            elements.countInput.value = '10';
            updateEstimate();
            showCard(elements.generatorCard);
        } else {
            elements.themeFile.value = '';
            elements.themePreview.style.display = 'none';
            elements.batchEstimate.style.display = 'none';
            elements.fileUploadArea.classList.remove('has-file');
            elements.startBatchBtn.disabled = true;
            showCard(elements.batchCard);
        }
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
