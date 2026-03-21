import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '../supabaseClient'

// Browser-side Pipedream SDK imports
let createFrontendClient: any = null
let BrowserClient: any = null

// Lazy load the browser SDK to avoid SSR issues
const loadPipedreamBrowserSDK = async () => {
  if (typeof window !== 'undefined' && !createFrontendClient) {
    const sdk = await import('@pipedream/sdk/browser')
    createFrontendClient = sdk.createFrontendClient
    BrowserClient = sdk.BrowserClient
  }
  return { createFrontendClient, BrowserClient }
}

export interface IntegrationAccount {
  id: string
  service_name: string
  external_account_id: string
  account_info: {
    name?: string
    email?: string
    avatar?: string
    connected_at?: string
  }
  status: 'active' | 'expired' | 'revoked' | 'error'
  created_at: string
  updated_at: string
}

export interface ExternalContext {
  date: string
  context: Record<string, any[]>
  totalItems: number
}

/**
 * Hook for managing external integrations
 */
export function useIntegrations() {
  const [accounts, setAccounts] = useState<IntegrationAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const supabase = supabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    getUser()
  }, [])

  // Fetch all integration accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('Fetching integration accounts...')
      const response = await fetch('/api/integrations')

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch integrations:', response.status, errorData)
        throw new Error(errorData.error || 'Failed to fetch integrations')
      }

      const data = await response.json()
      console.log('Integration accounts fetched successfully:', data.accounts?.length || 0, 'accounts')
      setAccounts(data.accounts || [])
    } catch (err) {
      console.error('Error in fetchAccounts:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Connect a new service using Pipedream Connect frontend SDK
  const connectService = useCallback(async (serviceName: string) => {
    try {
      setError(null)

      // Ensure we have a user ID
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // Step 1: Create a connect token
      const response = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_name: serviceName
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create connect token')
      }

      const { token, expires_at } = await response.json()

      // Step 2: Load browser SDK and create client
      console.log('Loading Pipedream browser SDK...')
      const { createFrontendClient } = await loadPipedreamBrowserSDK()

      if (!createFrontendClient) {
        console.error('createFrontendClient is null after loading SDK')
        throw new Error('Failed to load Pipedream browser SDK')
      }

      console.log('Pipedream browser SDK loaded successfully')

      const pd = createFrontendClient({
        tokenCallback: async () => ({
          token,
          expires_at
        }),
        externalUserId: userId
      })

      // Step 3: Get the correct app slug and use connectAccount for app-specific connection
      const { INTEGRATION_CONFIGS } = await import('../integrations/pipedream')
      const config = INTEGRATION_CONFIGS[serviceName as keyof typeof INTEGRATION_CONFIGS]

      if (!config) {
        throw new Error(`Unknown service: ${serviceName}`)
      }

      return new Promise((resolve, reject) => {
        pd.connectAccount({
          app: config.appSlug, // Use the correct Pipedream app slug
          onSuccess: async ({ id: accountId }: { id: string }) => {
            console.log('✅ Connection successful!', { accountId, service: serviceName })

            // Refresh accounts to show the new connection
            await fetchAccounts()

            resolve({ accountId, service: serviceName })
          },
          onError: (error: Error) => {
            console.error('❌ Connection error:', error)
            setError(error.message || 'Connection failed')
            reject(error)
          },
          onClose: (status: { successful: boolean; completed: boolean }) => {
            console.log('🚪 Connection dialog closed:', status)
            if (!status.successful && !status.completed) {
              // User cancelled
              reject(new Error('Connection cancelled by user'))
            }
          }
        })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    }
  }, [fetchAccounts, userId])

  // Disconnect a service
  const disconnectService = useCallback(async (serviceName: string) => {
    try {
      setError(null)

      const response = await fetch(`/api/integrations/${serviceName}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect service')
      }

      // Refresh accounts list
      await fetchAccounts()

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    }
  }, [fetchAccounts])

  // Get external context for a specific date
  const getExternalContext = useCallback(async (date: string): Promise<ExternalContext | null> => {
    try {
      const response = await fetch(`/api/integrations/external-context?date=${date}`)
      if (!response.ok) {
        throw new Error('Failed to fetch external context')
      }

      return await response.json()
    } catch (err) {
      console.error('Error fetching external context:', err)
      return null
    }
  }, [])

  // Trigger manual sync for a service
  const triggerSync = useCallback(async (serviceName: string, force = false) => {
    try {
      const response = await fetch('/api/integrations/external-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_name: serviceName,
          force
        })
      })

      if (!response.ok) {
        throw new Error('Failed to trigger sync')
      }

      return await response.json()
    } catch (err) {
      console.error('Error triggering sync:', err)
      throw err
    }
  }, [])

  // Check if a service is connected
  const isServiceConnected = useCallback((serviceName: string): boolean => {
    return accounts.some(account =>
      account.service_name === serviceName && account.status === 'active'
    )
  }, [accounts])

  // Get account details for a service
  const getServiceAccount = useCallback((serviceName: string): IntegrationAccount | null => {
    return accounts.find(account => account.service_name === serviceName) || null
  }, [accounts])

  // Initial fetch
  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // No longer needed - OAuth is handled directly by the SDK

  return {
    // State
    accounts,
    loading,
    error,

    // Actions
    connectService,
    disconnectService,
    refreshAccounts: fetchAccounts,
    getExternalContext,
    triggerSync,

    // Helpers
    isServiceConnected,
    getServiceAccount
  }
}

/**
 * Hook for getting external context for a specific date
 */
export function useExternalContext(date: string) {
  const [context, setContext] = useState<ExternalContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContext = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/integrations/external-context?date=${date}`)
      if (!response.ok) {
        throw new Error('Failed to fetch external context')
      }

      const data = await response.json()
      setContext(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setContext(null)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchContext()
  }, [fetchContext])

  return {
    context,
    loading,
    error,
    refresh: fetchContext
  }
}