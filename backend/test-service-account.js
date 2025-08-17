/**
 * Test Gmail with Service Account Authentication
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

async function testServiceAccount() {
  console.log('🔐 Testing Gmail with Service Account Authentication\n');

  try {
    // Step 1: Create service account auth
    console.log('Step 1: Setting up service account authentication...');
    
    const serviceAccountKey = {
      type: "service_account",
      project_id: "chat-app-9dbff",
      private_key: process.env.GMAIL_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.GMAIL_SERVICE_ACCOUNT_EMAIL,
    };

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.send']
    });

    console.log('✅ Service account configured');

    // Step 2: Get access token
    console.log('Step 2: Getting access token...');
    const accessTokenResponse = await auth.getAccessToken();
    const accessToken = accessTokenResponse.token;
    console.log('✅ Access token obtained:', accessToken.substring(0, 20) + '...');

    // Step 3: Create nodemailer transporter
    console.log('Step 3: Creating email transporter...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_SERVICE_ACCOUNT_EMAIL,
        accessToken: accessToken
      },
    });

    // Step 4: Verify transporter
    console.log('Step 4: Verifying transporter...');
    await transporter.verify();
    console.log('✅ Email transporter verified!');

    // Step 5: Send test email
    console.log('Step 5: Sending test email...');
    const result = await transporter.sendMail({
      from: `ChatFlow <${process.env.GMAIL_SERVICE_ACCOUNT_EMAIL}>`,
      to: 'elbarrioburritos@gmail.com',
      subject: '🎉 You\'re invited to join Test Workspace on ChatFlow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #667eea;">You're Invited!</h1>
          <p>Steven has invited you to join <strong>Test Workspace</strong>.</p>
          <a href="https://coral-app-rgki8.ondigitalocean.app/invite/test-token-123" 
             style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Join Workspace
          </a>
        </div>
      `
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);

  } catch (error) {
    console.error('❌ Service account test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }

  console.log('\n🏁 Service account test completed');
}

testServiceAccount();
