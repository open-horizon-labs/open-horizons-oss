import { StrategyConfig } from '../node-types'

/**
 * Open Horizons Default Preset
 *
 * The classic strategy hierarchy: Mission > Aim > Initiative
 * This is the original Open Horizons model focused on
 * purpose-driven alignment from vision to execution.
 */
export const openHorizonsConfig: StrategyConfig = {
  name: 'Open Horizons Default',
  id: 'open-horizons',
  nodeTypes: [
    {
      name: 'Mission',
      slug: 'mission',
      description: 'High-level purpose and direction',
      color: '#7c3aed',
      icon: '\uD83C\uDFAF', // target emoji
      chipClasses: 'bg-purple-100 text-purple-800 border-purple-200',
      validChildren: ['aim'],
      validParents: []
    },
    {
      name: 'Aim',
      slug: 'aim',
      description: 'Strategic objectives and measurable outcomes',
      color: '#2563eb',
      icon: '\uD83C\uDFF9', // bow-and-arrow emoji
      chipClasses: 'bg-blue-100 text-blue-800 border-blue-200',
      validChildren: ['initiative'],
      validParents: ['mission']
    },
    {
      name: 'Initiative',
      slug: 'initiative',
      description: 'Active projects and work streams',
      color: '#16a34a',
      icon: '\uD83D\uDE80', // rocket emoji
      chipClasses: 'bg-green-100 text-green-800 border-green-200',
      validChildren: ['task'],
      validParents: ['aim']
    },
    {
      name: 'Task',
      slug: 'task',
      description: 'Specific actionable items',
      color: '#6b7280',
      icon: '\u2713', // checkmark
      chipClasses: 'bg-gray-100 text-gray-800 border-gray-200',
      validChildren: [],
      validParents: ['initiative']
    }
  ]
}
