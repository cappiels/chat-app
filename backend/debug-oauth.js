/**
 * Step-by-step OAuth2 debugging script
 */

require('dotenv').config();
const { google } = require('googleapis');

async function debugOAuth2() {
  console.log('🔍 Step-by-Step OAuth2 Debugging\n');

  // Step 1: Check environment variables
  console.log('Step 1: Environment Variables');
  console.log('GMAIL_OAUTH_CLIENT_ID:', process.env.GMAIL_OAUTH_CLIENT_ID ? 'Present' : 'Missing');
  console.log('GMAIL_OAUTH_CLIENT_SECRET:', process.env.GMAIL_OAUTH_CLIENT_SECRET ? 'Present' : 'Missing');
  console.log('GMAIL_REFRESH_TOKEN:', process.env.GMAIL_REFRESH_TOKEN ? 'Present' : 'Missing');
  console.log('GMAIL_SERVICE_ACCOUNT_EMAIL:', process.env.GMAIL_SERVICE_ACCOUNT_EMAIL);
  console.log('');

  // Step 2: Initialize OAuth2 client
  console.log('Step 2: Initializing OAuth2 Client');
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    console.log('✅ OAuth2 client created successfully');

    // Step 3: Set credentials
    console.log('\nStep 3: Setting OAuth2 Credentials');
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    console.log('✅ Credentials set successfully');

    // Step 4: Try to get access token
    console.log('\nStep 4: Getting Access Token');
    const accessTokenResponse = await oauth2Client.getAccessToken();
    
    if (accessTokenResponse.token) {
      console.log('✅ Access token obtained successfully');
      console.log('Token starts with:', accessTokenResponse.token.substring(0, 20) + '...');
    } else {
      console.log('❌ Failed to get access token');
      console.log('Response:', accessTokenResponse);
    }

    // Step 5: Test Gmail API access
    console.log('\nStep 5: Testing Gmail API Access');
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Gmail API access successful');
    console.log('Email address:', profile.data.emailAddress);
    console.log('Messages total:', profile.data.messagesTotal);

  } catch (error) {
    console.error('❌ OAuth2 Error:', error.message);
    if (error.response && error.response.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n🏁 OAuth2 debugging completed');
}

debugOAuth2();
