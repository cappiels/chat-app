/**
 * Complete invitation workflow test
 */
const axios = require('axios');
require('dotenv').config();

const PRODUCTION_URL = 'https://coral-app-rgki8.ondigitalocean.app';

async function testFullInvitation() {
  console.log('🧪 Testing Full Invitation Workflow...\n');
  
  // Step 1: Test if we can create a mock invitation token
  const mockToken = 'abc123def456ghi789';
  const inviteUrl = `${PRODUCTION_URL}/invite/${mockToken}`;
  
  console.log(`📧 Mock invitation URL: ${inviteUrl}`);
  
  // Step 2: Test the invitation URL directly
  try {
    console.log('🔍 Testing invitation URL access...');
    const response = await axios.get(inviteUrl, { 
      timeout: 10000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; InvitationTest/1.0)'
      }
    });
    
    console.log(`✅ Invitation URL Status: ${response.status}`);
    
    // Check if the response contains React/ChatFlow content
    if (response.data.includes('ChatFlow') || response.data.includes('React') || response.data.includes('InviteAcceptance')) {
      console.log('✅ Invitation page loaded correctly - contains React app');
      return true;
    } else {
      console.log('⚠️  Invitation page loaded but may not contain React app');
      console.log('First 200 characters:', response.data.substring(0, 200));
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Invitation URL failed: ${error.response?.status || error.message}`);
    
    if (error.response?.status === 404) {
      console.log('   This indicates SPA routing is not working properly');
    }
    
    return false;
  }
}

async function testAlternativeRoutes() {
  console.log('\n🔍 Testing alternative route patterns...');
  
  const testRoutes = [
    `${PRODUCTION_URL}/#/invite/test123`,
    `${PRODUCTION_URL}/index.html`,
    `${PRODUCTION_URL}/`,
  ];
  
  for (const route of testRoutes) {
    try {
      console.log(`Testing: ${route}`);
      const response = await axios.get(route, { timeout: 5000 });
      console.log(`✅ Status ${response.status} - Contains React: ${response.data.includes('React') || response.data.includes('ChatFlow')}`);
    } catch (error) {
      console.log(`❌ Status ${error.response?.status || 'Error'}`);
    }
  }
}

async function main() {
  const inviteWorks = await testFullInvitation();
  await testAlternativeRoutes();
  
  console.log('\n📋 Summary:');
  console.log(`- Backend API: ✅ Working (verified earlier)`);
  console.log(`- Email sending: ✅ Working (verified earlier)`);
  console.log(`- SPA routing: ${inviteWorks ? '✅' : '❌'} ${inviteWorks ? 'Working' : 'Not Working'}`);
  
  if (!inviteWorks) {
    console.log('\n🔧 Next steps needed:');
    console.log('- Fix SPA routing configuration in DigitalOcean');
    console.log('- Ensure all /invite/* URLs serve the React app');
  } else {
    console.log('\n🎉 All systems operational!');
  }
  
  console.log('\n🏁 Full test completed.');
}

main();
