"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '../../../lib/supabaseClient'
import { Button, Input } from '@oh/ui'

export default function LoginPage() {
  const supabase = supabaseClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // Check if user is already logged in and redirect appropriately
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Check if user was redirected from a specific page
        const urlParams = new URLSearchParams(window.location.search)
        const redirectedFrom = urlParams.get('redirectedFrom')
        const destination = redirectedFrom && redirectedFrom.startsWith('/') ? redirectedFrom : '/dashboard'
        router.push(destination)
      }
    }
    checkAuth()
  }, [supabase, router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')
    const redirectTo = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL || `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('success')
      setMessage('Check your email for a magic link')
      setEmail('')
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Log in</h1>
      <form onSubmit={onSubmit} className="space-y-3" aria-describedby="login-status" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <Button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Sending…' : 'Send magic link'}
        </Button>
        <p id="login-status" className="text-sm" aria-live="polite">
          {message && (status === 'error' ? <span className="text-red-600">{message}</span> : <span className="text-green-700">{message}</span>)}
        </p>
      </form>
    </div>
  )
}

