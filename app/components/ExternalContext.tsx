'use client'

import { useExternalContext } from '../../lib/hooks/useIntegrations'
import { INTEGRATION_CONFIGS } from '../../lib/integrations/pipedream'
import { Card } from 'primereact/card'
import { Badge } from 'primereact/badge'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Button } from 'primereact/button'
import { useState } from 'react'

interface ExternalContextProps {
  date: string
  compact?: boolean
}

export function ExternalContext({ date, compact = false }: ExternalContextProps) {
  const { context, loading, error, refresh } = useExternalContext(date)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <ProgressSpinner style={{ width: '20px', height: '20px' }} />
        <span className="ml-2 text-sm text-gray-600">Loading external context...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-red-700">
            Failed to load external context: {error}
          </div>
          <Button
            icon="pi pi-refresh"
            size="small"
            text
            onClick={handleRefresh}
            loading={refreshing}
          />
        </div>
      </div>
    )
  }

  if (!context || context.totalItems === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-700">External Events</h3>
            <Badge value="0 items" severity="secondary" />
          </div>
          <Button
            icon="pi pi-refresh"
            text
            onClick={handleRefresh}
            loading={refreshing}
            tooltip="Refresh external data"
          />
        </div>
        <p className="text-sm text-gray-600">
          No external events found for this date. {' '}
          <a
            href="/settings/integrations"
            className="text-blue-600 hover:underline"
          >
            Connect services
          </a>
          {' '} to see calendar events, tasks, and other context here.
        </p>
      </div>
    )
  }

  const formatTime = (dateTime: string) => {
    try {
      const date = new Date(dateTime)
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return dateTime
    }
  }

  const formatTimeRange = (startTime: string, endTime: string) => {
    const start = formatTime(startTime)
    const end = formatTime(endTime)
    return `${start} - ${end}`
  }

  return (
    <div className="space-y-4">
      {compact ? (
        // Compact view for sidebar or small spaces
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-900">External Context</h4>
            <Button
              icon="pi pi-refresh"
              text
              onClick={handleRefresh}
              loading={refreshing}
            />
          </div>

          {Object.entries(context.context).map(([serviceName, items]) => {
            const config = INTEGRATION_CONFIGS[serviceName as keyof typeof INTEGRATION_CONFIGS]
            return (
              <div key={serviceName} className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>{config?.icon || '🔗'}</span>
                  <span>{config?.name || serviceName}</span>
                  <Badge value={items.length} />
                </div>

                {items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="text-xs text-gray-700 pl-4">
                    {item.start_time && item.end_time ? (
                      <div>
                        <span className="text-gray-500">
                          {formatTimeRange(item.start_time, item.end_time)}
                        </span>
                        <span className="ml-2">{item.title}</span>
                      </div>
                    ) : (
                      <div>{item.title}</div>
                    )}
                  </div>
                ))}

                {items.length > 3 && (
                  <div className="text-xs text-gray-500 pl-4">
                    +{items.length - 3} more
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // Full view for daily logs
        <Card className="w-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">External Context</h3>
              <Badge value={`${context.totalItems} items`} />
            </div>
            <Button
              icon="pi pi-refresh"
              text
              onClick={handleRefresh}
              loading={refreshing}
              tooltip="Refresh external data"
            />
          </div>

          <div className="space-y-6">
            {Object.entries(context.context).map(([serviceName, items]) => {
              const config = INTEGRATION_CONFIGS[serviceName as keyof typeof INTEGRATION_CONFIGS]

              return (
                <div key={serviceName}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{config?.icon || '🔗'}</span>
                    <h4 className="font-medium">{config?.name || serviceName}</h4>
                    <Badge value={items.length} />
                  </div>

                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        {/* Time indicator */}
                        {item.start_time && (
                          <div className="text-sm font-mono text-gray-600 min-w-0 flex-shrink-0">
                            {item.end_time ? (
                              <div>
                                <div>{formatTime(item.start_time)}</div>
                                <div className="text-xs text-gray-500">
                                  {formatTime(item.end_time)}
                                </div>
                              </div>
                            ) : (
                              formatTime(item.start_time)
                            )}
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">
                            {item.title}
                          </div>

                          {/* Additional metadata */}
                          {item.data && (
                            <div className="text-sm text-gray-600 mt-1">
                              {/* Calendar event specific */}
                              {serviceName === 'google_calendar' && item.data.attendees && (
                                <div>
                                  {item.data.attendees.length} attendee{item.data.attendees.length !== 1 ? 's' : ''}
                                </div>
                              )}
                              {serviceName === 'google_calendar' && item.data.location && (
                                <div>📍 {item.data.location}</div>
                              )}
                              {serviceName === 'google_calendar' && item.data.description && (
                                <div className="mt-1 text-xs text-gray-500 line-clamp-2">
                                  {item.data.description}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* External link indicator */}
                        {item.data?.htmlLink && (
                          <a
                            href={item.data.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            <i className="pi pi-external-link" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}