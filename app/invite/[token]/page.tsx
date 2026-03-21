import { getUserFromSession } from '../../../lib/auth'
import { redirect } from 'next/navigation'
import { getInvitationByToken } from '../../../lib/invitations/invitation-service'
import { InviteAcceptanceClient } from './InviteAcceptanceClient'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const user = await getUserFromSession()

  // Get invitation details
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <div className="text-red-600 mb-4">
            <i className="pi pi-times-circle text-4xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-600 mb-4">
            This invitation is invalid, expired, or has already been used.
          </p>
          <a
            href="/login"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  // If user is not logged in, redirect to login with invitation context
  if (!user) {
    redirect(`/login?invite=${token}`)
  }

  // If user email doesn't match invitation, show error
  if (user.email?.toLowerCase() !== invitation.inviteeEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <div className="text-yellow-600 mb-4">
            <i className="pi pi-exclamation-triangle text-4xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Mismatch</h1>
          <p className="text-gray-600 mb-4">
            This invitation was sent to <strong>{invitation.inviteeEmail}</strong> but you&apos;re logged in as <strong>{user.email}</strong>.
          </p>
          <p className="text-gray-600 mb-4">
            Please log in with the correct email address or contact the person who invited you.
          </p>
          <a
            href="/login"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Login with Different Email
          </a>
        </div>
      </div>
    )
  }

  return (
    <InviteAcceptanceClient
      invitation={invitation}
      userId={user.id}
    />
  )
}