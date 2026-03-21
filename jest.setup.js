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

// Mock db module for unit tests
jest.mock('./lib/db', () => ({
  query: jest.fn().mockResolvedValue([]),
  queryOne: jest.fn().mockResolvedValue(null),
  execute: jest.fn().mockResolvedValue(0),
  executeReturning: jest.fn().mockResolvedValue([]),
  getClient: jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn(),
  }),
  getPool: jest.fn(),
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
