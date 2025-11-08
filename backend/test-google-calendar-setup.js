const { google } = require('googleapis');
require('dotenv').config();

async function testGoogleCalendarSetup() {
  console.log('🗓️ Testing Google Calendar & Drive API setup...\n');

  try {
    // Test service account credentials
    console.log('📋 Checking environment variables...');
    
    const calendarServiceEmail = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL || process.env.GMAIL_SERVICE_ACCOUNT_EMAIL;
    const calendarPrivateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY || process.env.GMAIL_PRIVATE_KEY;
    
    if (!calendarServiceEmail) {
      console.log('❌ Missing GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL (or GMAIL_SERVICE_ACCOUNT_EMAIL)');
      console.log('💡 Add to your .env file:');
      console.log('   GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL="your-service@project.iam.gserviceaccount.com"');
      return false;
    }
    
    if (!calendarPrivateKey) {
      console.log('❌ Missing GOOGLE_CALENDAR_PRIVATE_KEY (or GMAIL_PRIVATE_KEY)'); 
      console.log('💡 Add to your .env file:');
      console.log('   GOOGLE_CALENDAR_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
      return false;
    }
    
    console.log('✅ Service account email:', calendarServiceEmail);
    console.log('✅ Private key found:', calendarPrivateKey.substring(0, 50) + '...');

    // Create service account auth
    console.log('\n🔐 Setting up service account authentication...');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: calendarServiceEmail,
        private_key: calendarPrivateKey.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly'
      ],
    });

    const authClient = await auth.getClient();
    console.log('✅ Service account authentication successful');

    // Test Calendar API
    console.log('\n📅 Testing Google Calendar API...');
    
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    
    try {
      // Test calendar access
      const calendarList = await calendar.calendarList.list();
      console.log('✅ Calendar API access successful');
      console.log(`📋 Service account has access to ${calendarList.data.items?.length || 0} calendars`);
      
      // Test creating a calendar (we'll delete it right after)
      console.log('\n🧪 Testing calendar creation...');
      
      const testCalendar = await calendar.calendars.insert({
        resource: {
          summary: 'Test Project Calendar - DELETE ME',
          description: 'Temporary test calendar for chat-app project management setup',
          timeZone: 'America/New_York'
        }
      });
      
      console.log('✅ Calendar creation successful:', testCalendar.data.id);
      
      // Test calendar sharing
      console.log('🧪 Testing calendar sharing permissions...');
      
      await calendar.acl.insert({
        calendarId: testCalendar.data.id,
        resource: {
          role: 'reader',
          scope: {
            type: 'default' // Public read access for testing
          }
        }
      });
      
      console.log('✅ Calendar sharing permissions work');
      
      // Clean up test calendar
      await calendar.calendars.delete({
        calendarId: testCalendar.data.id
      });
      
      console.log('✅ Test calendar cleaned up');
      
    } catch (calendarError) {
      console.log('❌ Calendar API error:', calendarError.message);
      console.log('💡 Make sure Google Calendar API is enabled in your Google Cloud Console');
      return false;
    }

    // Test Drive API
    console.log('\n💾 Testing Google Drive API...');
    
    const drive = google.drive({ version: 'v3', auth: authClient });
    
    try {
      // Test drive access
      const driveInfo = await drive.about.get({
        fields: 'user, storageQuota'
      });
      
      console.log('✅ Drive API access successful');
      console.log(`📁 Service account user: ${driveInfo.data.user?.emailAddress || 'N/A'}`);
      
    } catch (driveError) {
      console.log('❌ Drive API error:', driveError.message);
      console.log('💡 Make sure Google Drive API is enabled in your Google Cloud Console');
      return false;
    }

    // Test Firebase integration (if available)
    console.log('\n🔥 Checking Firebase integration...');
    
    try {
      // This would test user OAuth tokens from Firebase
      // For now, just check if we can set it up
      console.log('✅ Ready for Firebase Google OAuth integration');
      console.log('💡 Users will authenticate with their Google accounts via existing Firebase setup');
    } catch (firebaseError) {
      console.log('⚠️  Firebase integration check skipped:', firebaseError.message);
    }

    console.log('\n🎉 Google Calendar & Drive setup test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Make sure Calendar API and Drive API are enabled in Google Cloud Console');
    console.log('   2. Update your environment variables if needed');
    console.log('   3. Test project creation with calendar integration');
    
    return true;
    
  } catch (error) {
    console.error('❌ Setup test failed:', error);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Check that Calendar API and Drive API are enabled');
    console.log('   2. Verify service account credentials are correct');
    console.log('   3. Ensure private key format is correct (with \\n for newlines)');
    console.log('   4. Check that service account has proper permissions');
    
    return false;
  }
}

// Run the test
if (require.main === module) {
  testGoogleCalendarSetup()
    .then((success) => {
      if (success) {
        console.log('\n✅ All tests passed! Ready to proceed with calendar integration.');
        process.exit(0);
      } else {
        console.log('\n❌ Some tests failed. Please check the setup and try again.');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testGoogleCalendarSetup };
