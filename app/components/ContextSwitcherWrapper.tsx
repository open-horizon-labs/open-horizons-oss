import ContextSwitcher from './ContextSwitcher'

export async function ContextSwitcherWrapper() {
  const userId = process.env.DEFAULT_USER_ID || 'default-user'
  return <ContextSwitcher currentUserId={userId} />
}

export default ContextSwitcherWrapper
