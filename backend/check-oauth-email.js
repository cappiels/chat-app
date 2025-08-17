/**
 * Check which email address the OAuth2 token is associated with
 */

require('dotenv').config();
const { google } = require('googleapis');

async function checkOAuthEmail() {
  console.log('🔍 Checking OAuth2 Token Email Address\n');

  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_OAUTH_CLIENT_ID,
      process.env.GMAIL_OAUTH_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    // Get Gmail service
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
      // Get profile to see the actual email
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('✅ OAuth2 token is for email:', profile.data.emailAddress);
      console.log('Messages in account:', profile.data.messagesTotal);
      
      // Test sending with the correct email address
      console.log('\n📧 Testing email send with correct address...');
      
      const nodemailer = require('nodemailer');
      
      const accessTokenResponse = await oauth2Client.getAccessToken();
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: profile.data.emailAddress, // Use the actual email from the token
          clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
          clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          accessToken: accessTokenResponse.token
        },
      });

      await transporter.verify();
      console.log('✅ Email transporter verified with correct email!');

      // Send test email
      const result = await transporter.sendMail({
        from: `ChatFlow <${profile.data.emailAddress}>`,
        to: 'elbarrioburritos@gmail.com',
        subject: '🎉 You\'re invited to join Test Workspace on ChatFlow (WORKING!)',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #667eea;">🎉 SUCCESS! You're Invited!</h1>
            <p>Steven has invited you to join <strong>Test Workspace</strong>.</p>
            <p>This email was sent successfully using the fixed OAuth2 configuration!</p>
            <a href="https://coral-app-rgki8.ondigitalocean.app/invite/test-token-123" 
               style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Join Workspace
            </a>
          </div>
        `
      });

      console.log('🎉 EMAIL SENT SUCCESSFULLY!');
      console.log('Message ID:', result.messageId);
      console.log('\n✅ Check elbarrioburritos@gmail.com for the invitation!');

    } catch (scopeError) {
      console.log('❌ Gmail API access failed (expected if scope insufficient)');
      console.log('Error:', scopeError.message);
      
      // Still try to send email even if profile access fails
      console.log('\n📧 Attempting email send anyway...');
      
      const nodemailer = require('nodemailer');
      const accessTokenResponse = await oauth2Client.getAccessToken();
      
      // Try with a real Gmail address instead of service account
      const realEmail = 'stevencappiello@gmail.com'; // Your actual Gmail
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: realEmail,
          clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
          clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          accessToken: accessTokenResponse.token
        },
      });

      await transporter.verify();
      console.log('✅ Email transporter verified with real Gmail address!');

      const result = await transporter.sendMail({
        from: `ChatFlow <${realEmail}>`,
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

      console.log('🎉 EMAIL SENT SUCCESSFULLY!');
      console.log('Message ID:', result.messageId);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

checkOAuthEmail();
