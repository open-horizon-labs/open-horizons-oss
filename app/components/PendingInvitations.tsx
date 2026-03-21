'use client'

import { useState, useEffect } from 'react'
import { Message } from 'primereact/message'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { useRouter } from 'next/navigation'

interface PendingInvitation {
  id: string
  contextId: string
  contextTitle: string
  contextDescription?: string
  inviteeEmail: string
  role: 'owner' | 'editor' | 'viewer'
  token: string
  expiresAt: string
  createdAt: string
}

export function PendingInvitations() {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchPendingInvitations()
  }, [])

  const fetchPendingInvitations = async () => {
    try {
      const response = await fetch('/api/invitations/pending')
      if (response.ok) {
        const data = await response.json()
        setInvitations(data.invitations || [])
      }
    } catch (error) {
      console.error('Failed to fetch pending invitations:', error)
    } finally {
      setLoading(false)
    }
  }

  const acceptInvitation = async (token: string, contextId: string) => {
    setAccepting(token)
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Remove from pending list
        setInvitations(prev => prev.filter(inv => inv.token !== token))
        // Navigate to the context
        router.push(`/dashboard?context=${contextId}`)
      } else {
        console.error('Failed to accept invitation:', result.error)
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
    } finally {
      setAccepting(null)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'danger'
      case 'editor': return 'warning'
      case 'viewer': return 'info'
      default: return 'info'
    }
  }

  if (loading) {
    return null // Don't show loading state for this component
  }

  if (invitations.length === 0) {
    return null // Don't show anything if no pending invitations
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <i className="pi pi-bell text-blue-600" />
        Pending Invitations ({invitations.length})
      </h3>

      <div className="space-y-3">
        {invitations.map((invitation) => (
          <Message
            key={invitation.id}
            severity="info"
            className="w-full"
            content={
              <div className="flex items-center justify-between w-full">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      Invited to: {invitation.contextTitle}
                    </span>
                    <Tag
                      value={invitation.role}
                      severity={getRoleColor(invitation.role)}
                      className="text-xs"
                    />
                  </div>
                  {invitation.contextDescription && (
                    <p className="text-sm text-gray-600 mb-2">
                      {invitation.contextDescription}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    label="View Details"
                    size="small"
                    outlined
                    className="text-xs"
                    onClick={() => router.push(`/invite/${invitation.token}`)}
                  />
                  <Button
                    label="Accept"
                    size="small"
                    className="text-xs"
                    loading={accepting === invitation.token}
                    onClick={() => acceptInvitation(invitation.token, invitation.contextId)}
                  />
                </div>
              </div>
            }
          />
        ))}
      </div>
    </div>
  )
}