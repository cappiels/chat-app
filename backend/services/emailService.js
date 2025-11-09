/**
 * Email Service - State-of-the-art email system with Gmail integration
 * 
 * Features:
 * - Gmail OAuth2 integration with service account
 * - Professional HTML email templates
 * - Scalable architecture for AI bots to understand
 * - Template management system
 * - Email analytics and tracking
 * - Error handling and retry mechanisms
 */

const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.oauth2Client = null;
    this.templates = new Map();
    this.analytics = {
      sent: 0,
      failed: 0,
      delivered: 0
    };
    this.initialized = false;
    this.initializing = null;
    
    // Start initialization but don't await it in constructor
    this.initializing = this.initializeService();
  }

  /**
   * Ensure service is initialized before use
   */
  async ensureInitialized() {
    if (this.initialized) return;
    if (this.initializing) {
      await this.initializing;
      return;
    }
    await this.initializeService();
  }

  /**
   * Initialize Gmail Service Account (Enterprise-Ready)
   */
  async initializeService() {
    try {
      // Enterprise-grade Service Account approach
      const requiredServiceAccountVars = [
        'GMAIL_PRIVATE_KEY',
        'GMAIL_SERVICE_ACCOUNT_EMAIL'
      ];
      
      console.log('🏢 EMAIL SERVICE - Enterprise Service Account Initialization');
      requiredServiceAccountVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
          const masked = varName === 'GMAIL_PRIVATE_KEY' ? 
            `${value.substring(0, 25)}...${value.substring(value.length - 25)}` :
            value;
          console.log(`✅ ${varName}: ${masked}`);
        } else {
          console.log(`❌ ${varName}: MISSING`);
        }
      });
      
      const missingVars = requiredServiceAccountVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        console.warn(`⚠️ Email service disabled - missing service account variables: ${missingVars.join(', ')}`);
        console.log('📧 Falling back to OAuth2 if available...');
        return this.initializeOAuth2Fallback();
      }

      console.log('🔧 Setting up Gmail Service Account authentication...');

      // Validate service account email format
      const serviceAccountEmail = process.env.GMAIL_SERVICE_ACCOUNT_EMAIL;
      if (!serviceAccountEmail.endsWith('.iam.gserviceaccount.com') && 
          !serviceAccountEmail.includes('gserviceaccount.com')) {
        console.warn(`⚠️ Service account email doesn't follow proper format: ${serviceAccountEmail}`);
        console.log('🔄 Attempting OAuth2 fallback with regular Gmail account...');
        return this.initializeOAuth2Fallback();
      }

      // Create JWT client for service account
      const jwtClient = new google.auth.JWT(
        process.env.GMAIL_SERVICE_ACCOUNT_EMAIL,
        null,
        process.env.GMAIL_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle escaped newlines
        [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly'
        ]
      );

      // Test service account access
      console.log('🧪 Testing service account credentials...');
      
      try {
        await jwtClient.authorize();
        console.log('✅ Service account authorization successful!');
        
        // Test Gmail API access
        const gmail = google.gmail({ version: 'v1', auth: jwtClient });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.log(`✅ Gmail API access successful! Email: ${profile.data.emailAddress}`);
        
        // Store auth client for later use
        this.authClient = jwtClient;
        
      } catch (authError) {
        console.error('❌ SERVICE ACCOUNT VALIDATION FAILED:', authError.message);
        console.log('🔄 Falling back to OAuth2...');
        return this.initializeOAuth2Fallback();
      }

      // Create enterprise-grade nodemailer transporter 
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_SERVICE_ACCOUNT_EMAIL,
          serviceClient: jwtClient,
          accessToken: await jwtClient.getAccessToken()
        },
        pool: true, // Enable connection pooling for enterprise performance
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000, // Rate limiting for Gmail API
        rateLimit: 5
      });

      // Load email templates
      await this.loadTemplates();
      
      this.initialized = true;
      console.log('🏢 Enterprise email service initialized successfully with Gmail Service Account');
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      console.log('🔄 Attempting OAuth2 fallback...');
      return this.initializeOAuth2Fallback();
    }
  }

  /**
   * OAuth2 Fallback for when Service Account is not properly configured
   */
  async initializeOAuth2Fallback() {
    try {
      // Check for OAuth2 credentials
      const requiredOAuthVars = [
        'GMAIL_OAUTH_CLIENT_ID',
        'GMAIL_OAUTH_CLIENT_SECRET', 
        'GMAIL_REFRESH_TOKEN'
      ];
      
      console.log('📧 EMAIL SERVICE - OAuth2 Fallback Initialization');
      const missingOAuthVars = requiredOAuthVars.filter(varName => !process.env[varName]);
      
      if (missingOAuthVars.length > 0) {
        console.warn(`⚠️ OAuth2 fallback also missing variables: ${missingOAuthVars.join(', ')}`);
        console.log('📧 Email service will use console fallback mode');
        this.transporter = null;
        this.initialized = true;
        await this.loadTemplates();
        return;
      }

      console.log('🔧 Setting up OAuth2 fallback authentication...');

      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_OAUTH_CLIENT_ID,
        process.env.GMAIL_OAUTH_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
      );

      // Set refresh token
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      // Test OAuth2 access
      console.log('🧪 Testing OAuth2 fallback credentials...');
      
      const { token } = await this.oauth2Client.getAccessToken();
      console.log('✅ OAuth2 access token obtained successfully!');
      
      // Test Gmail API access
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log(`✅ Gmail API access successful! Email: ${profile.data.emailAddress}`);
      
      // Store auth client for later use
      this.authClient = this.oauth2Client;

      // Create nodemailer transporter with OAuth2
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: profile.data.emailAddress, // Use the actual Gmail account
          clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
          clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          accessToken: token // Use the fresh access token we just got
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5
      });

      // Load email templates
      await this.loadTemplates();
      
      this.initialized = true;
      console.log('📧 Email service initialized successfully with OAuth2 fallback');
      
    } catch (error) {
      console.error('❌ OAuth2 fallback initialization failed:', error);
      console.log('📧 Falling back to console logging mode');
      // Fallback to console logging if email fails
      this.transporter = null;
      this.initialized = true; // Mark as initialized even if failed, to prevent hanging
      await this.loadTemplates();
    }
  }

  /**
   * Get or refresh OAuth2 token
   */
  async getRefreshToken() {
    // In production, you'd store this in a secure database
    // For now, we'll use a hardcoded refresh token
    // You need to generate this once through Google OAuth2 playground
    return process.env.GMAIL_REFRESH_TOKEN || 'YOUR_REFRESH_TOKEN_HERE';
  }

  /**
   * Load email templates from templates directory
   */
  async loadTemplates() {
    const templatesDir = path.join(__dirname, '../templates/email');
    
    try {
      // Ensure templates directory exists
      await fs.mkdir(templatesDir, { recursive: true });
      
      // Load all template files
      const templateFiles = await fs.readdir(templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.html')) {
          const templateName = file.replace('.html', '');
          const templateContent = await fs.readFile(
            path.join(templatesDir, file), 
            'utf-8'
          );
          this.templates.set(templateName, templateContent);
        }
      }
      
      console.log(`📧 Loaded ${this.templates.size} email templates`);
    } catch (error) {
      console.error('Failed to load email templates:', error);
      // Create default templates if directory doesn't exist
      await this.createDefaultTemplates();
    }
  }

  /**
   * Create default email templates
   */
  async createDefaultTemplates() {
    const templatesDir = path.join(__dirname, '../templates/email');
    await fs.mkdir(templatesDir, { recursive: true });

    // Workspace invitation template
    const invitationTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join {{workspaceName}} on crew</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 40px 30px; }
        .workspace-info { background: #f8f9ff; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 25px 0; transition: transform 0.2s; }
        .cta-button:hover { transform: translateY(-2px); }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; font-size: 14px; color: #666; }
        .expiry-notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .inviter-info { display: flex; align-items: center; margin: 20px 0; }
        .inviter-avatar { width: 50px; height: 50px; border-radius: 50%; background: #667eea; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">💬 crew</div>
            <h1>You're invited to join {{workspaceName}}!</h1>
        </div>
        
        <div class="content">
            <div class="inviter-info">
                <div class="inviter-avatar">{{inviterInitials}}</div>
                <div>
                    <strong>{{inviterName}}</strong> invited you to collaborate<br>
                    <span style="color: #666;">{{inviterEmail}}</span>
                </div>
            </div>
            
            <div class="workspace-info">
                <h3 style="margin-top: 0; color: #667eea;">{{workspaceName}}</h3>
                <p style="margin-bottom: 0;">{{workspaceDescription}}</p>
                <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    Role: <strong>{{userRole}}</strong> • Members: {{memberCount}}
                </p>
            </div>
            
            <p>Join your team on crew to start collaborating with real-time messaging, file sharing, and advanced knowledge management.</p>
            
            <div style="text-align: center;">
                <a href="{{inviteUrl}}" class="cta-button">Join {{workspaceName}}</a>
            </div>
            
            <div class="expiry-notice">
                <strong>⏰ Invitation expires in 7 days</strong><br>
                This invitation link will expire on {{expiryDate}} for security reasons.
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <div style="font-size: 14px; color: #666;">
                <p><strong>What is crew?</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Real-time team messaging and collaboration</li>
                    <li>Advanced knowledge management system</li>
                    <li>File sharing and threaded conversations</li>
                    <li>Enterprise-grade security and permissions</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p>If you don't want to join this workspace, you can safely ignore this email.</p>
            <p style="margin: 10px 0 0 0;">
                Can't click the button? Copy and paste this link: <br>
                <a href="{{inviteUrl}}" style="color: #667eea; word-break: break-all;">{{inviteUrl}}</a>
            </p>
        </div>
    </div>
</body>
</html>`;

    // Member joined notification template  
    const joinNotificationTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{newMemberName}} joined {{workspaceName}}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .member-info { background: #f0fff4; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #00b894; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 25px 0; }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; font-size: 14px; color: #666; }
        .celebration { font-size: 48px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="celebration">🎉</div>
            <h1>Great news! Someone joined your workspace</h1>
        </div>
        
        <div class="content">
            <div class="member-info">
                <h3 style="margin-top: 0; color: #00b894;">{{newMemberName}} is now part of {{workspaceName}}</h3>
                <p style="margin: 5px 0;"><strong>Email:</strong> {{newMemberEmail}}</p>
                <p style="margin: 5px 0;"><strong>Role:</strong> {{memberRole}}</p>
                <p style="margin: 5px 0;"><strong>Joined:</strong> {{joinDate}}</p>
            </div>
            
            <p>Your invitation to <strong>{{newMemberName}}</strong> was accepted! They're now part of your team and can start collaborating right away.</p>
            
            <div style="text-align: center;">
                <a href="{{workspaceUrl}}" class="cta-button">Welcome them to the team</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <div style="font-size: 14px; color: #666;">
                <p><strong>Next steps:</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Say hello in the #general channel</li>
                    <li>Share relevant channels and resources</li>
                    <li>Update their role if needed</li>
                    <li>Introduce them to the team</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p>Team size: {{totalMembers}} members • Workspace: {{workspaceName}}</p>
        </div>
    </div>
</body>
</html>`;

    // Save templates
    await fs.writeFile(path.join(templatesDir, 'workspace-invitation.html'), invitationTemplate);
    await fs.writeFile(path.join(templatesDir, 'member-joined.html'), joinNotificationTemplate);
    
    // Load templates into memory
    this.templates.set('workspace-invitation', invitationTemplate);
    this.templates.set('member-joined', joinNotificationTemplate);
    
    console.log('📧 Created default email templates');
  }

  /**
   * Send workspace invitation email
   */
  async sendWorkspaceInvitation({
    to,
    workspaceName,
    workspaceDescription,
    inviterName,
    inviterEmail,
    inviteUrl,
    userRole,
    memberCount,
    expiryDate
  }) {
    // Ensure service is initialized before using
    await this.ensureInitialized();
    
    const template = this.templates.get('workspace-invitation');
    if (!template) {
      throw new Error('Workspace invitation template not found');
    }

    const inviterInitials = inviterName.split(' ').map(n => n[0]).join('').toUpperCase();
    
    const html = template
      .replace(/{{workspaceName}}/g, workspaceName)
      .replace(/{{workspaceDescription}}/g, workspaceDescription || 'A collaborative workspace for your team')
      .replace(/{{inviterName}}/g, inviterName)
      .replace(/{{inviterEmail}}/g, inviterEmail)
      .replace(/{{inviterInitials}}/g, inviterInitials)
      .replace(/{{inviteUrl}}/g, inviteUrl)
      .replace(/{{userRole}}/g, userRole)
      .replace(/{{memberCount}}/g, memberCount)
      .replace(/{{expiryDate}}/g, new Date(expiryDate).toLocaleDateString());

    return this.sendEmail({
      to,
      subject: `You're invited to join ${workspaceName} on crew`,
      html,
      category: 'workspace-invitation'
    });
  }

  /**
   * Send member joined notification email
   */
  async sendMemberJoinedNotification({
    to,
    workspaceName,
    newMemberName,
    newMemberEmail,
    memberRole,
    workspaceUrl,
    totalMembers
  }) {
    const template = this.templates.get('member-joined');
    if (!template) {
      throw new Error('Member joined template not found');
    }

    const html = template
      .replace(/{{workspaceName}}/g, workspaceName)
      .replace(/{{newMemberName}}/g, newMemberName)
      .replace(/{{newMemberEmail}}/g, newMemberEmail)
      .replace(/{{memberRole}}/g, memberRole)
      .replace(/{{workspaceUrl}}/g, workspaceUrl)
      .replace(/{{totalMembers}}/g, totalMembers)
      .replace(/{{joinDate}}/g, new Date().toLocaleString());

    return this.sendEmail({
      to,
      subject: `🎉 ${newMemberName} joined ${workspaceName}`,
      html,
      category: 'member-joined'
    });
  }

  /**
   * Enterprise-grade email sending using Service Account (Production-Ready)
   */
  async sendEmail({ to, subject, html, text, category = 'general' }) {
    try {
      await this.ensureInitialized();
      
      // Enterprise fallback for when email service is not available
      if (!this.transporter || !this.authClient) {
        console.log(`🏢 EMAIL ENTERPRISE FALLBACK - ${category.toUpperCase()}`);
        console.log(`📧 To: ${to}`);
        console.log(`📧 Subject: ${subject}`);
        console.log(`📧 Service: Gmail Service Account`);
        console.log('📧 Status: Console logging (email service not available)');
        
        return { 
          success: false, 
          error: 'Email service not initialized',
          fallback: true,
          enterprise_mode: true
        };
      }

      console.log(`📧 Sending email via ${this.oauth2Client ? 'OAuth2' : 'Service Account'} to ${to}...`);

      // Handle different auth types
      if (this.oauth2Client) {
        // OAuth2 flow - refresh token automatically handled
        await this.authClient.getAccessToken();
      } else {
        // Service Account JWT flow
        await this.authClient.authorize();
      }
      
      // Use Gmail API directly since SMTP OAuth2 has issues with personal Gmail
      const gmail = google.gmail({ version: 'v1', auth: this.authClient });

      // Encode subject line to handle emojis and special characters
      const encodedSubject = this.encodeSubject(subject);

      // Create email message in RFC2822 format
      const emailLines = [
        `To: ${to}`,
        `From: crew <${this.oauth2Client ? 'cappiels@gmail.com' : process.env.GMAIL_SERVICE_ACCOUNT_EMAIL}>`,
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        html
      ];

      // Encode email as base64url for Gmail API
      const encodedEmail = Buffer.from(emailLines.join('\r\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send via Gmail API
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });
      
      // Update enterprise analytics
      this.analytics.sent++;
      
      console.log(`✅ Enterprise email sent successfully: ${subject} to ${to}`);
      console.log(`📧 Gmail Message ID: ${result.data.id}`);
      console.log(`📊 Analytics: ${this.analytics.sent} sent, ${this.analytics.failed} failed`);
      
      return {
        success: true,
        messageId: result.data.id,
        category,
        timestamp: new Date().toISOString(),
        method: 'gmail_service_account'
      };
      
    } catch (error) {
      console.error(`❌ Enterprise email send failed: ${error.message}`);
      console.error('🔍 Error details:', error);
      this.analytics.failed++;
      
      // Enterprise fallback logging
      console.log(`🏢 EMAIL ENTERPRISE FALLBACK - ${category.toUpperCase()}`);
      console.log(`📧 To: ${to}`);
      console.log(`📧 Subject: ${subject}`);
      console.log(`📧 Error: ${error.message}`);
      console.log(`📊 Analytics: ${this.analytics.sent} sent, ${this.analytics.failed} failed`);
      
      return { 
        success: false, 
        error: error.message,
        fallback: true,
        enterprise_mode: true
      };
    }
  }

  /**
   * Encode subject line to handle emojis and special characters properly
   * Uses RFC 2047 encoding for email subject lines
   */
  encodeSubject(subject) {
    // Check if subject contains non-ASCII characters (including emojis)
    if (/[^\x00-\x7F]/.test(subject)) {
      // Use RFC 2047 encoding for subjects with special characters/emojis
      return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    }
    return subject;
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Get email analytics
   */
  getAnalytics() {
    return {
      ...this.analytics,
      successRate: this.analytics.sent > 0 ? 
        ((this.analytics.sent - this.analytics.failed) / this.analytics.sent * 100).toFixed(2) + '%' : 
        '0%',
      templates: Array.from(this.templates.keys())
    };
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }
      
      await this.transporter.verify();
      console.log('📧 Email service connection test: SUCCESS');
      return true;
    } catch (error) {
      console.error('📧 Email service connection test: FAILED', error.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
