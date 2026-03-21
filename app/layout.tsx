import './globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SignOutButton } from './components/SignOutButton'
import { UiModeProvider } from '../lib/ui/UiModeContext'
import { CompactUiModeToggle } from './components/UiModeToggle'
import { ContextSwitcherWrapper } from './components/ContextSwitcherWrapper'
import { GlobalContextAwareProvider } from './components/GlobalContextAwareProvider'
import { QuickNav } from './components/QuickNav'

export const metadata: Metadata = {
  title: 'Open Horizons — App',
  description: 'Daily Review — Aim. Do. Reflect.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased bg-white text-gray-900">
        <UiModeProvider>
          <GlobalContextAwareProvider>
            <header className="border-b bg-white/80 backdrop-blur">
              <div className="container mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
                <div className="flex items-center gap-6 flex-1 min-w-0">
                  <nav className="flex items-center gap-4 text-sm">
                    <Link href="/dashboard" className="hover:underline">
                      Dashboard
                    </Link>
                    <Link href="/settings" className="hover:underline">
                      Settings
                    </Link>
                  </nav>
                  <div className="flex-1 max-w-lg">
                    <ContextSwitcherWrapper />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <QuickNav />
                  <CompactUiModeToggle />
                  <SignOutButton />
                </div>
              </div>
            </header>
            <main className="container mx-auto max-w-5xl px-4 py-8">{children}</main>
          </GlobalContextAwareProvider>
        </UiModeProvider>
      </body>
    </html>
  )}
