/**
 * Test script to verify invitation email sending in production
 */
require('dotenv').config();
const emailService = require('./services/emailService');

async function testInvitationEmail() {
  console.log('🧪 Testing Production Email Invitation System...\n');
  
  // Check environment variables
  console.log('📋 Environment Check:');
  console.log(`- Gmail Service Account Email: ${process.env.GMAIL_SERVICE_ACCOUNT_EMAIL ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Gmail OAuth Client ID: ${process.env.GMAIL_OAUTH_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Gmail OAuth Client Secret: ${process.env.GMAIL_OAUTH_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Gmail Refresh Token: ${process.env.GMAIL_REFRESH_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`- Frontend URL: ${process.env.FRONTEND_URL || '❌ Not set (using default)'}\n`);
  
  // Test email service
  try {
    console.log('📧 Testing email service initialization...');
    const analytics = emailService.getAnalytics();
    console.log('Email service analytics:', analytics);
    
    console.log('\n📨 Sending test invitation email...');
    const result = await emailService.sendWorkspaceInvitation({
      to: 'elbarrioburritos@gmail.com',
      workspaceName: 'Test Workspace',
      workspaceDescription: 'This is a test workspace to verify email functionality',
      inviterName: 'Test User',
      inviterEmail: 'test@example.com',
      inviteUrl: 'https://coral-app-rgki8.ondigitalocean.app/invite/test-token-123',
      userRole: 'member',
      memberCount: 2,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    
    console.log('\n✅ Email Send Result:', result);
    
    if (result.success) {
      console.log(`\n🎉 SUCCESS! Email sent with Message ID: ${result.messageId}`);
      console.log('📧 Check elbarrioburritos@gmail.com for the test invitation email.');
    } else {
      console.log(`\n❌ FAILED! Error: ${result.error}`);
      if (result.fallback) {
        console.log('📝 Email service fell back to console logging mode.');
      }
    }
    
  } catch (error) {
    console.error('\n💥 ERROR during email test:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  console.log('\n🏁 Test completed.');
  process.exit(0);
}

// Run the test
testInvitationEmail();
