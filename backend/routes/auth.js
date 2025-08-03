const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Configure the OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_OAUTH_CLIENT_ID,
  process.env.GMAIL_OAUTH_CLIENT_SECRET,
  // This is the URI that Google will redirect to after consent
  // In production, this will be the full Digital Ocean URL
  process.env.NODE_ENV === 'production'
    ? 'https://coral-app-rgki8.ondigitalocean.app/api/auth/google/callback'
    : 'http://localhost:8080/api/auth/google/callback'
);

// Scopes required for sending email
const scopes = [
  'https://www.googleapis.com/auth/gmail.send'
];

/**
 * GET /auth/google
 * Redirects the user to Google's consent screen to get a refresh token.
 * This is a one-time setup step for the administrator.
 */
router.get('/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // 'offline' is required to get a refresh token
    scope: scopes
  });
  console.log('Redirecting to Google for consent. Please visit this URL:');
  console.log(url);
  res.redirect(url);
});

/**
 * GET /auth/google/callback
 * The callback route that Google redirects to after consent.
 * It exchanges the authorization code for a refresh token.
 */
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Error: Missing authorization code.');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return res.status(400).send(`
        <h1>Error: No Refresh Token Received</h1>
        <p>This can happen if you have already granted consent for this application. Please go to your 
        <a href="https://myaccount.google.com/permissions">Google Account permissions</a>, 
        remove access for this app, and try the /api/auth/google route again.</p>
      `);
    }

    console.log('================================================================');
    console.log('✅ SUCCESS! You have received a Refresh Token.');
    console.log('Copy the token below and add it to your .env file and your');
    console.log('Digital Ocean environment variables with the key:');
    console.log('GMAIL_OAUTH_REFRESH_TOKEN');
    console.log('================================================================');
    console.log(refreshToken);
    console.log('================================================================');

    res.status(200).send(`
      <h1>Refresh Token Generated!</h1>
      <p>Please check your backend server's console logs for the token.</p>
      <p>You can now close this window.</p>
    `);

  } catch (error) {
    console.error('Error exchanging authorization code for tokens:', error);
    res.status(500).send('Failed to retrieve refresh token.');
  }
});

module.exports = router;
