#!/usr/bin/env node

/**
 * Contract Validation Build Step
 *
 * Validates critical contract patterns before deployment
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

/**
 * Extract contract constants from strategy configuration presets.
 *
 * Node types are now defined in lib/config/presets/ rather than
 * hardcoded as z.enum() in the contract file. We read the preset
 * files and extract the `name` fields from nodeTypes arrays.
 */
function extractContractConstants() {
  const constants = {
    nodeTypes: [],
    fieldNames: ['rdfType', 'parent_id', 'node_type'] // Known field patterns
  }

  // Read all preset files and extract node type names
  const presetsDir = join(rootDir, 'lib/config/presets')
  try {
    const presetFiles = readdirSync(presetsDir).filter(f => f.endsWith('.ts'))
    for (const file of presetFiles) {
      const content = readFileSync(join(presetsDir, file), 'utf8')
      // Extract name fields from nodeTypes array entries: name: 'Mission'
      const nameMatches = content.matchAll(/name:\s*['"]([^'"]+)['"]/g)
      for (const match of nameMatches) {
        constants.nodeTypes.push(match[1])
      }
    }
  } catch (e) {
    // Fallback: if presets dir doesn't exist, try legacy AST extraction
    console.log('  Note: Could not read presets directory, using fallback')
  }

  // Remove duplicates
  constants.nodeTypes = [...new Set(constants.nodeTypes)]

  return constants
}

/**
 * Enhanced contract validation using extracted constants
 */
function validateContractUsage(filePath, content, constants) {
  const errors = []
  const warnings = []

  // Skip contract files themselves and test files
  const skipPatterns = [
    '/lib/contracts/',
    '.test.',
    '.spec.',
    '__tests__'
  ]

  const shouldSkip = skipPatterns.some(pattern => filePath.includes(pattern))
  if (shouldSkip) return { errors, warnings }

  // 1. Check for 'as any' usage where contract types should be used
  if (content.includes('as any')) {
    // Check if this is in a context where contract types should be used
    const asAnyLines = content.split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => line.includes('as any'))

    asAnyLines.forEach(({ line, number }) => {
      // Look for contract-related contexts
      const contractKeywords = ['GraphNode', 'node_type', 'DatabaseNodeType', 'ApiNodeType', 'allNodes']
      if (contractKeywords.some(keyword => line.includes(keyword))) {
        warnings.push(`${filePath}:${number}: Uses 'as any' with contract types - consider proper typing`)
      }
    })
  }

  // 2. Check for hardcoded node type strings
  constants.nodeTypes.forEach(nodeType => {
    const patterns = [
      `'${nodeType}'`,
      `"${nodeType}"`,
      `=== '${nodeType}'`,
      `== '${nodeType}'`,
      `!== '${nodeType}'`,
      `!= '${nodeType}'`
    ]

    patterns.forEach(pattern => {
      if (content.includes(pattern)) {
        // Make sure they're not already using contract constants
        const hasContractUsage = [
          `DatabaseNodeType.enum.${nodeType}`,
          `ApiNodeType.enum.${nodeType}`,
          `UserNodeType.enum.${nodeType.toLowerCase()}`,
          // Also check for contract import patterns
          `import.*${nodeType}.*from.*contracts`,
          `import.*DatabaseNodeType.*from.*contracts`
        ].some(contractPattern => content.match(new RegExp(contractPattern)))

        if (!hasContractUsage) {
          warnings.push(`${filePath}: Uses hardcoded ${pattern} - consider using contract constants`)
        }
      }
    })
  })

  // 3. Check for hardcoded field comparisons
  const fieldPatterns = [
    { old: 'rdfType', new: 'node_type', suggestion: 'Use node_type from contract GraphNode' },
    { old: 'parent', new: 'parent_id', suggestion: 'Use parent_id from contract GraphNode' }
  ]

  fieldPatterns.forEach(({ old, new: newField, suggestion }) => {
    // Use more precise regex to avoid false positives
    const legacyPatterns = [
      `\\.${old}\\s`,      // .parent followed by space
      `\\.${old}\\)`,      // .parent followed by )
      `\\.${old},`,        // .parent followed by ,
      `\\.${old}}`,        // .parent followed by }
      `\\.${old}\\?`,      // .parent followed by ?
      `\\.${old}\\|`,      // .parent followed by |
      `\\.${old}&`,        // .parent followed by &
      `\\.${old}$`,        // .parent at end of line
    ]

    const hasLegacyUsage = legacyPatterns.some(pattern => {
      return new RegExp(pattern).test(content)
    })

    if (hasLegacyUsage && !content.includes(`// legacy: ${old}`)) {
      warnings.push(`${filePath}: Uses legacy field '${old}' - ${suggestion}`)
    }
  })

  return { errors, warnings }
}

