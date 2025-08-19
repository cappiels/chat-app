#!/usr/bin/env node

/**
 * Test script to debug email service issues
 */

require('dotenv').config();
const emailService = require('./services/emailService');
const { google } = require('googleapis');

async function testEmailService() {
  console.log('🔍 Testing Email Service Configuration...\n');

  // 1. Check environment variables
  console.log('1. Environment Variables Check:');
  console.log('   GMAIL_OAUTH_CLIENT_ID:', process.env.GMAIL_OAUTH_CLIENT_ID ? 'SET ✓' : 'MISSING ❌');
  console.log('   GMAIL_OAUTH_CLIENT_SECRET:', process.env.GMAIL_OAUTH_CLIENT_SECRET ? 'SET ✓' : 'MISSING ❌');
  console.log('   GMAIL_REFRESH_TOKEN:', process.env.GMAIL_REFRESH_TOKEN ? 'SET ✓' : 'MISSING ❌');
  console.log('   GMAIL_SERVICE_ACCOUNT_EMAIL:', process.env.GMAIL_SERVICE_ACCOUNT_EMAIL);
  console.log('   FRONTEND_URL:', process.env.FRONTEND_URL);
  console.log('');

  // 2. Test OAuth2 token
  console.log('2. Testing OAuth2 Token Refresh:');
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    // Try to get access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('   Access token obtained ✓');
    console.log('   Token expires at:', new Date(credentials.expiry_date));
    console.log('');
  } catch (error) {
    console.log('   OAuth2 token refresh failed ❌');
    console.log('   Error:', error.message);
    console.log('');
  }

  // 3. Test Gmail API access
  console.log('3. Testing Gmail API Access:');
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Test with a simple profile request
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('   Gmail API accessible ✓');
    console.log('   Email address:', profile.data.emailAddress);
    console.log('   Messages total:', profile.data.messagesTotal);
    console.log('');
  } catch (error) {
    console.log('   Gmail API access failed ❌');
    console.log('   Error:', error.message);
    if (error.message.includes('insufficient authentication scopes')) {
      console.log('   💡 Hint: You may need to re-authorize with additional scopes');
    }
    console.log('');
  }

  // 4. Test email service initialization
  console.log('4. Testing Email Service Initialization:');
  try {
    await emailService.ensureInitialized();
    console.log('   Email service initialized ✓');
    console.log('');
  } catch (error) {
    console.log('   Email service initialization failed ❌');
    console.log('   Error:', error.message);
    console.log('');
  }

  // 5. Test actual email sending
  console.log('5. Testing Email Sending:');
  try {
    const result = await emailService.sendEmail({
      to: 'elbarrioburritos@gmail.com', // Use the email from the original issue
      subject: 'Email Service Test - ' + new Date().toISOString(),
      html: `
        <h2>Email Service Test</h2>
        <p>This is a test email to verify the email service is working correctly.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
        <p>If you receive this email, the service is working properly.</p>
      `,
      category: 'test'
    });

    if (result.success) {
      console.log('   Test email sent successfully ✓');
      console.log('   Message ID:', result.messageId);
      console.log('   Timestamp:', result.timestamp);
    } else {
      console.log('   Test email sending failed ❌');
      console.log('   Error:', result.error);
      console.log('   Fallback used:', result.fallback);
    }
    console.log('');
  } catch (error) {
    console.log('   Test email sending crashed ❌');
    console.log('   Error:', error.message);
    console.log('');
  }

  // 6. Get analytics
  console.log('6. Email Service Analytics:');
  try {
    const analytics = emailService.getAnalytics();
    console.log('   Sent:', analytics.sent);
    console.log('   Failed:', analytics.failed);
    console.log('   Success Rate:', analytics.successRate);
    console.log('   Templates loaded:', analytics.templates.length);
    if (analytics.templates.length > 0) {
      console.log('   Template names:', analytics.templates.join(', '));
    }
  } catch (error) {
    console.log('   Failed to get analytics:', error.message);
  }

  console.log('\n🏁 Email Service Test Complete');
}

// Run the test
testEmailService().catch(error => {
  console.error('Test script crashed:', error);
  process.exit(1);
});
