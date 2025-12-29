const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Token file path
const TOKEN_PATH = path.join(__dirname, '..', 'tokens.json');

// OAuth2 scopes for Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Create OAuth2 client
 */
function createOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.BASE_URL}/api/auth/callback`
    );
}

/**
 * Get authorization URL
 */
function getAuthUrl() {
    const oauth2Client = createOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
}

/**
 * Exchange authorization code for tokens
 */
async function getTokensFromCode(code) {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens to file
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

    return tokens;
}

/**
 * Get authenticated OAuth2 client
 */
function getAuthenticatedClient() {
    if (!fs.existsSync(TOKEN_PATH)) {
        return null;
    }

    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Handle token refresh
    oauth2Client.on('tokens', (newTokens) => {
        const updatedTokens = { ...tokens, ...newTokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(updatedTokens, null, 2));
    });

    return oauth2Client;
}

/**
 * Check if authenticated
 */
function isAuthenticated() {
    return fs.existsSync(TOKEN_PATH);
}

/**
 * Clear authentication
 */
function clearAuth() {
    if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
    }
}

/**
 * Create a folder in Google Drive
 * @param {string} name - Folder name
 * @param {string} parentId - Parent folder ID (optional)
 * @returns {Promise<string>} - Created folder ID
 */
async function createFolder(name, parentId = null) {
    const auth = getAuthenticatedClient();
    if (!auth) throw new Error('Not authenticated with Google Drive');

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
    };

    if (parentId) {
        fileMetadata.parents = [parentId];
    }

    const response = await drive.files.create({
        resource: fileMetadata,
        fields: 'id, webViewLink'
    });

    return {
        id: response.data.id,
        link: response.data.webViewLink
    };
}

/**
 * Upload a text file to Google Drive
 * @param {string} content - File content
 * @param {string} fileName - File name
 * @param {string} folderId - Parent folder ID
 * @returns {Promise<object>} - Uploaded file info
 */
async function uploadTextFile(content, fileName, folderId) {
    const auth = getAuthenticatedClient();
    if (!auth) throw new Error('Not authenticated with Google Drive');

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
        name: fileName,
        parents: [folderId]
    };

    const media = {
        mimeType: 'text/plain',
        body: content
    };

    const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
    });

    return {
        id: response.data.id,
        link: response.data.webViewLink
    };
}

/**
 * Create parent folder for a batch of songs
 * @param {string} theme - Theme name
 * @returns {Promise<object>} - Folder info
 */
async function createParentFolder(theme) {
    const folderName = `Lagu Anak - Tema ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
    return await createFolder(folderName);
}

/**
 * Create song folder and upload lyrics
 * @param {number} index - Song index (1-based)
 * @param {string} title - Song title
 * @param {string} lyrics - Song lyrics
 * @param {string} parentFolderId - Parent folder ID
 * @returns {Promise<object>} - Created folder and file info
 */
async function uploadSong(index, title, lyrics, parentFolderId) {
    // Create folder with format "01 - Judul Lagu"
    const folderName = `${String(index).padStart(2, '0')} - ${title}`;
    const folder = await createFolder(folderName, parentFolderId);

    // Prepare lyrics content with title and metadata
    const content = `${title}
${'='.repeat(title.length)}

${lyrics}

---
Dibuat oleh: Kids Song Generator Bot
Tanggal: ${new Date().toLocaleDateString('id-ID')}
`;

    // Upload lyrics file
    const file = await uploadTextFile(content, 'lirik.txt', folder.id);

    return {
        folderName,
        folderId: folder.id,
        folderLink: folder.link,
        fileId: file.id,
        fileLink: file.link
    };
}

module.exports = {
    getAuthUrl,
    getTokensFromCode,
    isAuthenticated,
    clearAuth,
    createParentFolder,
    uploadSong
};