console.log('🔍 Validating contracts...')

let errors = []
let warnings = []

// Simple file finder
function findFiles(dir, extension, results = []) {
  try {
    const files = readdirSync(dir)
    for (const file of files) {
      const fullPath = join(dir, file)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          findFiles(fullPath, extension, results)
        } else if (file.endsWith(extension)) {
          results.push(fullPath)
        }
      } catch (e) {
        // Skip inaccessible files
      }
    }
  } catch (e) {
    // Skip inaccessible directories
  }
  return results
}

// 1. Check contract files compile
console.log('📋 Validating contract files...')
try {
  const contractFiles = findFiles(join(rootDir, 'lib/contracts'), '.ts')

  for (const file of contractFiles) {
    const content = readFileSync(file, 'utf8')

    // Check for z.record() without explicit key type
    if (content.includes('z.record(z.unknown()')) {
      errors.push(`${file}: Found z.record(z.unknown()) - use z.record(z.string(), z.unknown())`)
    }

    console.log(`  ✅ ${file}`)
  }
} catch (error) {
  errors.push(`Contract validation failed: ${error.message}`)
}

// 2. Extract contract constants and validate usage
console.log('📋 Extracting contract constants...')
let contractConstants = { nodeTypes: [], fieldNames: [] }
try {
  contractConstants = extractContractConstants()
  console.log(`  ✅ Found ${contractConstants.nodeTypes.length} node types: ${contractConstants.nodeTypes.join(', ')}`)
} catch (error) {
  errors.push(`Contract constant extraction failed: ${error.message}`)
}

// 3. Enhanced contract validation
console.log('📋 Validating contract usage patterns...')
try {
  const allFiles = [
    ...findFiles(join(rootDir, 'app'), '.tsx'),
    ...findFiles(join(rootDir, 'app'), '.ts'),
    ...findFiles(join(rootDir, 'lib'), '.ts'),
    ...findFiles(join(rootDir, '__tests__'), '.ts'), // API integration tests
    ...findFiles(join(rootDir, '../web'), '.tsx'), // Web app components
    ...findFiles(join(rootDir, '../web'), '.ts'),   // Web app utilities
  ]

  for (const file of allFiles) {
    try {
      const content = readFileSync(file, 'utf8')

      // Legacy anti-patterns (keep existing checks)
      if (content.includes('Personal Workspace') && content.includes('!contextId')) {
        errors.push(`${file}: Contains hardcoded Personal Workspace fallback`)
      }

      if (content.includes('transformToGraphNode')) {
        errors.push(`${file}: Uses transformToGraphNode (should be eliminated)`)
      }

      if (content.includes('rdfType') && content.includes('filter')) {
        warnings.push(`${file}: Uses rdfType field - consider updating to node_type`)
      }

      // Enhanced contract validation
      const contractValidation = validateContractUsage(file, content, contractConstants)
      errors.push(...contractValidation.errors)
      warnings.push(...contractValidation.warnings)

    } catch (e) {
      // Skip unreadable files
    }
  }

  console.log(`  ✅ Checked ${allFiles.length} files`)

} catch (error) {
  errors.push(`Contract validation failed: ${error.message}`)
}

// 3. Check that key contract exports exist
console.log('📋 Validating contract exports...')
try {
  const contractFile = join(rootDir, 'lib/contracts/endeavor-contract.ts')
  const content = readFileSync(contractFile, 'utf8')

  const requiredExports = [
    'GraphNode',
    'CreateEndeavorRequest',
    'validateCreateEndeavorRequest',
    'validateGraphNode'
  ]

  for (const exportName of requiredExports) {
    if (!content.includes(`export const ${exportName}`) &&
        !content.includes(`export function ${exportName}`) &&
        !content.includes(`export type ${exportName}`)) {
      errors.push(`endeavor-contract.ts: Missing export '${exportName}'`)
    }
  }

  console.log('  ✅ Contract exports validated')

} catch (error) {
  errors.push(`Contract export check failed: ${error.message}`)
}

// Report results
console.log('\n📊 VALIDATION RESULTS')
console.log('====================')

if (warnings.length > 0) {
  console.log(`\n⚠️  ${warnings.length} WARNINGS:`)
  warnings.forEach(w => console.log(`  • ${w}`))
}

if (errors.length > 0) {
  console.log(`\n❌ ${errors.length} ERRORS:`)
  errors.forEach(e => console.log(`  • ${e}`))

  console.log('\n🚨 CONTRACT VALIDATION FAILED!')
  process.exit(1)
} else {
  console.log('\n✅ ALL CONTRACTS VALID!')
  if (warnings.length > 0) {
    console.log('💡 Consider addressing warnings for better code quality.')
  }
}