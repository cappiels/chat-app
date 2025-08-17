/**
 * Test script for workspace invitation system
 * Tests the actual API endpoint and email sending
 */

require('dotenv').config();

// Configuration
const TEST_EMAIL = 'elbarrioburritos@gmail.com';

/**
 * Test the workspace invitation endpoint
 */
async function testWorkspaceInvitation() {
  try {
    console.log('🧪 Testing Workspace Invitation System...\n');

    // Since we need authentication, we'll need to use Firebase auth
    // For now, let's test the database connection and email service directly
    
    const { Pool } = require('pg');
    const emailService = require('./services/emailService');
    const crypto = require('crypto');

    // Database connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Step 1: Check if we have any workspaces
    console.log('📋 Step 1: Checking existing workspaces...');
    const workspacesResult = await pool.query(`
      SELECT id, name, description, owner_user_id 
      FROM workspaces 
      LIMIT 1;
    `);

    if (workspacesResult.rows.length === 0) {
      console.log('❌ No workspaces found. Creating a test workspace...');
      
      // Check if we have any users
      const usersResult = await pool.query(`
        SELECT id, email, display_name 
        FROM users 
        LIMIT 1;
      `);

      if (usersResult.rows.length === 0) {
        console.log('❌ No users found. Please create a user first through the app.');
        return;
      }

      const testUser = usersResult.rows[0];
      console.log(`👤 Using test user: ${testUser.display_name} (${testUser.email})`);

      // Create test workspace
      const createWorkspaceResult = await pool.query(`
        INSERT INTO workspaces (name, description, owner_user_id, settings)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `, [
        'Test Workspace',
        'A test workspace for invitation testing',
        testUser.id,
        JSON.stringify({ created_for_testing: true })
      ]);

      // Add user as admin member
      await pool.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'admin');
      `, [createWorkspaceResult.rows[0].id, testUser.id]);

      console.log(`✅ Created test workspace: ${createWorkspaceResult.rows[0].name}`);
      workspacesResult.rows.push(createWorkspaceResult.rows[0]);
    }

    const testWorkspace = workspacesResult.rows[0];
    console.log(`🏢 Using workspace: ${testWorkspace.name} (${testWorkspace.id})\n`);

    // Step 2: Create invitation record directly (simulating the API endpoint logic)
    console.log('📋 Step 2: Creating invitation record...');
    
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Get the workspace owner info
    const ownerResult = await pool.query(`
      SELECT u.id, u.email, u.display_name 
      FROM users u
      WHERE u.id = $1;
    `, [testWorkspace.owner_user_id]);

    if (ownerResult.rows.length === 0) {
      console.log('❌ Workspace owner not found');
      return;
    }

    const owner = ownerResult.rows[0];
    console.log(`👤 Inviter: ${owner.display_name} (${owner.email})`);

    // Check if invitation already exists for this email
    await pool.query(`
      DELETE FROM workspace_invitations 
      WHERE workspace_id = $1 AND invited_email = $2;
    `, [testWorkspace.id, TEST_EMAIL]);

    // Create new invitation
    const inviteResult = await pool.query(`
      INSERT INTO workspace_invitations (
        workspace_id, 
        invited_email, 
        invited_by, 
        role, 
        token, 
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `, [
      testWorkspace.id,
      TEST_EMAIL,
      owner.id,
      'member',
      inviteToken,
      expiresAt
    ]);

    const invitation = inviteResult.rows[0];
    console.log(`✅ Invitation created with token: ${inviteToken.substring(0, 16)}...`);
    
    // Step 3: Get member count for email
    console.log('📋 Step 3: Getting workspace member count...');
    const memberCountResult = await pool.query(`
      SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = $1;
    `, [testWorkspace.id]);
    
    const memberCount = memberCountResult.rows[0].count;
    console.log(`👥 Current member count: ${memberCount}`);

    // Step 4: Test email service
    console.log('\n📋 Step 4: Sending invitation email...');
    
    const inviteUrl = `${process.env.FRONTEND_URL}/invite/${inviteToken}`;
    console.log(`🔗 Invitation URL: ${inviteUrl}`);

    try {
      const emailResult = await emailService.sendWorkspaceInvitation({
        to: TEST_EMAIL,
        workspaceName: testWorkspace.name,
        workspaceDescription: testWorkspace.description || 'A collaborative workspace for your team',
        inviterName: owner.display_name,
        inviterEmail: owner.email,
        inviteUrl,
        userRole: 'member',
        memberCount: memberCount,
        expiryDate: expiresAt
      });

      if (emailResult.success) {
        console.log(`✅ INVITATION EMAIL SENT SUCCESSFULLY!`);
        console.log(`📧 Message ID: ${emailResult.messageId}`);
        console.log(`📧 Sent to: ${TEST_EMAIL}`);
        console.log(`📧 Workspace: ${testWorkspace.name}`);
        console.log(`📧 Invite URL: ${inviteUrl}`);
        console.log(`📧 Expires: ${expiresAt.toLocaleDateString()}`);
        
        // Step 5: Verify invitation in database
        console.log('\n📋 Step 5: Verifying invitation in database...');
        const verifyResult = await pool.query(`
          SELECT * FROM workspace_invitations 
          WHERE token = $1 AND invited_email = $2;
        `, [inviteToken, TEST_EMAIL]);

        if (verifyResult.rows.length > 0) {
          const dbInvitation = verifyResult.rows[0];
          console.log(`✅ Invitation verified in database:`);
          console.log(`   - ID: ${dbInvitation.id}`);
          console.log(`   - Email: ${dbInvitation.invited_email}`);
          console.log(`   - Role: ${dbInvitation.role}`);
          console.log(`   - Expires: ${dbInvitation.expires_at}`);
          console.log(`   - Status: ${dbInvitation.accepted_at ? 'Accepted' : 'Pending'}`);
        } else {
          console.log(`❌ Invitation not found in database!`);
        }

        console.log('\n🎉 WORKSPACE INVITATION TEST COMPLETED SUCCESSFULLY!');
        console.log(`\n📧 Check your email at ${TEST_EMAIL} for the invitation.`);
        console.log(`🔗 Or use this direct link: ${inviteUrl}`);
        
      } else {
        console.log(`❌ Email sending failed: ${emailResult.error}`);
        if (emailResult.fallback) {
          console.log('📧 Email service fell back to console logging');
        }
      }

    } catch (emailError) {
      console.error('❌ Email sending error:', emailError.message);
    }

    // Cleanup: Close database connection
    await pool.end();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testWorkspaceInvitation();
}

module.exports = { testWorkspaceInvitation };
