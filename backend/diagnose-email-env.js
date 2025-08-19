#!/usr/bin/env node

/**
 * Diagnostic script to check email environment variables
 */

require('dotenv').config();

console.log('🔍 Email Environment Variables Diagnostic');
console.log('==========================================\n');

// Check all required environment variables
const requiredVars = [
  'GMAIL_OAUTH_CLIENT_ID',
  'GMAIL_OAUTH_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_SERVICE_ACCOUNT_EMAIL'
];

const envStatus = {};

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅ SET' : '❌ MISSING';
  const preview = value ? `${value.substring(0, 20)}...` : 'undefined';
  
  console.log(`${varName}: ${status}`);
  console.log(`  Value: ${preview}\n`);
  
  envStatus[varName] = !!value;
});

// Overall status
const allSet = Object.values(envStatus).every(Boolean);
console.log(`Overall Status: ${allSet ? '✅ ALL SET' : '❌ MISSING VARIABLES'}\n`);

// Test OAuth2 client creation
console.log('🧪 Testing OAuth2 Client Creation');
console.log('=================================');

try {
  const { google } = require('googleapis');
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  if (process.env.GMAIL_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });
    console.log('✅ OAuth2 client created and configured');
  } else {
    console.log('❌ OAuth2 client created but no refresh token');
  }
  
} catch (error) {
  console.log('❌ OAuth2 client creation failed:', error.message);
}

console.log('\n📊 Production Environment Notes:');
console.log('================================');
console.log('• Local .env file variables may not be available in production');
console.log('• DigitalOcean App Platform requires environment variables to be set in app spec');
console.log('• Missing variables in production will cause email sending to fail');
console.log('• Consider adding fallback email method or better error handling');
