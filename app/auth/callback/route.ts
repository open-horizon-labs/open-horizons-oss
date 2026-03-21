import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ensureUserNodeWithData } from '../../../lib/user/setup'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  
  const response = NextResponse.redirect(new URL(next, requestUrl.origin))
  
  if (code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    // If authentication was successful, ensure user has identity node
    if (!error && data.user) {
      try {
        // Pass the supabase client that has the new session
        await ensureUserNodeWithData(data.user, supabase)
      } catch (setupError) {
        console.error('User setup error (not blocking auth):', setupError)
        // Don't block auth if user setup fails
      }
    }
    
    if (error) {
      console.error('Auth callback error:', error)
    }
  }
  
  return response
}
