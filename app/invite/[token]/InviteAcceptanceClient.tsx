'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContextInvitation } from '../../../lib/invitations/types'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { Tag } from 'primereact/tag'

interface InviteAcceptanceClientProps {
  invitation: ContextInvitation
  userId: string
}

export function InviteAcceptanceClient({ invitation, userId }: InviteAcceptanceClientProps) {
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleAcceptInvitation = async () => {
    setAccepting(true)
    setError(null)

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invitation.token })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Redirect to the context
        router.push(result.redirectUrl || `/contexts/${invitation.contextId}`)
      } else {
        setError(result.error || 'Failed to accept invitation')
      }
    } catch (error) {
      setError('Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'danger'
      case 'editor': return 'warning'
      case 'viewer': return 'info'
      default: return null
    }
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'owner': return 'Full management access to the context'
      case 'editor': return 'Can modify shared endeavors and collaborate'
      case 'viewer': return 'Can view shared endeavors'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <div className="text-center mb-6">
          <div className="text-blue-600 mb-4">
            <i className="pi pi-users text-4xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You&apos;re Invited!
          </h1>
          <p className="text-gray-600">
            You&apos;ve been invited to join <strong>{invitation.contextTitle || 'a collaboration context'}</strong>
          </p>
        </div>

        {error && (
          <Message
            severity="error"
            text={error}
            className="w-full mb-4"
          />
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Context</label>
            <div>
              <p className="text-gray-900 font-medium">{invitation.contextTitle || 'Untitled Context'}</p>
              {invitation.contextDescription && (
                <p className="text-gray-600 text-sm mt-1">{invitation.contextDescription}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Your Role</label>
            <div className="flex items-center gap-2 mt-1">
              <Tag
                value={invitation.role}
                severity={getRoleColor(invitation.role)}
                className="text-sm"
              />
              <span className="text-sm text-gray-600">
                {getRoleDescription(invitation.role)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Invited by</label>
            <p className="text-gray-900 text-sm">{invitation.inviterUserId}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Expires</label>
            <p className="text-gray-900 text-sm">
              {new Date(invitation.expiresAt).toLocaleDateString()} at{' '}
              {new Date(invitation.expiresAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            label="Decline"
            severity="secondary"
            outlined
            className="flex-1"
            onClick={() => router.push('/dashboard')}
            disabled={accepting}
          />
          <Button
            label="Accept Invitation"
            className="flex-1"
            loading={accepting}
            onClick={handleAcceptInvitation}
          />
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          By accepting, you&apos;ll be added as a {invitation.role} to this collaboration context
        </div>
      </div>
    </div>
  )
}

export default InviteAcceptanceClient