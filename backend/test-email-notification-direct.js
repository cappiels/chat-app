require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmailNotification() {
  console.log('🧪 Testing direct email notification to cappiels@gmail.com');
  
  try {
    // Test direct email sending
    const emailData = {
      to: 'cappiels@gmail.com',
      subject: 'Chat App Email Notification Test (Fixed)',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">💬 Test Email Notification</h2>
          <p>This is a test email notification from your Chat App!</p>
          <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin: 16px 0;">
            <p><strong>Test User</strong> mentioned you in <strong>#general</strong>:</p>
            <p style="color: #6b7280; font-style: italic;">@cappiels This is a test mention to verify email notifications are working correctly!</p>
          </div>
          <div style="margin-top: 24px;">
            <a href="http://localhost:5173" 
               style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View in Chat App
            </a>
          </div>
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            ✅ If you received this email, your Chat App email notification system is working correctly!
          </p>
          <p style="color: #9ca3af; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br>
            Test performed on: ${new Date().toLocaleDateString()}
          </p>
        </div>
      `
    };

    await emailService.sendEmail(emailData);
    
    console.log('✅ Test email sent successfully to cappiels@gmail.com');
    console.log('📧 Please check your email inbox (including spam folder)');
    console.log('🎉 Email notification system is working!');
    
  } catch (error) {
    console.error('❌ Test email failed:', error);
    
    if (error.message.includes('Invalid login')) {
      console.log('💡 This might be an authentication issue with Gmail');
    } else if (error.message.includes('quota')) {
      console.log('💡 This might be a Gmail API quota issue');
    } else {
      console.log('💡 Check your Gmail service account configuration');
    }
  }
  
  process.exit(0);
}

testEmailNotification();
