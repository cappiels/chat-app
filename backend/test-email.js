/**
 * Test script for email service
 * Tests Gmail OAuth2 connection and sends a test invitation
 */

require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');

  try {
    // Test connection
    console.log('1. Testing Gmail connection...');
    const connectionTest = await emailService.testConnection();
    
    if (!connectionTest) {
      console.log('❌ Gmail connection failed. Using fallback mode.');
    } else {
      console.log('✅ Gmail connection successful!');
    }

    // Send test invitation
    console.log('\n2. Sending test invitation to elbarrioburritos@gmail.com...');
    
    const testInvitation = {
      to: 'elbarrioburritos@gmail.com',
      workspaceName: 'Test Workspace',
      workspaceDescription: 'A test workspace for debugging email invitations',
      inviterName: 'Steven (Chat App Developer)',
      inviterEmail: 'stevencappiello@gmail.com',
      inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/test-token-123`,
      userRole: 'member',
      memberCount: 5,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    };

    const result = await emailService.sendWorkspaceInvitation(testInvitation);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Timestamp: ${result.timestamp}`);
    } else if (result.fallback) {
      console.log('⚠️  Email service in fallback mode - invitation logged to console');
      console.log('   This means the Gmail OAuth2 setup needs attention');
    } else {
      console.log('❌ Email send failed:', result.error);
    }

    // Show analytics
    console.log('\n3. Email Service Analytics:');
    const analytics = emailService.getAnalytics();
    console.log(JSON.stringify(analytics, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('\n🏁 Test completed');
  process.exit(0);
}

testEmailService();
