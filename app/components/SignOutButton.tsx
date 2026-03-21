"use client"
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabaseClient } from '../../lib/supabaseClient'
import { Button } from '@oh/ui'

export function SignOutButton() {
  const router = useRouter()
  const supabase = supabaseClient()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const onSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <Button variant="secondary" onClick={onSignOut} aria-label="Sign out">
      Sign out
    </Button>
  )
}

