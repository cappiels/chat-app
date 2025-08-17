/**
 * Simple test to debug routing issues
 */
const axios = require('axios');

const PRODUCTION_URL = 'https://coral-app-rgki8.ondigitalocean.app';

async function testSimple() {
  console.log('🔍 Simple Production Test...\n');
  
  // Test different endpoints one by one
  const tests = [
    { url: `${PRODUCTION_URL}/`, name: 'Home page' },
    { url: `${PRODUCTION_URL}/status`, name: 'Backend status (old path)' },
    { url: `${PRODUCTION_URL}/api/status`, name: 'Backend status (new path)' },
    { url: `${PRODUCTION_URL}/invite/test123`, name: 'Invitation page' },
    { url: `${PRODUCTION_URL}/api/workspaces`, name: 'Workspace API (should be 401)' },
  ];
  
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      const response = await axios.get(test.url, { timeout: 10000 });
      
      if (test.name === 'Home page' || test.name === 'Invitation page') {
        if (response.data.includes('ChatFlow') || response.data.includes('React')) {
          console.log(`✅ ${test.name}: Working (contains React/ChatFlow content)`);
        } else {
          console.log(`⚠️  ${test.name}: Unexpected content`);
        }
      } else {
        console.log(`✅ ${test.name}: Status ${response.status}`);
        if (response.data.status) {
          console.log(`   Status: ${response.data.status}`);
        }
      }
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`✅ ${test.name}: Properly secured (401 auth required)`);
      } else if (error.response?.status === 404) {
        console.log(`❌ ${test.name}: 404 Not Found`);
      } else {
        console.log(`❌ ${test.name}: Error ${error.response?.status || error.message}`);
      }
    }
    console.log(''); // blank line
  }
  
  console.log('🏁 Simple test completed.');
}

testSimple();
