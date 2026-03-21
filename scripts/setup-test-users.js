#!/usr/bin/env node

/**
 * Setup script to create test users and API keys for development
 * Usage: npm run setup-test-users
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SECRET_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Test user data
const testUsers = [
  {
    email: 'test-user-1@example.com',
    password: 'testpassword123',
    name: 'Test User One',
    keyName: 'Development API Key'
  },
  {
    email: 'test-user-2@example.com',
    password: 'testpassword123',
    name: 'Test User Two',
    keyName: 'Development API Key'
  }
]

/**
 * Generate a secure API key with proper prefix and entropy
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(32)
  const fullKey = `ak_${randomBytes.toString('hex')}`
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex')
  const prefix = fullKey.substring(0, 8)
  return { fullKey, hash, prefix }
}

/**
 * Create or get existing user
 */
async function createTestUser(userData) {
  console.log(`📧 Setting up user: ${userData.email}`)

  // Check if user already exists
  const { data: existingUser } = await supabase.auth.admin.listUsers()
  const userExists = existingUser.users.find(u => u.email === userData.email)

  if (userExists) {
    console.log(`   ✓ User already exists (${userExists.id})`)
    return userExists
  }

  // Create new user
  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
    user_metadata: {
      full_name: userData.name,
      name: userData.name
    }
  })

  if (error) {
    console.error(`   ❌ Failed to create user: ${error.message}`)
    throw error
  }

  console.log(`   ✓ Created user (${newUser.user.id})`)
  return newUser.user
}

/**
 * Create API key for user
 */
async function createApiKeyForUser(user, keyName) {
  console.log(`🔑 Creating API key for ${user.email}`)

  // First, revoke all existing keys for this user (regardless of name)
  const { data: existingKeys } = await supabase
    .from('api_keys')
    .select('*')
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (existingKeys && existingKeys.length > 0) {
    console.log(`   🗑️  Revoking ${existingKeys.length} existing API key(s) for fresh creation`)
    await supabase
      .from('api_keys')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: 'Recreated by test setup'
      })
      .eq('user_id', user.id)
      .is('revoked_at', null)
  }

  // Use a timestamped name to ensure uniqueness
  const uniqueKeyName = `${keyName} (${new Date().toISOString()})`

  // Generate new API key
  const { fullKey, hash, prefix } = generateApiKey()

  // Insert into database
  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      name: uniqueKeyName,
      key_hash: hash,
      key_prefix: prefix,
      scopes: ['read', 'write'],
      metadata: {
        permissions: ['read:profile', 'read:endeavors', 'write:endeavors'],
        environment: 'development',
        description: 'Auto-generated development API key',
        usageCount: 0
      }
    })
    .select()
    .single()

  if (error) {
    console.error(`   ❌ Failed to create API key: ${error.message}`)
    throw error
  }

  console.log(`   ✓ Created API key ${prefix}...`)
  return { ...apiKey, fullKey }
}

/**
 * Update .env.local file with test API keys
 */
function updateEnvFile(apiKeys) {
  const envPath = path.join(__dirname, '../.env.local')
  let envContent = ''

  // Read existing .env.local if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8')
  }

  // Remove existing test API key entries
  envContent = envContent.replace(/# Test API Keys[\s\S]*?# End Test API Keys\n?/g, '')

  // Add new test API key section
  const testSection = [
    '',
    '# Test API Keys (auto-generated)',
    ...apiKeys.map((key, index) =>
      `TEST_API_KEY_${index + 1}=${key.fullKey} # ${testUsers[index].email}`
    ),
    '# End Test API Keys',
    ''
  ].join('\n')

  envContent += testSection

  // Write back to file
  fs.writeFileSync(envPath, envContent)
  console.log('📝 Updated .env.local with test API keys')
}

/**
 * Main setup function
 */
async function setupTestUsers() {
  console.log('🚀 Setting up test users and API keys...\n')

  try {
    const results = []

    for (const userData of testUsers) {
      const user = await createTestUser(userData)
      const apiKey = await createApiKeyForUser(user, userData.keyName)

      // Since we always create new keys now, this should always be truthy
      if (apiKey) {
        results.push(apiKey)
      }
      console.log() // Empty line for readability
    }

    // Always update the env file if we have results
    if (results.length > 0) {
      updateEnvFile(results)
    } else {
      console.log('⚠️  No new API keys were created')
    }

    console.log('✅ Setup complete!\n')
    console.log('📋 Test Users Created:')
    testUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (password: ${user.password})`)
    })

    if (results.length > 0) {
      console.log('\n🔑 API Keys stored in .env.local:')
      results.forEach((key, index) => {
        console.log(`   TEST_API_KEY_${index + 1}=${key.fullKey}`)
      })
    }

    console.log('\n💡 Usage:')
    console.log('   curl -H "Authorization: Bearer $TEST_API_KEY_1" http://localhost:3001/api/profile')

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    process.exit(1)
  }
}

// Run the setup
setupTestUsers()