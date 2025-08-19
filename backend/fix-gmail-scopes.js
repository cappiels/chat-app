/**
 * Gmail OAuth2 Scope Fix Script
 * This script will help you generate a new refresh token with the correct Gmail API scopes
 */

const { google } = require('googleapis');
require('dotenv').config();

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
];

async function generateAuthUrl() {
  console.log('🔧 Gmail OAuth2 Scope Fix Script');
  console.log('=====================================\n');
  
  // Check current credentials
  if (!process.env.GMAIL_OAUTH_CLIENT_ID || !process.env.GMAIL_OAUTH_CLIENT_SECRET) {
    console.error('❌ Missing OAuth2 credentials in .env file');
    return;
  }
  
  console.log('✅ OAuth2 credentials found in .env');
  console.log(`📧 Service Account Email: ${process.env.GMAIL_SERVICE_ACCOUNT_EMAIL}`);
  console.log(`🔑 Client ID: ${process.env.GMAIL_OAUTH_CLIENT_ID.substring(0, 20)}...`);
  
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  // Generate authorization URL with correct scopes
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: REQUIRED_SCOPES,
    prompt: 'consent' // Forces refresh token generation
  });

  console.log('\n🚀 STEP 1: Get New Authorization Code');
  console.log('=====================================');
  console.log('1. Open this URL in your browser:');
  console.log('\n' + authUrl + '\n');
  console.log('2. Sign in with the Gmail account:', process.env.GMAIL_SERVICE_ACCOUNT_EMAIL);
  console.log('3. Grant permissions for:');
  REQUIRED_SCOPES.forEach(scope => {
    console.log(`   - ${scope}`);
  });
  console.log('4. Copy the authorization code from the redirect URL');
  console.log('\n📋 STEP 2: Exchange Code for Refresh Token');
  console.log('==========================================');
  console.log('Run this command after getting the authorization code:');
  console.log('node fix-gmail-scopes.js [YOUR_AUTHORIZATION_CODE]');
}

async function exchangeCodeForTokens(code) {
  console.log('🔄 Exchanging authorization code for refresh token...');
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ SUCCESS! New tokens generated');
    console.log('================================');
    console.log('🔑 New Refresh Token:', tokens.refresh_token);
    console.log('⏰ Access Token Expires:', new Date(tokens.expiry_date));
    
    // Test the new token
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    console.log('\n🧪 Testing new token...');
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Gmail API test successful!');
    console.log('📧 Email:', profile.data.emailAddress);
    
    console.log('\n🔧 UPDATE YOUR .ENV FILE:');
    console.log('==========================');
    console.log(`GMAIL_REFRESH_TOKEN="${tokens.refresh_token}"`);
    console.log('\nReplace the existing GMAIL_REFRESH_TOKEN in your .env file with the value above.');
    console.log('Then restart your server to test email functionality.');
    
  } catch (error) {
    console.error('❌ Token exchange failed:', error.message);
    console.error('🔍 Make sure the authorization code is correct and hasn\'t expired');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await generateAuthUrl();
  } else {
    const authCode = args[0];
    await exchangeCodeForTokens(authCode);
  }
}

main().catch(console.error);
