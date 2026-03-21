import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Custom Jest config for API tests - no global fetch mocking
const apiJestConfig = {
  testEnvironment: 'node', // Use node environment instead of jsdom
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  extensionsToTreatAsEsm: ['.tsx', '.ts'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/__tests__/api/**/*.api.test.ts'],
  // Don't use the global jest setup that mocks fetch
  setupFilesAfterEnv: [],
  // Clear all global mocks to ensure real HTTP requests
  clearMocks: true,
  restoreMocks: true,
  // Run tests sequentially to avoid port conflicts
  maxWorkers: 1,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(apiJestConfig)