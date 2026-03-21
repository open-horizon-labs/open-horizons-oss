'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useIntegrations } from '../../../lib/hooks/useIntegrations'
import { INTEGRATION_CONFIGS, IntegrationType } from '../../../lib/integrations/pipedream'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Badge } from 'primereact/badge'
import { Dialog } from 'primereact/dialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Message } from 'primereact/message'
import { Divider } from 'primereact/divider'

export function IntegrationsClient() {
  const {
    accounts,
    loading,
    error,
    connectService,
    disconnectService,
    isServiceConnected,
    getServiceAccount,
    triggerSync
  } = useIntegrations()

  const [connectingService, setConnectingService] = useState<string | null>(null)
  const [syncingService, setSyncingService] = useState<string | null>(null)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState<string | null>(null)

  const handleConnect = async (serviceName: string) => {
    try {
      setConnectingService(serviceName)
      await connectService(serviceName)
    } catch (err) {
      console.error('Failed to connect service:', err)
    } finally {
      setConnectingService(null)
    }
  }

  const handleDisconnect = async (serviceName: string) => {
    try {
      await disconnectService(serviceName)
      setShowDisconnectDialog(null)
    } catch (err) {
      console.error('Failed to disconnect service:', err)
    }
  }

  const handleSync = async (serviceName: string) => {
    try {
      setSyncingService(serviceName)
      await triggerSync(serviceName, true)
    } catch (err) {
      console.error('Failed to sync service:', err)
    } finally {
      setSyncingService(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <ProgressSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <Message
        severity="error"
        text={`Failed to load integrations: ${error}`}
        className="w-full"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Available Integrations */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Integrations</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(INTEGRATION_CONFIGS).map(([serviceKey, config]) => {
            const isConnected = isServiceConnected(serviceKey)
            const account = getServiceAccount(serviceKey)
            const isConnecting = connectingService === serviceKey
            const isSyncing = syncingService === serviceKey

            return (
              <Card key={serviceKey} className="h-full">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold">{config.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {isConnected ? (
                          <Badge value="Connected" severity="success" />
                        ) : (
                          <Badge value="Not Connected" severity="secondary" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 flex-1">
                    {config.description}
                  </p>

                  {/* Connection Info */}
                  {isConnected && account && (
                    <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        {account.account_info.avatar && (
                          <Image
                            src={account.account_info.avatar}
                            alt=""
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-medium">
                            {account.account_info.name || 'Connected Account'}
                          </div>
                          {account.account_info.email && (
                            <div className="text-gray-500">
                              {account.account_info.email}
                            </div>
                          )}
                        </div>
                      </div>
                      {account.account_info.connected_at && (
                        <div className="text-gray-500 mt-1">
                          Connected {new Date(account.account_info.connected_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {isConnected ? (
                      <>
                        <Button
                          label="Sync Now"
                          icon="pi pi-refresh"
                          size="small"
                          outlined
                          loading={isSyncing}
                          onClick={() => handleSync(serviceKey)}
                          className="flex-1"
                        />
                        <Button
                          label="Disconnect"
                          icon="pi pi-times"
                          size="small"
                          severity="danger"
                          outlined
                          onClick={() => setShowDisconnectDialog(serviceKey)}
                        />
                      </>
                    ) : (
                      <Button
                        label="Connect"
                        icon="pi pi-link"
                        size="small"
                        loading={isConnecting}
                        onClick={() => handleConnect(serviceKey)}
                        className="w-full"
                      />
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Connected Services Summary */}
      {accounts.filter(a => a.status === 'active').length > 0 && (
        <>
          <Divider />
          <div>
            <h2 className="text-lg font-semibold mb-4">Connected Services</h2>
            <div className="grid gap-3">
              {accounts
                .filter(account => account.status === 'active')
                .map(account => {
                  const config = INTEGRATION_CONFIGS[account.service_name as IntegrationType]
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{config?.icon || '🔗'}</span>
                        <div>
                          <div className="font-medium">
                            {config?.name || account.service_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {account.account_info.name || account.external_account_id}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          value={`Syncs every ${config?.syncFrequency || '15m'}`}
                          severity="info"
                        />
                        <Button
                          icon="pi pi-cog"
                          size="small"
                          text
                          rounded
                          onClick={() => handleSync(account.service_name)}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </>
      )}

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        header="Disconnect Integration"
        visible={!!showDisconnectDialog}
        onHide={() => setShowDisconnectDialog(null)}
        style={{ width: '400px' }}
      >
        <div className="space-y-4">
          <p>
            Are you sure you want to disconnect{' '}
            <strong>
              {showDisconnectDialog && INTEGRATION_CONFIGS[showDisconnectDialog as IntegrationType]?.name}
            </strong>?
          </p>
          <p className="text-sm text-gray-600">
            This will stop syncing data from this service. Your existing data will remain in your daily logs,
            but no new updates will be received.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              text
              onClick={() => setShowDisconnectDialog(null)}
            />
            <Button
              label="Disconnect"
              severity="danger"
              onClick={() => showDisconnectDialog && handleDisconnect(showDisconnectDialog)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}