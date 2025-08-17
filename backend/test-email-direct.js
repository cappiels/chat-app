/**
 * Direct test script for email service
 * Forces fresh initialization and tests fallback mode
 */

require('dotenv').config();

async function testEmailDirectly() {
  console.log('🧪 Testing Email Service Directly...\n');

  try {
    // Delete the cached module to force fresh initialization
    delete require.cache[require.resolve('./services/emailService')];
    
    // Import fresh email service
    const emailService = require('./services/emailService');

    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test connection
    console.log('1. Testing Gmail connection...');
    const connectionTest = await emailService.testConnection();
    
    if (!connectionTest) {
      console.log('❌ Gmail connection failed. Testing fallback mode...');
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
      inviteUrl: `https://coral-app-rgki8.ondigitalocean.app/invite/test-token-123`,
      userRole: 'member',
      memberCount: 5,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    };

    const result = await emailService.sendWorkspaceInvitation(testInvitation);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Timestamp: ${result.timestamp}`);
      console.log('\n🎉 Check elbarrioburritos@gmail.com for the invitation!');
    } else if (result.fallback) {
      console.log('⚠️  Email service in fallback mode - invitation logged to console');
      console.log('   This means the Gmail OAuth2 needs to be reconfigured, but the system is working!');
      console.log('\n📧 In fallback mode, the invitation details would be:');
      console.log(`   To: ${testInvitation.to}`);
      console.log(`   Subject: 🎉 You're invited to join ${testInvitation.workspaceName} on ChatFlow`);
      console.log(`   Invite URL: ${testInvitation.inviteUrl}`);
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

testEmailDirectly();
