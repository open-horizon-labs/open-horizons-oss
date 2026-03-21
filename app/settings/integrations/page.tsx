import { Metadata } from 'next'
import { IntegrationsClient } from './IntegrationsClient'

export const metadata: Metadata = {
  title: 'Integrations - Open Horizons',
  description: 'Connect external services to enhance your daily rituals'
}

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-gray-700 mt-2">
          Connect external services to automatically sync context into your daily logs.
          Keep your personal journey in Open Horizons while staying connected to your broader workflow.
        </p>
      </div>

      <IntegrationsClient />
    </div>
  )
}