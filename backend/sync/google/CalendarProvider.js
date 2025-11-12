/**
 * Google Calendar Provider - Production Ready with Expert Fixes
 * Handles Calendar API operations with incremental sync and timezone handling
 */

const { google } = require('googleapis');
const NodeCache = require('node-cache');
const ExponentialBackoff = require('../../utils/backoff');

class CalendarProvider {
  constructor() {
    this.backoff = new ExponentialBackoff({
      baseDelay: 1000,
      maxDelay: 30000,
      maxRetries: 3
    });
    
    // Cache for sync tokens (24 hour TTL)
    this.syncTokenCache = new NodeCache({ stdTTL: 86400 });
    
    // Cache for calendar instances (1 hour TTL)
    this.calendarCache = new NodeCache({ stdTTL: 3600 });
  }

  /**
   * Initialize Google Calendar client with OAuth credentials
   * @param {Object} credentials - User's OAuth credentials
   * @returns {Object} Authenticated Calendar client
   */
  async initializeClient(credentials) {
    const cacheKey = `calendar_${credentials.userId}`;
    let calendar = this.calendarCache.get(cacheKey);
    
    if (!calendar) {
      const auth = new google.auth.OAuth2(
        process.env.GMAIL_OAUTH_CLIENT_ID,
        process.env.GMAIL_OAUTH_CLIENT_SECRET
      );

      auth.setCredentials({
        refresh_token: credentials.refresh_token,
        access_token: credentials.access_token,
        token_type: 'Bearer'
      });

      calendar = google.calendar({ version: 'v3', auth });
      this.calendarCache.set(cacheKey, calendar);
    }

    return calendar;
  }

  /**
   * Get or create per-workspace secondary calendar
   * Expert Fix: Use secondary calendars to avoid spamming primary calendar
   * @param {Object} calendar - Calendar client
   * @param {string} workspaceName - Name of the workspace
   * @returns {string} Calendar ID for the workspace
   */
  async getWorkspaceCalendar(calendar, workspaceName) {
    const calendarSummary = `${workspaceName} Tasks`;
    
    try {
      // First, try to find existing workspace calendar
      const calendarsResponse = await this.backoff.execute(async () => {
        return await calendar.calendarList.list();
      }, { operation: 'list_calendars', workspace: workspaceName });

      const existingCalendar = calendarsResponse.data.items.find(
        cal => cal.summary === calendarSummary && cal.accessRole === 'owner'
      );

      if (existingCalendar) {
        return existingCalendar.id;
      }

      // Create new secondary calendar for this workspace
      const createResponse = await this.backoff.execute(async () => {
        return await calendar.calendars.insert({
          requestBody: {
            summary: calendarSummary,
            description: `Task events for ${workspaceName} workspace`,
            timeZone: 'UTC' // Will be converted to user's timezone for display
          }
        });
      }, { operation: 'create_calendar', workspace: workspaceName });

      console.log(`📅 Created workspace calendar: ${calendarSummary}`);
      return createResponse.data.id;

    } catch (error) {
      console.error('❌ Error managing workspace calendar:', error.message);
      throw error;
    }
  }

  /**
   * Sync task to Google Calendar with expert fixes
   * @param {Object} credentials - User's OAuth credentials  
   * @param {Object} task - Task data with mapping applied
   * @param {string} workspaceName - Workspace name for calendar selection
   * @returns {Object} Created/updated event details
   */
  async syncTaskToCalendar(credentials, task, workspaceName) {
    const calendar = await this.initializeClient(credentials);
    const calendarId = await this.getWorkspaceCalendar(calendar, workspaceName);

    try {
      // Check if event already exists using sourceKey (de-duplication)
      let existingEvent = null;
      if (task.sourceKey) {
        const searchResponse = await this.backoff.execute(async () => {
          return await calendar.events.list({
            calendarId: calendarId,
            privateExtendedProperty: `sourceKey=${task.sourceKey}`,
            singleEvents: true,
            maxResults: 1
          });
        }, { operation: 'search_existing', taskId: task.id });

        existingEvent = searchResponse.data.items[0];
      }

      // Prepare event data with expert fixes
      const eventData = this.prepareEventData(task);

      if (existingEvent) {
        // Update existing event
        const updateResponse = await this.backoff.execute(async () => {
          return await calendar.events.update({
            calendarId: calendarId,
            eventId: existingEvent.id,
            requestBody: eventData
          });
        }, { operation: 'update_event', taskId: task.id });

        console.log(`📅 Updated Calendar event: ${task.title}`);
        return {
          eventId: updateResponse.data.id,
          htmlLink: updateResponse.data.htmlLink,
          operation: 'updated'
        };

      } else {
        // Create new event
        const createResponse = await this.backoff.execute(async () => {
          return await calendar.events.insert({
            calendarId: calendarId,
            requestBody: eventData
          });
        }, { operation: 'create_event', taskId: task.id });

        console.log(`📅 Created Calendar event: ${task.title}`);
        return {
          eventId: createResponse.data.id,
          htmlLink: createResponse.data.htmlLink,
          operation: 'created'
        };
      }

    } catch (error) {
      console.error('❌ Error syncing task to Calendar:', error.message);
      throw error;
    }
  }

