export interface ContextInvitation {
  id: string
  contextId: string
  inviterUserId: string
  inviteeEmail: string
  role: 'owner' | 'editor' | 'viewer'
  token: string
  expiresAt: string
  acceptedAt?: string
  acceptedByUserId?: string
  createdAt: string
  contextTitle?: string
  contextDescription?: string
}

export interface InviteAcceptanceResult {
  success: boolean
  error?: string
  needsSignup?: boolean
  contextId?: string
  redirectUrl?: string
}

export interface UserLookupResult {
  exists: boolean
  userId?: string
  email: string
}