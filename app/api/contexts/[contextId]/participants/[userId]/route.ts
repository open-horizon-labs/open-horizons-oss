import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../../lib/auth-api'

export const PATCH = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { contextId, userId: targetUserId }: { contextId: string; userId: string } = await context.params

    const { role } = await request.json()

    if (!['owner', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const { getSupabaseForAuthMethod } = await import('../../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Load the context
    const { data: contextData, error: loadError } = await supabase
      .from('endeavors')
      .select('metadata')
      .eq('id', contextId)
      .single()

    if (loadError || !contextData) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    // Check permissions (only owners can change roles)
    const participants = contextData.metadata?.participants || []
    const participant = participants.find((p: any) => p.userId === user.id)
    const userPermission = participant?.role || null

    if (userPermission !== 'owner') {
      return NextResponse.json({ error: 'Only context owners can change participant roles' }, { status: 403 })
    }

    // Update participant role
    const updatedParticipants = participants.map((p: any) =>
      p.userId === targetUserId ? { ...p, role } : p
    )

    // Check if participant exists
    if (!participants.some((p: any) => p.userId === targetUserId)) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const updatedMetadata = {
      ...contextData.metadata,
      participants: updatedParticipants
    }

    const { error } = await supabase
      .from('endeavors')
      .update({ metadata: updatedMetadata })
      .eq('id', contextId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating participant role:', error)
    return NextResponse.json(
      { error: 'Failed to update participant role' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { contextId, userId: targetUserId }: { contextId: string; userId: string } = await context.params

    const { getSupabaseForAuthMethod } = await import('../../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Load the context
    const { data: contextData, error: loadError } = await supabase
      .from('endeavors')
      .select('metadata')
      .eq('id', contextId)
      .single()

    if (loadError || !context) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    // Check permissions (owners and editors can remove participants, but only owners can remove other owners)
    const participants = contextData.metadata?.participants || []
    const participant = participants.find((p: any) => p.userId === user.id)
    const userPermission = participant?.role || null
    const targetParticipant = participants.find((p: any) => p.userId === targetUserId)

    if (!targetParticipant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    // Users can remove themselves
    if (targetUserId === user.id) {
      // Allow self-removal, but prevent last owner from leaving
      const ownerCount = participants.filter((p: any) => p.role === 'owner').length
      if (targetParticipant.role === 'owner' && ownerCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last owner from context' }, { status: 400 })
      }
    } else {
      // Removing others requires permission
      if (userPermission !== 'owner' && userPermission !== 'editor') {
        return NextResponse.json({ error: 'Insufficient permissions to remove participants' }, { status: 403 })
      }

      // Only owners can remove other owners
      if (targetParticipant.role === 'owner' && userPermission !== 'owner') {
        return NextResponse.json({ error: 'Only owners can remove other owners' }, { status: 403 })
      }
    }

    // Remove participant
    const updatedParticipants = participants.filter((p: any) => p.userId !== targetUserId)

    const updatedMetadata = {
      ...contextData.metadata,
      participants: updatedParticipants
    }

    const { error } = await supabase
      .from('endeavors')
      .update({ metadata: updatedMetadata })
      .eq('id', contextId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing participant:', error)
    return NextResponse.json(
      { error: 'Failed to remove participant' },
      { status: 500 }
    )
  }
})