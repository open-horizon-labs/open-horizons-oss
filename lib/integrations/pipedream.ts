import { createBackendClient, type ConnectTokenCreateOpts, type ConnectTokenResponse, type BackendClient } from '@pipedream/sdk/server'

// Lazy initialization to ensure this only runs on the server side
let pd: BackendClient | null = null

function getPipedreamClient(): BackendClient {
  if (!pd) {
    if (typeof window !== 'undefined') {
      throw new Error('Pipedream client cannot be initialized on the client side')
    }

    // Validate environment variables
    if (!process.env.PIPEDREAM_CLIENT_ID || !process.env.PIPEDREAM_CLIENT_SECRET) {
      throw new Error('PIPEDREAM_CLIENT_ID and PIPEDREAM_CLIENT_SECRET environment variables are required')
    }
    if (!process.env.PIPEDREAM_PROJECT_ID) {
      throw new Error('PIPEDREAM_PROJECT_ID environment variable is required')
    }

    pd = createBackendClient({
      projectId: process.env.PIPEDREAM_PROJECT_ID!,
      environment: (process.env.PIPEDREAM_PROJECT_ENVIRONMENT as 'development' | 'production') || 'development',
      credentials: {
        clientId: process.env.PIPEDREAM_CLIENT_ID!,
        clientSecret: process.env.PIPEDREAM_CLIENT_SECRET!,
      },
    })
  }
  return pd
}

export interface PipedreamConnection {
  id: string
  name: string
  service: string
  status: 'active' | 'expired' | 'error'
  metadata?: Record<string, any>
}

export interface PipedreamWorkflow {
  id: string
  name: string
  status: 'active' | 'paused' | 'error'
}

/**
 * Pipedream integration service for Open Horizons
 * Handles OAuth connections, workflow triggers, and data synchronization
 */
export class PipedreamIntegrationService {
  constructor() {
    // Environment variable validation moved to getPipedreamClient()
    // This allows the class to be imported on the client side without errors
  }

