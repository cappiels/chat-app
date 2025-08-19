#!/usr/bin/env node

/**
 * Test script to specifically test workspace invitation email
 */

require('dotenv').config();
const emailService = require('./services/emailService');

async function testWorkspaceInvitation() {
  console.log('🔍 Testing Workspace Invitation Email...\n');

  try {
    await emailService.ensureInitialized();
    console.log('Email service initialized ✓\n');

    const result = await emailService.sendWorkspaceInvitation({
      to: 'elbarrioburritos@gmail.com',
      workspaceName: 'Test Workspace',
      workspaceDescription: 'This is a test workspace for debugging email delivery',
      inviterName: 'Test Inviter',
      inviterEmail: 'test@example.com',
      inviteUrl: 'https://coral-app-rgki8.ondigitalocean.app/#/invite/test-token-123',
      userRole: 'member',
      memberCount: '2',
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    console.log('Invitation Result:', result);

    if (result.success) {
      console.log('\n✅ Workspace invitation sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('Timestamp:', result.timestamp);
      console.log('\n📝 Next steps for the user:');
      console.log('1. Check your primary inbox for email from cappiels@gmail.com');
      console.log('2. Check your spam/junk folder');
      console.log('3. Check promotions tab (Gmail)');
      console.log('4. Search for subject: "You\'re invited to join Test Workspace on ChatFlow"');
    } else {
      console.log('\n❌ Invitation failed:', result.error);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testWorkspaceInvitation();
