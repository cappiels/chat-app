const AWS = require('aws-sdk');
require('dotenv').config({ path: './.env' });

// Configure Spaces client
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
  region: process.env.SPACES_REGION,
  s3ForcePathStyle: false,
  signatureVersion: 'v4'
});

console.log('Testing DigitalOcean Spaces Upload...');
console.log('Endpoint:', process.env.SPACES_ENDPOINT);
console.log('Bucket:', process.env.SPACES_BUCKET);
console.log('Key:', process.env.SPACES_KEY);
console.log('Secret:', process.env.SPACES_SECRET ? `${process.env.SPACES_SECRET.substring(0, 10)}...` : 'MISSING');
console.log('Region:', process.env.SPACES_REGION);
console.log('---');

// Test upload
const params = {
  Bucket: process.env.SPACES_BUCKET,
  Key: 'test-upload-' + Date.now() + '.txt',
  Body: 'Test upload from command line',
  ContentType: 'text/plain',
  ACL: 'public-read'
};

console.log('Attempting upload...');
s3.upload(params, (err, data) => {
  if (err) {
    console.error('❌ Upload FAILED:');
    console.error('Error Code:', err.code);
    console.error('Error Message:', err.message);
    console.error('Status Code:', err.statusCode);
    console.error('Full Error:', err);
    process.exit(1);
  } else {
    console.log('✅ Upload SUCCESSFUL!');
    console.log('File URL:', data.Location);
    console.log('Bucket:', data.Bucket);
    console.log('Key:', data.Key);
    process.exit(0);
  }
});
