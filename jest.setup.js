import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ''
  },
}))

// Mock Supabase
jest.mock('./lib/supabaseClient', () => ({
  supabaseClient: () => ({
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }),
}))

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3001',
  },
  writable: true,
})

// Global fetch mock removed - tests should mock fetch individually if needed

// Add custom Jest matchers
expect.extend({
  toEndWith(received, expected) {
    const pass = received.endsWith(expected)
    if (pass) {
      return {
        message: () => `expected "${received}" not to end with "${expected}"`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected "${received}" to end with "${expected}"`,
        pass: false,
      }
    }
  },
})