  /**
   * Prepare event data with all expert fixes applied
   * @param {Object} task - Mapped task data
   * @returns {Object} Google Calendar event data
   */
  prepareEventData(task) {
    const eventData = {
      summary: task.title,
      description: this.formatEventDescription(task),
      
      // Expert Fix: Proper timezone handling
      start: {
        dateTime: task.startTime,
        timeZone: task.timezone || 'UTC'
      },
      
      // Expert Fix: End-exclusive dates (Google Calendar standard)
      end: {
        dateTime: task.endTime,
        timeZone: task.timezone || 'UTC'
      },

      // Expert Fix: No email notifications to prevent spam
      reminders: {
        useDefault: false,
        overrides: []
      },

      // Expert Fix: No email invitations
      attendees: [],
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,

      // Location field
      location: task.location || '',

      // Extended properties for syncing and tags
      extendedProperties: {
        private: {
          sourceKey: task.sourceKey,
          syncVersion: '1',
          tags: task.tags ? JSON.stringify(task.tags) : ''
        }
      },

      // Color coding based on tags
      colorId: task.colorId || '1' // Default blue
    };

    return eventData;
  }

  /**
   * Format event description with task details and tags
   * @param {Object} task - Task data
   * @returns {string} Formatted description
   */
  formatEventDescription(task) {
    let description = task.notes || task.description || '';
    
    if (task.tags && task.tags.length > 0) {
      const tagsList = task.tags.map(tag => `#${tag}`).join(' ');
      description += `\n\nTags: ${tagsList}`;
    }

    if (task.assignees && task.assignees.length > 0) {
      const assigneesList = task.assignees.join(', ');
      description += `\n\nAssigned to: ${assigneesList}`;
    }

    return description.trim();
  }

  /**
   * Incremental sync using sync tokens for efficiency
   * Expert Fix: Reduces API calls by only fetching changed events
   * @param {Object} credentials - User credentials
   * @param {string} workspaceName - Workspace name
   * @param {string} lastSyncTime - ISO timestamp of last sync
   * @returns {Object} Sync results with changes
   */
  async incrementalSync(credentials, workspaceName, lastSyncTime) {
    const calendar = await this.initializeClient(credentials);
    const calendarId = await this.getWorkspaceCalendar(calendar, workspaceName);
    
    const syncTokenKey = `sync_${credentials.userId}_${workspaceName}`;
    let syncToken = this.syncTokenCache.get(syncTokenKey);

    try {
      const listParams = {
        calendarId: calendarId,
        singleEvents: true,
        maxResults: 250
      };

      // Use sync token for incremental sync, or timeMin for full sync
      if (syncToken) {
        listParams.syncToken = syncToken;
      } else if (lastSyncTime) {
        listParams.timeMin = lastSyncTime;
      }

      const response = await this.backoff.execute(async () => {
        return await calendar.events.list(listParams);
      }, { operation: 'incremental_sync', workspace: workspaceName });

      // Store new sync token for future incremental syncs
      if (response.data.nextSyncToken) {
        this.syncTokenCache.set(syncTokenKey, response.data.nextSyncToken);
      }

      // Filter events that belong to our sync system
      const syncedEvents = response.data.items.filter(event => 
        event.extendedProperties?.private?.sourceKey
      );

      console.log(`📅 Incremental sync found ${syncedEvents.length} changed events`);

      return {
        events: syncedEvents,
        syncToken: response.data.nextSyncToken,
        changes: syncedEvents.length
      };

    } catch (error) {
      // If sync token is invalid, clear it and try full sync
      if (error.message.includes('Sync token is no longer valid')) {
        this.syncTokenCache.del(syncTokenKey);
        console.warn('⚠️ Sync token expired, performing full sync');
        return await this.incrementalSync(credentials, workspaceName, lastSyncTime);
      }
      
      console.error('❌ Error during incremental sync:', error.message);
      throw error;
    }
  }

  /**
   * Delete event from Google Calendar
   * @param {Object} credentials - User credentials
   * @param {string} eventId - Google Calendar event ID
   * @param {string} workspaceName - Workspace name
   * @returns {boolean} Success status
   */
  async deleteEvent(credentials, eventId, workspaceName) {
    const calendar = await this.initializeClient(credentials);
    const calendarId = await this.getWorkspaceCalendar(calendar, workspaceName);

    try {
      await this.backoff.execute(async () => {
        return await calendar.events.delete({
          calendarId: calendarId,
          eventId: eventId
        });
      }, { operation: 'delete_event', eventId: eventId });

      console.log(`📅 Deleted Calendar event: ${eventId}`);
      return true;

    } catch (error) {
      if (error.code === 404) {
        console.warn(`⚠️ Event already deleted: ${eventId}`);
        return true; // Consider it successful
      }
      
      console.error('❌ Error deleting Calendar event:', error.message);
      throw error;
    }
  }

  /**
   * Health check for Calendar API access
   * @param {Object} credentials - User credentials
   * @returns {Object} Health status
   */
  async healthCheck(credentials) {
    try {
      const calendar = await this.initializeClient(credentials);
      
      await this.backoff.execute(async () => {
        return await calendar.calendarList.list({ maxResults: 1 });
      }, { operation: 'health_check' });

      return {
        status: 'healthy',
        service: 'Google Calendar',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Google Calendar',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = CalendarProvider;
