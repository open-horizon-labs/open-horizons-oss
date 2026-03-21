'use client'

import { useState, useEffect, useRef } from 'react'
import { ContextNode } from '../../../lib/contexts/context-operations'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Tag } from 'primereact/tag'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Message } from 'primereact/message'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { CreateContextModal } from '../../components/CreateContextModal'
import { updateContext, isPersonalContext } from '../../../lib/contracts/context-contract'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArchive } from '@fortawesome/free-solid-svg-icons'

interface ContextsManagerProps {
  userId: string
}

interface Participant {
  userId: string
  role: 'owner' | 'editor' | 'viewer'
  joinedAt: string
  email?: string
  name?: string
}

export function ContextsManager({ userId }: ContextsManagerProps) {
  const toast = useRef<Toast>(null)
  const [contexts, setContexts] = useState<ContextNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedContext, setSelectedContext] = useState<ContextNode | null>(null)
  const [showParticipants, setShowParticipants] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)

  // Invitation state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'owner' | 'editor' | 'viewer'>('viewer')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string; url: string } | null>(null)

  // Participant management state
  const [editingParticipant, setEditingParticipant] = useState<{ participant: Participant; newRole: string } | null>(null)
  const [removingParticipant, setRemovingParticipant] = useState<Participant | null>(null)

  // Delete context state
  const [deleteDialog, setDeleteDialog] = useState<{ visible: boolean; context: ContextNode | null }>({
    visible: false,
    context: null
  })

  // Archive context state
  const [archiveDialog, setArchiveDialog] = useState<{ visible: boolean; context: ContextNode | null }>({
    visible: false,
    context: null
  })

  // Rename context state
  const [renameDialog, setRenameDialog] = useState<{ visible: boolean; context: ContextNode | null }>({
    visible: false,
    context: null
  })
  const [renameTitle, setRenameTitle] = useState('')
  const [renameDescription, setRenameDescription] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)

  const loadContexts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/contexts')
      if (response.ok) {
        const data = await response.json()
        setContexts(data.contexts || [])
      }
    } catch (error) {
      console.error('Failed to load contexts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadParticipants = async (context: ContextNode) => {
    setLoadingParticipants(true)
    try {
      // Load participants from the new context_memberships table
      const response = await fetch(`/api/contexts/${context.id}/participants`)
      if (response.ok) {
        const data = await response.json()
        setParticipants(data.participants || [])
      } else {
        setParticipants([])
      }
    } catch (error) {
      console.error('Failed to load participant details:', error)
      setParticipants([])
    } finally {
      setLoadingParticipants(false)
    }
  }

  const loadPendingInvites = async (context: ContextNode) => {
    setLoadingInvites(true)
    try {
      const response = await fetch(`/api/contexts/${context.id}/invitations`)
      if (response.ok) {
        const data = await response.json()
        setPendingInvites(data.invitations || [])
      } else {
        setPendingInvites([])
      }
    } catch (error) {
      console.error('Failed to load pending invites:', error)
      setPendingInvites([])
    } finally {
      setLoadingInvites(false)
    }
  }

  useEffect(() => {
    loadContexts()
  }, [])

  useEffect(() => {
    if (selectedContext) {
      loadParticipants(selectedContext)
      loadPendingInvites(selectedContext)
    }
  }, [selectedContext])

  const getUserPermission = (context: ContextNode): 'owner' | 'editor' | 'viewer' | null => {
    return context.is_owner ? 'owner' : 'viewer'
  }

  const handleDeleteContext = async () => {
    if (!deleteDialog.context) return

    try {
      const response = await fetch(`/api/contexts/${deleteDialog.context.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadContexts()
        setDeleteDialog({ visible: false, context: null })
        if (selectedContext?.id === deleteDialog.context.id) {
          setSelectedContext(null)
          setShowParticipants(false)
        }
      }
    } catch (error) {
      console.error('Failed to delete context:', error)
    }
  }

  const handleArchiveContext = async () => {
    if (!archiveDialog.context) return

    try {
      const response = await fetch(`/api/contexts/${archiveDialog.context.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' })
      })

      if (response.ok) {
        await loadContexts()
        setArchiveDialog({ visible: false, context: null })
        if (selectedContext?.id === archiveDialog.context.id) {
          setSelectedContext(null)
          setShowParticipants(false)
        }
        toast.current?.show({
          severity: 'success',
          summary: 'Context Archived',
          detail: `${archiveDialog.context.title} has been archived`,
          life: 5000
        })
      } else {
        const result = await response.json()
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: result.error || 'Failed to archive context',
          life: 5000
        })
      }
    } catch (error) {
      console.error('Failed to archive context:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: error instanceof Error ? error.message : 'Failed to archive context',
        life: 5000
      })
    }
  }

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !selectedContext) return

    setInviteLoading(true)
    setInviteMessage(null)

    try {
      const response = await fetch(`/api/contexts/${selectedContext.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setInviteSuccess({
          email: inviteEmail,
          url: result.inviteUrl
        })
        setShowInviteModal(false)
        setInviteEmail('')
        // Refresh participants and invites
        loadParticipants(selectedContext)
        loadPendingInvites(selectedContext)
      } else {
        setInviteMessage({
          type: 'error',
          text: result.error || 'Failed to send invitation'
        })
      }
    } catch (error) {
      console.error('Invitation error:', error)
      setInviteMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send invitation'
      })
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRoleChange = async () => {
    if (!editingParticipant || !selectedContext) return

    try {
      const response = await fetch(`/api/contexts/${selectedContext.id}/participants/${editingParticipant.participant.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editingParticipant.newRole })
      })

      if (response.ok) {
        // Update local state
        setParticipants(prev =>
          prev.map(p =>
            p.userId === editingParticipant.participant.userId
              ? { ...p, role: editingParticipant.newRole as 'owner' | 'editor' | 'viewer' }
              : p
          )
        )
        setEditingParticipant(null)
        // Also update the contexts list
        await loadContexts()
      } else {
        const result = await response.json()
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: result.error || 'Failed to update role',
          life: 5000
        })
      }
    } catch (error) {
      console.error('Role change error:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: error instanceof Error ? error.message : 'Failed to update role',
        life: 5000
      })
    }
  }

  const handleRemoveParticipant = async () => {
    if (!removingParticipant || !selectedContext) return

    try {
      const response = await fetch(`/api/contexts/${selectedContext.id}/participants/${removingParticipant.userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Update local state
        setParticipants(prev => prev.filter(p => p.userId !== removingParticipant.userId))
        setRemovingParticipant(null)
        // Also update the contexts list
        await loadContexts()

        // If user removed themselves, close the participant view
        if (removingParticipant.userId === userId) {
          setSelectedContext(null)
          setShowParticipants(false)
        }
      } else {
        const result = await response.json()
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: result.error || 'Failed to remove participant',
          life: 5000
        })
      }
    } catch (error) {
      console.error('Participant removal error:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: error instanceof Error ? error.message : 'Failed to remove participant',
        life: 5000
      })
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!selectedContext) return

    try {
      const response = await fetch(`/api/contexts/${selectedContext.id}/invitations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId })
      })

      if (response.ok) {
        // Refresh the invitations list
        loadPendingInvites(selectedContext)
      } else {
        const result = await response.json()
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: result.error || 'Failed to cancel invitation',
          life: 5000
        })
      }
    } catch (error) {
      console.error('Invitation cancellation error:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: error instanceof Error ? error.message : 'Failed to cancel invitation',
        life: 5000
      })
    }
  }

  const handleRenameContext = async () => {
    if (!renameDialog.context || !renameTitle.trim()) return

    setRenameLoading(true)
    try {
      await updateContext(renameDialog.context.id, {
        title: renameTitle.trim(),
        description: renameDescription.trim() || undefined
      })

      // Refresh contexts to reflect the rename
      await loadContexts()

      // Update selected context if it's the one being renamed
      if (selectedContext?.id === renameDialog.context.id) {
        setSelectedContext({
          ...selectedContext,
          title: renameTitle.trim(),
          description: renameDescription.trim() || selectedContext.description
        })
      }

      setRenameDialog({ visible: false, context: null })
      setRenameTitle('')
      setRenameDescription('')

      toast.current?.show({
        severity: 'success',
        summary: 'Context Renamed',
        detail: `Successfully renamed context to "${renameTitle.trim()}"`,
        life: 5000
      })

    } catch (error) {
      console.error('Failed to rename context:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: error instanceof Error ? error.message : 'Failed to rename context',
        life: 5000
      })
    } finally {
      setRenameLoading(false)
    }
  }

  const roleOptions = [
    { label: 'Viewer', value: 'viewer' },
    { label: 'Editor', value: 'editor' },
    { label: 'Owner', value: 'owner' }
  ]

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'danger'
      case 'editor': return 'warning'
      case 'viewer': return 'info'
      default: return null
    }
  }

  // Context table templates
  const titleTemplate = (rowData: ContextNode) => (
    <div>
      <div className="font-medium text-gray-900">{rowData.title}</div>
      {rowData.description && (
        <div className="text-sm text-gray-600 mt-1">{rowData.description}</div>
      )}
    </div>
  )

  const participantsTemplate = (rowData: ContextNode) => {
    // For now, show placeholder count until we implement the participants API
    const participantCount = 1 // This will be replaced when we implement the participants endpoint
    return (
      <div className="flex items-center gap-2">
        <i className="pi pi-users text-gray-500" />
        <Tag value={participantCount} severity="info" />
        <span className="text-sm text-gray-600">
          {participantCount === 1 ? 'participant' : 'participants'}
        </span>
      </div>
    )
  }

  const endeavorsTemplate = (rowData: ContextNode) => (
    <div className="flex items-center gap-2">
      <i className="pi pi-folder text-gray-500" />
      <Tag value={0} severity="secondary" />
      <span className="text-sm text-gray-600">shared endeavors</span>
    </div>
  )

  const actionsTemplate = (rowData: ContextNode) => {
    const userPermission = getUserPermission(rowData)
    return (
      <div className="flex gap-2">
        <Button
          icon="pi pi-pencil"
          size="small"
          text
          severity="secondary"
          tooltip="Rename context"
          onClick={() => {
            setRenameDialog({ visible: true, context: rowData })
            setRenameTitle(rowData.title)
            setRenameDescription(rowData.description || '')
          }}
        />
        <Button
          icon="pi pi-users"
          size="small"
          text
          severity="secondary"
          tooltip="Manage participants"
          onClick={() => {
            setSelectedContext(rowData)
            setShowParticipants(true)
          }}
        />
        <Button
          icon="pi pi-eye"
          size="small"
          text
          severity="secondary"
          tooltip="Switch to context"
          onClick={() => {
            // Save the context to localStorage
            localStorage.setItem('selectedContextId', rowData.id)
            // Navigate to dashboard
            window.location.href = '/dashboard'
          }}
        />
        {userPermission === 'owner' && (
          <Button
            icon={<FontAwesomeIcon icon={faArchive} />}
            size="small"
            text
            severity="warning"
            tooltip="Archive context"
            onClick={() => setArchiveDialog({ visible: true, context: rowData })}
          />
        )}
      </div>
    )
  }

  // Participant table templates
  const participantTemplate = (participant: Participant) => (
    <div>
      <div className="font-medium">{participant.name || participant.userId}</div>
      <div className="text-sm text-gray-500">{participant.email}</div>
    </div>
  )

  const roleTemplate = (participant: Participant) => (
    <Tag value={participant.role} severity={getRoleColor(participant.role)} />
  )

  const joinedTemplate = (participant: Participant) => (
    <span>{new Date(participant.joinedAt).toLocaleDateString()}</span>
  )

  const participantActionsTemplate = (participant: Participant) => {
    const userPermission = selectedContext ? getUserPermission(selectedContext) : null
    return (
      <div className="flex gap-1 items-center">
        {/* Edit role button - only owners can edit roles */}
        {userPermission === 'owner' && participant.userId !== userId && (
          <Button
            icon="pi pi-pencil"
            severity="secondary"
            text
            size="small"
            tooltip="Change role"
            onClick={() => setEditingParticipant({ participant, newRole: participant.role })}
          />
        )}

        {/* Remove/Leave button */}
        {((userPermission === 'owner' || userPermission === 'editor') && participant.userId !== userId) ||
         participant.userId === userId ? (
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            tooltip={participant.userId === userId ? "Leave context" : "Remove participant"}
            onClick={() => setRemovingParticipant(participant)}
          />
        ) : null}

        {participant.userId === userId && (
          <span className="text-xs text-gray-500 ml-2">You</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toast ref={toast} />
      <ConfirmDialog />
      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
        <div className="flex items-start gap-2">
          <i className="pi pi-info-circle text-blue-600 mt-0.5" />
          <div className="text-blue-800">
            <p className="font-medium">How contexts work:</p>
            <ul className="mt-1 space-y-1 text-blue-700">
              <li>• <strong>Personal:</strong> Shows all your endeavors (default view)</li>
              <li>• <strong>Shared contexts:</strong> Show only endeavors you&apos;ve shared in that space</li>
              <li>• <strong>Collaboration:</strong> Team members can only see shared endeavors, not your personal work</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Your Contexts ({contexts.length})</h3>
        <Button
          icon="pi pi-plus"
          label="New Context"
          onClick={() => setShowCreateModal(true)}
        />
      </div>

      {/* Contexts Table */}
      <div className="border rounded-lg">
        <DataTable
          value={contexts}
          loading={loading}
          emptyMessage={
            <div className="text-center py-8">
              <i className="pi pi-users text-gray-400 text-2xl mb-2 block" />
              <p className="text-gray-500 mb-4">No collaboration contexts yet</p>
              <Button
                label="Create your first context"
                onClick={() => setShowCreateModal(true)}
              />
            </div>
          }
          className="w-full"
        >
          <Column
            field="title"
            header="Context"
            body={titleTemplate}
            style={{ width: '35%' }}
          />
          <Column
            header="Participants"
            body={participantsTemplate}
            style={{ width: '25%' }}
          />
          <Column
            header="Shared Work"
            body={endeavorsTemplate}
            style={{ width: '25%' }}
          />
          <Column
            header="Actions"
            body={actionsTemplate}
            style={{ width: '15%' }}
          />
        </DataTable>
      </div>

      {/* Create Context Modal */}
      <CreateContextModal
        visible={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onContextCreated={() => loadContexts()}
      />

      {/* Participants Management Dialog */}
      <Dialog
        header={`Manage Participants - ${selectedContext?.title}`}
        visible={showParticipants}
        onHide={() => {
          setShowParticipants(false)
          setSelectedContext(null)
        }}
        style={{ width: '800px' }}
        modal
        maximizable
      >
        {selectedContext && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-medium">Participants ({participants.length})</h4>
              {(getUserPermission(selectedContext) === 'owner' || getUserPermission(selectedContext) === 'editor') && (
                <Button
                  label="Invite User"
                  icon="pi pi-user-plus"
                  onClick={() => setShowInviteModal(true)}
                />
              )}
            </div>

            <DataTable
              value={participants}
              emptyMessage="No participants yet"
              className="w-full"
              loading={loadingParticipants}
            >
              <Column
                field="name"
                header="User"
                style={{ width: '35%' }}
                body={participantTemplate}
              />
              <Column
                field="role"
                header="Role"
                body={roleTemplate}
                style={{ width: '20%' }}
              />
              <Column
                field="joinedAt"
                header="Joined"
                body={joinedTemplate}
                style={{ width: '25%' }}
              />
              <Column
                header="Actions"
                style={{ width: '20%' }}
                body={participantActionsTemplate}
              />
            </DataTable>

            {/* Pending Invitations Section */}
            {pendingInvites.length > 0 && (
              <div className="mt-6">
                <h5 className="text-md font-medium mb-3 text-gray-900">
                  Pending Invitations ({pendingInvites.length})
                </h5>
                <DataTable
                  value={pendingInvites}
                  emptyMessage="No pending invitations"
                  className="w-full"
                  loading={loadingInvites}
                >
                  <Column
                    field="inviteeEmail"
                    header="Email"
                    style={{ width: '35%' }}
                    body={(invite) => (
                      <div>
                        <div className="font-medium">{invite.inviteeEmail}</div>
                        <div className="text-xs text-gray-500">
                          Sent {new Date(invite.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  />
                  <Column
                    field="role"
                    header="Role"
                    style={{ width: '20%' }}
                    body={(invite) => (
                      <Tag value={invite.role} severity={getRoleColor(invite.role)} />
                    )}
                  />
                  <Column
                    field="expiresAt"
                    header="Expires"
                    style={{ width: '25%' }}
                    body={(invite) => (
                      <span className="text-sm">
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  />
                  <Column
                    header="Actions"
                    style={{ width: '20%' }}
                    body={(invite) => (
                      <div className="flex gap-1">
                        <Button
                          icon="pi pi-copy"
                          size="small"
                          text
                          severity="secondary"
                          tooltip="Copy invitation link"
                          onClick={() => {
                            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
                            const inviteUrl = `${baseUrl}/invite/${invite.token}`
                            navigator.clipboard.writeText(inviteUrl)
                            toast.current?.show({
                              severity: 'success',
                              summary: 'Copied',
                              detail: 'Invitation link copied to clipboard!',
                              life: 3000
                            })
                          }}
                        />
                        <Button
                          icon="pi pi-times"
                          size="small"
                          text
                          severity="danger"
                          tooltip="Cancel invitation"
                          onClick={() => {
                            confirmDialog({
                              message: `Are you sure you want to cancel the invitation for ${invite.inviteeEmail}? This action cannot be undone.`,
                              header: 'Cancel Invitation',
                              icon: 'pi pi-exclamation-triangle',
                              acceptClassName: 'p-button-danger',
                              accept: () => handleCancelInvitation(invite.id)
                            })
                          }}
                        />
                      </div>
                    )}
                  />
                </DataTable>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Invite Modal */}
      <Dialog
        header="Create Invitation Link"
        visible={showInviteModal}
        onHide={() => setShowInviteModal(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label="Cancel"
              outlined
              onClick={() => setShowInviteModal(false)}
              disabled={inviteLoading}
            />
            <Button
              label="Create Invitation"
              onClick={handleInviteUser}
              loading={inviteLoading}
              disabled={!inviteEmail.trim()}
            />
          </div>
        }
        style={{ width: '400px' }}
        modal
      >
        <div className="space-y-4">
          {inviteMessage && (
            <Message
              severity={inviteMessage.type}
              text={inviteMessage.text}
              className="w-full"
            />
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Email Address (for invitation tracking)</label>
            <InputText
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full"
              disabled={inviteLoading}
            />
            <small className="text-gray-600 text-xs mt-1 block">
              You&apos;ll receive a link to share manually - no automated email is sent
            </small>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <Dropdown
              value={inviteRole}
              onChange={(e) => setInviteRole(e.value)}
              options={roleOptions}
              className="w-full"
              disabled={inviteLoading}
            />
          </div>

          <div className="text-sm text-gray-600">
            <p><strong>Viewer:</strong> Can view shared endeavors</p>
            <p><strong>Editor:</strong> Can modify shared endeavors</p>
            <p><strong>Owner:</strong> Full management access</p>
          </div>
        </div>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog
        header="Change Participant Role"
        visible={!!editingParticipant}
        onHide={() => setEditingParticipant(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label="Cancel"
              outlined
              onClick={() => setEditingParticipant(null)}
            />
            <Button
              label="Update Role"
              onClick={handleRoleChange}
            />
          </div>
        }
        style={{ width: '400px' }}
        modal
      >
        {editingParticipant && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Change role for {editingParticipant.participant.name || editingParticipant.participant.userId}
              </label>
              <Dropdown
                value={editingParticipant.newRole}
                onChange={(e) => setEditingParticipant({ ...editingParticipant, newRole: e.value })}
                options={roleOptions}
                className="w-full"
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Remove Participant Modal */}
      <Dialog
        header={removingParticipant?.userId === userId ? "Leave Context" : "Remove Participant"}
        visible={!!removingParticipant}
        onHide={() => setRemovingParticipant(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label="Cancel"
              outlined
              onClick={() => setRemovingParticipant(null)}
            />
            <Button
              label={removingParticipant?.userId === userId ? "Leave" : "Remove"}
              severity="danger"
              onClick={handleRemoveParticipant}
            />
          </div>
        }
        style={{ width: '400px' }}
        modal
      >
        {removingParticipant && (
          <div className="flex items-start gap-3">
            <i className="pi pi-exclamation-triangle text-orange-500 text-xl mt-1" />
            <div>
              {removingParticipant.userId === userId ? (
                <>
                  <p className="mb-2">Are you sure you want to leave this context?</p>
                  <p className="text-sm text-gray-600">
                    You will no longer have access to shared endeavors in this context.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    Are you sure you want to remove{' '}
                    <strong>{removingParticipant.name || removingParticipant.userId}</strong>?
                  </p>
                  <p className="text-sm text-gray-600">
                    They will lose access to all shared endeavors in this context.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* Archive Context Modal */}
      <Dialog
        header="Archive Context"
        visible={archiveDialog.visible}
        onHide={() => setArchiveDialog({ visible: false, context: null })}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label="Cancel"
              outlined
              onClick={() => setArchiveDialog({ visible: false, context: null })}
            />
            <Button
              label="Archive"
              severity="warning"
              onClick={handleArchiveContext}
            />
          </div>
        }
        style={{ width: '400px' }}
        modal
      >
        <div className="flex items-start gap-3">
          <i className="pi pi-archive text-orange-500 text-xl mt-1" />
          <div>
            <p className="mb-2">
              Are you sure you want to archive <strong>{archiveDialog.context?.title}</strong>?
            </p>
            <p className="text-sm text-gray-600">
              This will hide the context from your active list. Archived contexts can be restored later.
              Participants will no longer see this context in their active list.
            </p>
          </div>
        </div>
      </Dialog>

      {/* Delete Context Modal */}
      <Dialog
        header="Delete Context"
        visible={deleteDialog.visible}
        onHide={() => setDeleteDialog({ visible: false, context: null })}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label="Cancel"
              outlined
              onClick={() => setDeleteDialog({ visible: false, context: null })}
            />
            <Button
              label="Delete"
              severity="danger"
              onClick={handleDeleteContext}
            />
          </div>
        }
        style={{ width: '400px' }}
        modal
      >
        <div className="flex items-start gap-3">
          <i className="pi pi-exclamation-triangle text-orange-500 text-xl mt-1" />
          <div>
            <p className="mb-2">
              Are you sure you want to delete <strong>{deleteDialog.context?.title}</strong>?
            </p>
            <p className="text-sm text-gray-600">
              This will remove the context and stop sharing all endeavors with participants.
              This action cannot be undone.
            </p>
          </div>
        </div>
      </Dialog>

      {/* Invitation Success Dialog */}
      <Dialog
        header="Invitation Link Created!"
        visible={!!inviteSuccess}
        onHide={() => setInviteSuccess(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label="Copy Link"
              icon="pi pi-copy"
              onClick={() => {
                if (inviteSuccess) {
                  navigator.clipboard.writeText(inviteSuccess.url)
                  toast.current?.show({
                    severity: 'success',
                    summary: 'Copied',
                    detail: 'Invitation link copied to clipboard!',
                    life: 3000
                  })
                }
              }}
            />
            <Button
              label="Done"
              onClick={() => setInviteSuccess(null)}
            />
          </div>
        }
        style={{ width: '500px' }}
        modal
      >
        {inviteSuccess && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded">
              <i className="pi pi-check-circle text-lg" />
              <span className="font-medium">
                Invitation link created for {inviteSuccess.email}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Share this invitation link:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteSuccess.url}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button
                  icon="pi pi-copy"
                  size="small"
                  tooltip="Copy to clipboard"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteSuccess.url)
                    toast.current?.show({
                      severity: 'success',
                      summary: 'Copied',
                      detail: 'Invitation link copied to clipboard!',
                      life: 3000
                    })
                  }}
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
              <div className="flex items-start gap-2">
                <i className="pi pi-info-circle text-blue-600 mt-0.5" />
                <div className="text-blue-800">
                  <p className="font-medium">Next steps:</p>
                  <ul className="mt-1 space-y-1 text-blue-700">
                    <li>• Copy the link above and send it to {inviteSuccess.email}</li>
                    <li>• Share via email, Slack, or your preferred method</li>
                    <li>• They&apos;ll need to sign in or create an account</li>
                    <li>• The invitation expires in 7 days</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Rename Context Dialog */}
      <Dialog
        header="Rename Context"
        visible={renameDialog.visible}
        onHide={() => {
          setRenameDialog({ visible: false, context: null })
          setRenameTitle('')
          setRenameDescription('')
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label="Cancel"
              outlined
              onClick={() => {
                setRenameDialog({ visible: false, context: null })
                setRenameTitle('')
                setRenameDescription('')
              }}
              disabled={renameLoading}
            />
            <Button
              label="Rename Context"
              onClick={handleRenameContext}
              loading={renameLoading}
              disabled={!renameTitle.trim()}
            />
          </div>
        }
        style={{ width: '500px' }}
        modal
      >
        {renameDialog.context && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Context Name *
              </label>
              <InputText
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder="Enter context name..."
                className="w-full"
                autoFocus
                disabled={renameLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description
              </label>
              <InputText
                value={renameDescription}
                onChange={(e) => setRenameDescription(e.target.value)}
                placeholder="Enter description (optional)..."
                className="w-full"
                disabled={renameLoading}
              />
            </div>

            {isPersonalContext(renameDialog.context.id) && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                <div className="flex items-start gap-2">
                  <i className="pi pi-info-circle text-blue-600 mt-0.5" />
                  <div className="text-blue-800">
                    <p className="font-medium">Personal Context</p>
                    <p className="text-blue-700 mt-1">
                      This is your personal workspace. You can rename it, but it cannot be deleted.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}