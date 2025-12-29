require('dotenv').config();

const express = require('express');
const path = require('path');
const { generateSongLyrics } = require('./src/gemini');
const {
    getAuthUrl,
    getTokensFromCode,
    isAuthenticated,
    clearAuth,
    createParentFolder,
    uploadSong
} = require('./src/drive');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active generation sessions for SSE
const activeSessions = new Map();

// ============================================
// API Routes
// ============================================

// Check authentication status
app.get('/api/auth/status', (req, res) => {
    res.json({
        authenticated: isAuthenticated(),
        hasAIKey: !!process.env.GROQ_API_KEY
    });
});

// Start Google OAuth flow
app.get('/api/auth/google', (req, res) => {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
});

// OAuth callback
app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.redirect('/?error=no_code');
    }

    try {
        await getTokensFromCode(code);
        res.redirect('/?auth=success');
    } catch (error) {
        console.error('OAuth error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    clearAuth();
    res.json({ success: true });
});

// Server-Sent Events endpoint for progress updates
app.get('/api/generate/progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Store the response object for sending updates
    activeSessions.set(sessionId, res);

    req.on('close', () => {
        activeSessions.delete(sessionId);
    });
});

// Generate songs
app.post('/api/generate', async (req, res) => {
    const { theme, count, sessionId } = req.body;

    // Validation
    if (!theme || !count) {
        return res.status(400).json({ error: 'Theme and count are required' });
    }

    if (count < 1 || count > 100) {
        return res.status(400).json({ error: 'Count must be between 1 and 100' });
    }

    if (!isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated with Google Drive' });
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'Groq API key not configured. Get FREE API key at https://console.groq.com' });
    }

    // Helper function to send SSE updates
    const sendProgress = (data) => {
        const sseRes = activeSessions.get(sessionId);
        if (sseRes) {
            sseRes.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };

    try {
        // Send initial status
        sendProgress({
            status: 'starting',
            message: 'Memulai proses generate lagu...'
        });

        // Create parent folder
        sendProgress({
            status: 'creating_folder',
            message: 'Membuat folder utama di Google Drive...'
        });

        const parentFolder = await createParentFolder(theme);

        sendProgress({
            status: 'folder_created',
            message: `Folder "${parentFolder.link}" berhasil dibuat`,
            parentFolderId: parentFolder.id,
            parentFolderLink: parentFolder.link
        });

        const songs = [];
        const errors = [];

        // Generate songs using the new workflow (titles first, then lyrics)
        const { generateBatchSongs } = require('./src/gemini');

        const generatedSongs = await generateBatchSongs(theme, count, (progress) => {
            sendProgress(progress);
        });

        // Upload each song to Drive
        for (let i = 0; i < generatedSongs.length; i++) {
            const song = generatedSongs[i];
            const songNumber = i + 1;

            try {
                sendProgress({
                    status: 'uploading',
                    current: songNumber,
                    total: count,
                    message: `Mengupload "${song.title}" ke Google Drive...`
                });

                // Upload to Drive
                const uploaded = await uploadSong(songNumber, song.title, song.lyrics, parentFolder.id);

                songs.push({
                    index: songNumber,
                    title: song.title,
                    ...uploaded
                });

                sendProgress({
                    status: 'uploaded',
                    current: songNumber,
                    total: count,
                    message: `✓ Uploaded: "${song.title}"`,
                    song: {
                        title: song.title,
                        folderLink: uploaded.folderLink
                    }
                });

                // Small delay between uploads
                if (i < generatedSongs.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

            } catch (error) {
                console.error(`Error uploading song ${songNumber}:`, error);
                errors.push({ index: songNumber, error: error.message });

                sendProgress({
                    status: 'upload_error',
                    current: songNumber,
                    total: count,
                    message: `✗ Error upload "${song.title}": ${error.message}`
                });
            }
        }

        // Send completion
        sendProgress({
            status: 'complete',
            message: `Selesai! ${songs.length} lagu berhasil dibuat.`,
            songs,
            errors,
            parentFolderLink: parentFolder.link
        });

        // Close SSE connection
        const sseRes = activeSessions.get(sessionId);
        if (sseRes) {
            sseRes.end();
            activeSessions.delete(sessionId);
        }

        res.json({
            success: true,
            songs,
            errors,
            parentFolderLink: parentFolder.link
        });

    } catch (error) {
        console.error('Generation error:', error);

        sendProgress({
            status: 'error',
            message: `Error: ${error.message}`
        });

        res.status(500).json({ error: error.message });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║     🎵 Kids Song Generator Bot 🎵          ║
╠════════════════════════════════════════════╣
║  Server running at:                        ║
║  http://localhost:${PORT}                       ║
╠════════════════════════════════════════════╣
║  Setup Checklist:                          ║
║  ${process.env.GROQ_API_KEY ? '✓' : '✗'} Groq API Key (Llama 3.1)         ║
║  ${process.env.GOOGLE_CLIENT_ID ? '✓' : '✗'} Google OAuth Client ID              ║
║  ${process.env.GOOGLE_CLIENT_SECRET ? '✓' : '✗'} Google OAuth Client Secret          ║
╚════════════════════════════════════════════╝
  `);
});