  /**
   * Create a Pipedream Connect token for OAuth authentication
   * @param service - The service to connect (e.g., 'google_calendar', 'github')
   * @param userId - The Open Horizons user ID
   */
  async createConnectToken(
    service: string,
    userId: string
  ): Promise<{ url: string; token: string; expiresAt: Date }> {
    try {
      console.log('Creating connect token for service:', service, 'userId:', userId)

      if (!userId) {
        throw new Error('User ID is required to create connect token')
      }

      // Create a Connect token for the user
      const client = getPipedreamClient()
      const response = await client.createConnectToken({
        external_user_id: userId
      })

      console.log('Connect token created successfully:', {
        hasToken: !!response.token,
        hasUrl: !!response.connect_link_url,
        expiresAt: response.expires_at
      })

      return {
        url: response.connect_link_url,
        token: response.token,
        expiresAt: new Date(response.expires_at)
      }
    } catch (error) {
      console.error('Error creating Pipedream Connect token:', error)
      throw new Error(`Failed to create Connect token for ${service}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user accounts for a specific external user ID
   * @param userId - The Open Horizons user ID
   */
  async getUserAccounts(userId: string): Promise<PipedreamConnection[]> {
    try {
      // Use the accounts API to get user accounts
      const accounts = await getPipedreamClient().getAccounts({
        external_user_id: userId,
        include_credentials: false
      })

      return accounts.data.map(account => ({
        id: account.id,
        name: account.name || 'Connected Account',
        service: account.app?.name_slug || 'unknown',
        status: 'active', // Assume active if returned
        metadata: {
          app: account.app?.name_slug
        }
      }))
    } catch (error) {
      console.error('Error getting user accounts:', error)
      return []
    }
  }

  /**
   * Get a specific account by ID
   * @param accountId - The Pipedream account ID
   */
  async getAccount(accountId: string): Promise<PipedreamConnection | null> {
    try {
      const account = await getPipedreamClient().getAccountById(accountId)

      return {
        id: account.id,
        name: account.name || 'Connected Account',
        service: account.app?.name_slug || 'unknown',
        status: 'active', // Assume active if we can fetch it
        metadata: {
          app: account.app?.name_slug
        }
      }
    } catch (error) {
      console.error('Error getting Pipedream account:', error)
      return null
    }
  }

  /**
   * Make a proxied API call through Pipedream Connect
   * @param accountId - The Pipedream account ID
   * @param path - The API path (e.g., '/calendar/v3/users/me/calendarList')
   * @param params - Query parameters
   * @param userId - The external user ID
   */
  async makeProxiedAPICall(accountId: string, path: string, params: Record<string, string> = {}, userId?: string): Promise<any> {
    try {
      const client = getPipedreamClient()

      // Build the full URL with query parameters
      const url = new URL(path, 'https://www.googleapis.com')
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })

      console.log('Making proxied API call to:', url.href)

      // Use the correct Pipedream makeProxyRequest format from documentation
      const response = await client.makeProxyRequest(
        {
          searchParams: {
            account_id: accountId,
            external_user_id: userId || 'unknown' // We may need to pass this from the calling code
          }
        },
        {
          url: url.href,
          options: {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        }
      )

      console.log('Proxy response received:', response ? 'success' : 'no response')
      return response
    } catch (error) {
      console.error('Error making proxied API call:', error)
      throw error
    }
  }

  /**
   * Discover available calendars for a Google Calendar account
   * @param accountId - The Pipedream account ID for Google Calendar
   * @param userId - The external user ID
   */
  async discoverCalendars(accountId: string, userId: string): Promise<any[]> {
    try {
      console.log('Discovering calendars for account:', accountId)

      const data = await this.makeProxiedAPICall(
        accountId,
        '/calendar/v3/users/me/calendarList',
        {},
        userId
      )

      console.log('Calendars discovered:', data?.items?.length || 0, 'calendars')
      return data?.items || []
    } catch (error) {
      console.error('Error discovering calendars:', error)
      return []
    }
  }

  /**
   * Fetch calendar events from Google Calendar via Pipedream Connect
   * @param accountId - The Pipedream account ID for Google Calendar
   * @param calendarId - The calendar ID to fetch from (e.g., 'primary' or email)
   * @param dateStart - Start date (YYYY-MM-DD)
   * @param dateEnd - End date (YYYY-MM-DD)
   * @param userId - The external user ID
   */
  async fetchCalendarEvents(accountId: string, calendarId: string, dateStart: string, dateEnd: string, userId: string): Promise<any[]> {
    try {
      console.log('Fetching calendar events for account:', accountId, 'calendar:', calendarId, 'from', dateStart, 'to', dateEnd)

      const data = await this.makeProxiedAPICall(
        accountId,
        `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          timeMin: `${dateStart}T00:00:00Z`,
          timeMax: `${dateEnd}T23:59:59Z`,
          singleEvents: 'true',
          orderBy: 'startTime'
        },
        userId
      )

      console.log('Calendar events fetched successfully from', calendarId + ':', data?.items?.length || 0, 'events')
      return data?.items || []
    } catch (error) {
      console.error('Error fetching calendar events from', calendarId + ':', error)
      return []
    }
  }

  /**
   * Trigger a Pipedream workflow to sync data for a user
   * @param workflowId - The Pipedream workflow ID
   * @param payload - Data to send to the workflow
   */
  async triggerSync(workflowId: string, payload: Record<string, any>): Promise<{ success: boolean; executionId?: string }> {
    try {
      // TODO: Update this when workflow trigger API is clarified
      // For now, we'll assume this is handled via webhooks from Pipedream side
      console.log('Sync triggered for workflow:', workflowId, 'with payload:', payload)

      return {
        success: true,
        executionId: 'manual-trigger-' + Date.now()
      }
    } catch (error) {
      console.error('Error triggering Pipedream workflow:', error)
      return { success: false }
    }
  }

  /**
   * Get sync workflows for a specific service
   * @param service - The service name (e.g., 'google_calendar')
   */
  async getSyncWorkflows(service: string): Promise<PipedreamWorkflow[]> {
    try {
      // TODO: Update this when workflows API is clarified
      // For now, return empty array - workflows are managed manually in Pipedream
      console.log('Getting sync workflows for service:', service)
      return []
    } catch (error) {
      console.error('Error getting sync workflows:', error)
      return []
    }
  }

  /**
   * Sync calendar events for a specific date range and store in database
   * @param integrationAccountId - The integration account ID from our database
   * @param pipedreamAccountId - The Pipedream account ID
   * @param dateStart - Start date (YYYY-MM-DD)
   * @param dateEnd - End date (YYYY-MM-DD)
   * @param userId - The external user ID
   * @param supabase - Supabase client instance
   */
  async syncCalendarEvents(
    integrationAccountId: string,
    pipedreamAccountId: string,
    dateStart: string,
    dateEnd: string,
    userId: string,
    supabase: any
  ): Promise<{ success: boolean; eventsProcessed: number; error?: string }> {
    try {
      console.log('Starting calendar sync for account:', integrationAccountId)

      // First, discover available calendars
      const calendars = await this.discoverCalendars(pipedreamAccountId, userId)

      if (calendars.length === 0) {
        console.log('No calendars found for account')
        return { success: false, eventsProcessed: 0, error: 'No calendars found' }
      }

      console.log('Found calendars:', calendars.map(cal => ({ id: cal.id, summary: cal.summary, primary: cal.primary })))

      // Try to find primary calendar first, fallback to first available
      let targetCalendar = calendars.find(cal => cal.primary === true) || calendars.find(cal => cal.id === 'primary')
      if (!targetCalendar) {
        targetCalendar = calendars[0] // Use first available calendar
      }

      console.log('Using calendar:', { id: targetCalendar.id, summary: targetCalendar.summary })

      // Fetch events from the target calendar
      const events = await this.fetchCalendarEvents(pipedreamAccountId, targetCalendar.id, dateStart, dateEnd, userId)

      if (events.length === 0) {
        console.log('No events found for date range in calendar:', targetCalendar.id)
        return { success: true, eventsProcessed: 0 }
      }

      console.log('Processing', events.length, 'calendar events from', targetCalendar.summary)

      // Transform and store events in database
      const externalEntities = events.map(event => {
        const startTime = event.start?.dateTime || event.start?.date
        const endTime = event.end?.dateTime || event.end?.date

        return {
          integration_account_id: integrationAccountId,
          external_id: event.id,
          entity_type: 'calendar_event',
          title: event.summary || 'Untitled Event',
          data: {
            summary: event.summary,
            description: event.description,
            location: event.location,
            attendees: event.attendees,
            htmlLink: event.htmlLink,
            status: event.status,
            transparency: event.transparency,
            visibility: event.visibility,
            creator: event.creator,
            organizer: event.organizer,
            recurringEventId: event.recurringEventId,
            originalStartTime: event.originalStartTime,
            calendarSummary: targetCalendar.summary,
            calendarId: targetCalendar.id
          },
          start_time: startTime ? new Date(startTime).toISOString() : null,
          end_time: endTime ? new Date(endTime).toISOString() : null,
          last_synced_at: new Date().toISOString()
        }
      })

      // Upsert events into database
      const { error: upsertError } = await supabase
        .from('external_entities')
        .upsert(externalEntities, {
          onConflict: 'integration_account_id,external_id,entity_type'
        })

      if (upsertError) {
        console.error('Error upserting calendar events:', upsertError)
        return { success: false, eventsProcessed: 0, error: upsertError.message }
      }

      console.log('Successfully synced', events.length, 'calendar events from', targetCalendar.summary)
      return { success: true, eventsProcessed: events.length }
    } catch (error) {
      console.error('Error syncing calendar events:', error)
      return {
        success: false,
        eventsProcessed: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Revoke a Pipedream account
   * @param accountId - The Pipedream account ID
   */
  async revokeAccount(accountId: string): Promise<boolean> {
    try {
      // TODO: Implement account deletion when SDK supports it
      console.log('Revoking account:', accountId)
      return true
    } catch (error) {
      console.error('Error revoking Pipedream account:', error)
      return false
    }
  }

  /**
   * Get Pipedream app name for each service
   * @param service - The service name
   */
  private getAppName(service: string): string {
    const appMap: Record<string, string> = {
      google_calendar: 'google',
      github: 'github',
      slack: 'slack'
    }

    return appMap[service] || service
  }

  /**
   * Get required OAuth scopes for each service
   * @param service - The service name
   */
  private getRequiredScopes(service: string): string[] {
    const scopeMap: Record<string, string[]> = {
      google_calendar: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      github: [
        'repo',
        'user:email',
        'read:user'
      ],
      slack: [
        'channels:read',
        'chat:write',
        'users:read',
        'users:read.email'
      ]
    }

    return scopeMap[service] || []
  }

  /**
   * Validate webhook payload from Pipedream
   * @param payload - The webhook payload
   * @param signature - The webhook signature (if provided)
   */
  validateWebhookPayload(payload: any, signature?: string): boolean {
    // Basic validation - in production, you'd verify the signature
    return !!(payload && payload.user_id && payload.service_name && payload.entities)
  }
}

// Singleton instance
export const pipedreamService = new PipedreamIntegrationService()

// Integration service configurations
export const INTEGRATION_CONFIGS = {
  google_calendar: {
    name: 'Google Calendar',
    description: 'Sync calendar events to provide context in daily logs',
    icon: '📅',
    appSlug: 'google_calendar', // Pipedream app slug
    scopes: ['calendar.readonly'],
    entityTypes: ['calendar_event'],
    syncFrequency: '15m' // Every 15 minutes
  },
  github: {
    name: 'GitHub',
    description: 'Track issues, PRs, and code activity in your daily workflow',
    icon: '🐱',
    appSlug: 'github', // Pipedream app slug
    scopes: ['repo', 'user'],
    entityTypes: ['issue', 'pull_request', 'commit'],
    syncFrequency: '5m'
  },
  slack: {
    name: 'Slack',
    description: 'Surface important messages and threads in daily context',
    icon: '💬',
    appSlug: 'slack', // Pipedream app slug
    scopes: ['channels:read', 'chat:write'],
    entityTypes: ['message', 'thread'],
    syncFrequency: '10m'
  }
} as const

export type IntegrationType = keyof typeof INTEGRATION_CONFIGS