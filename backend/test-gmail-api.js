/**
 * Test sending email via Gmail API instead of SMTP
 */

require('dotenv').config();
const { google } = require('googleapis');

async function testGmailAPI() {
  console.log('📧 Testing Gmail API Email Sending\n');

  try {
    // Step 1: Setup OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    // Step 2: Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Step 3: Create email message
    const emailContent = `To: elbarrioburritos@gmail.com
From: ChatFlow <${process.env.GMAIL_SERVICE_ACCOUNT_EMAIL}>
Subject: 🎉 You're invited to join Test Workspace on ChatFlow
Content-Type: text/html; charset=utf-8

<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #667eea;">You're Invited!</h1>
  <p>Steven has invited you to join <strong>Test Workspace</strong>.</p>
  <a href="https://coral-app-rgki8.ondigitalocean.app/invite/test-token-123" 
     style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
    Join Workspace
  </a>
  <p><small>This invitation will expire in 7 days.</small></p>
</div>`;

    // Step 4: Encode email as base64
    const encodedEmail = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Step 5: Send email via Gmail API
    console.log('Sending email via Gmail API...');
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    console.log('🎉 EMAIL SENT SUCCESSFULLY via Gmail API!');
    console.log('Message ID:', result.data.id);
    console.log('✅ Check elbarrioburritos@gmail.com for the invitation!');

  } catch (error) {
    console.error('❌ Gmail API test failed:', error.message);
    if (error.response && error.response.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n🏁 Gmail API test completed');
}

testGmailAPI();
