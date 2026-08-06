const { google } = require('googleapis');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

/**
 * Scopes requested from Google:
 *  - gmail.send — needed for future email sending
 *  - userinfo.email — to read the connected email address
 */
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Build and return a fresh OAuth2 client.
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate the Google OAuth consent URL.
 * @param {string} companyCode — used as OAuth state to identify company on callback
 * @returns {string} Authorization URL
 */
function generateAuthUrl(companyCode) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // always return refresh_token
    state: companyCode, // passed back as ?state= on callback
  });
}

/**
 * Exchange authorization code for tokens.
 * @param {string} code — auth code received from Google callback
 * @returns {Promise<{ refreshToken: string, email: string }>}
 */
async function exchangeCode(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Fetch the authenticated email address
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();

  return {
    refreshToken: tokens.refresh_token || '',
    email: data.email || '',
  };
}

module.exports = { generateAuthUrl, exchangeCode, createOAuth2Client };
