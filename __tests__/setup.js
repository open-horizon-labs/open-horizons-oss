/**
 * Jest setup file to load environment variables from .env.local
 */

const dotenv = require('dotenv')
const path = require('path')

// Load .env.local file
dotenv.config({
  path: path.join(__dirname, '../.env.local')
})

console.log('🔧 Loaded environment variables for tests')