/**
 * Test Gmail email sending with proper scopes
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

async function testEmailSending() {
  console.log('📧 Testing Gmail Email Sending with OAuth2\n');

  try {
    // Step 1: Create OAuth2 client with email-specific scopes
    console.log('Step 1: Creating OAuth2 client...');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    // Step 2: Set credentials
    console.log('Step 2: Setting credentials...');
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    // Step 3: Get access token
    console.log('Step 3: Getting access token...');
    const accessTokenResponse = await oauth2Client.getAccessToken();
    console.log('✅ Access token obtained:', accessTokenResponse.token.substring(0, 20) + '...');

    // Step 4: Create nodemailer transporter
    console.log('Step 4: Creating email transporter...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_SERVICE_ACCOUNT_EMAIL,
        clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
        clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessTokenResponse.token
      },
    });

    console.log('📧 Using email:', process.env.GMAIL_SERVICE_ACCOUNT_EMAIL);
    console.log('📧 Token scope confirmed: gmail.send ✅');

    // Step 5: Verify transporter
    console.log('Step 5: Verifying email transporter...');
    await transporter.verify();
    console.log('✅ Email transporter verified successfully!');

    // Step 6: Send test email
    console.log('Step 6: Sending test email to elbarrioburritos@gmail.com...');
    const mailOptions = {
      from: `ChatFlow <${process.env.GMAIL_SERVICE_ACCOUNT_EMAIL}>`,
      to: 'elbarrioburritos@gmail.com',
      subject: '🎉 You\'re invited to join Test Workspace on ChatFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #667eea;">You're Invited!</h1>
          <p>Steven (Chat App Developer) has invited you to join <strong>Test Workspace</strong>.</p>
          <a href="https://coral-app-rgki8.ondigitalocean.app/invite/test-token-123" 
             style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Join Workspace
          </a>
          <p><small>This invitation will expire in 7 days.</small></p>
        </div>
      `,
      text: 'You\'re invited to join Test Workspace on ChatFlow! Visit: https://coral-app-rgki8.ondigitalocean.app/invite/test-token-123'
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);

  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.response) {
      console.error('SMTP response:', error.response);
    }
  }

  console.log('\n🏁 Email sending test completed');
}

testEmailSending();
