const AWS = require('aws-sdk');
require('dotenv').config({ path: './.env' });

// Configure Spaces client EXACTLY like spacesHelper.js does
// Clear any AWS environment variables that might interfere
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;
delete process.env.AWS_SESSION_TOKEN;

const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
  region: 'us-east-1', // Test with us-east-1 instead of nyc3
  s3ForcePathStyle: false,
  signatureVersion: 'v4'
});

console.log('Testing with PRODUCTION-STYLE path...');
console.log('Key:', process.env.SPACES_KEY);
console.log('Secret:', process.env.SPACES_SECRET ? process.env.SPACES_SECRET.substring(0, 15) + '...' : 'MISSING');
console.log('---');

// Test with the EXACT path structure production uses - SIMPLIFIED
const params = {
  Bucket: process.env.SPACES_BUCKET,
  Key: 'chat-uploads/ai-chat-space/general/' + Date.now() + '-test-Screenshot-2025-11-21-at-12.55.01PM.png',
  Body: 'Test upload with production path structure',
  ContentType: 'image/png',
  ACL: 'public-read'
  // Removed Metadata, CacheControl like spacesHelper now does
};

console.log('Uploading to:', params.Key);
console.log('With metadata:', params.Metadata);

s3.upload(params, (err, data) => {
  if (err) {
    console.error('❌ Upload FAILED:');
    console.error('Error Code:', err.code);
    console.error('Error Message:', err.message);
    console.error('Status Code:', err.statusCode);
    process.exit(1);
  } else {
    console.log('✅ Upload SUCCESSFUL!');
    console.log('File URL:', data.Location);
    process.exit(0);
  }
});
