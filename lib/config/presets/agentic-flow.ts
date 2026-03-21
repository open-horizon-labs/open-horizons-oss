import { StrategyConfig } from '../node-types'

/**
 * Agentic Flow Preset
 *
 * A flat, four-level strategy hierarchy for AI-native workflows:
 * Mission > Strategic Bet > Capability > Outcome Spec
 *
 * Each level has a clear owner and answers one question:
 *   Mission:       Why do we exist?
 *   Strategic Bet: Where are we investing?
 *   Capability:    What must we be able to do?
 *   Outcome Spec:  How will we know it's working?
 *
 * Execution artifacts (tasks, plans, initiatives) belong in the
 * delivery layer (Linear, GitHub Issues, etc.), not the strategy graph.
 */
export const agenticFlowConfig: StrategyConfig = {
  name: 'Agentic Flow',
  id: 'agentic-flow',
  nodeTypes: [
    {
      name: 'Mission',
      slug: 'mission',
      description: 'Why we exist — fundamental purpose and direction',
      color: '#7c3aed',
      icon: '\uD83C\uDFAF', // target emoji
      chipClasses: 'bg-purple-100 text-purple-800 border-purple-200',
      validChildren: ['strategic_bet'],
      validParents: []
    },
    {
      name: 'Strategic Bet',
      slug: 'strategic_bet',
      description: 'Where we are investing — high-conviction areas with expected payoff',
      color: '#dc2626',
      icon: '\uD83C\uDFB2', // dice emoji
      chipClasses: 'bg-red-100 text-red-800 border-red-200',
      validChildren: ['capability'],
      validParents: ['mission']
    },
    {
      name: 'Capability',
      slug: 'capability',
      description: 'What we must be able to do — skills, systems, or platform abilities',
      color: '#2563eb',
      icon: '\u2699\uFE0F', // gear emoji
      chipClasses: 'bg-blue-100 text-blue-800 border-blue-200',
      validChildren: ['outcome_spec'],
      validParents: ['strategic_bet']
    },
    {
      name: 'Outcome Spec',
      slug: 'outcome_spec',
      description: 'How we will know it works — measurable, testable acceptance criteria',
      color: '#ca8a04',
      icon: '\u2705', // checkmark emoji
      chipClasses: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      validChildren: [],
      validParents: ['capability']
    }
  ]
}
