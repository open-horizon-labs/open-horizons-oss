import { StrategyConfig } from '../node-types'

/**
 * Agentic Flow Preset
 *
 * A strategy hierarchy designed for agentic and AI-native workflows:
 * Mission > Strategic Bet > Capability > Tactical Plan > Outcome
 *
 * Inspired by Theron's stack — emphasizes bets, capabilities,
 * and measurable outcomes over traditional project management.
 */
export const agenticFlowConfig: StrategyConfig = {
  name: 'Agentic Flow',
  id: 'agentic-flow',
  nodeTypes: [
    {
      name: 'Mission',
      slug: 'mission',
      description: 'High-level purpose and direction',
      color: '#7c3aed',
      icon: '\uD83C\uDFAF', // target emoji
      chipClasses: 'bg-purple-100 text-purple-800 border-purple-200',
      validChildren: ['strategic_bet'],
      validParents: []
    },
    {
      name: 'Strategic Bet',
      slug: 'strategic_bet',
      description: 'High-conviction investment areas with expected payoff',
      color: '#dc2626',
      icon: '\uD83C\uDFB2', // dice emoji
      chipClasses: 'bg-red-100 text-red-800 border-red-200',
      validChildren: ['capability'],
      validParents: ['mission']
    },
    {
      name: 'Capability',
      slug: 'capability',
      description: 'Skills, systems, or assets that enable execution',
      color: '#2563eb',
      icon: '\u2699\uFE0F', // gear emoji
      chipClasses: 'bg-blue-100 text-blue-800 border-blue-200',
      validChildren: ['tactical_plan'],
      validParents: ['strategic_bet']
    },
    {
      name: 'Tactical Plan',
      slug: 'tactical_plan',
      description: 'Concrete plans to build or leverage capabilities',
      color: '#16a34a',
      icon: '\uD83D\uDCCB', // clipboard emoji
      chipClasses: 'bg-green-100 text-green-800 border-green-200',
      validChildren: ['outcome'],
      validParents: ['capability']
    },
    {
      name: 'Outcome',
      slug: 'outcome',
      description: 'Measurable results that validate the strategy',
      color: '#ca8a04',
      icon: '\u2B50', // star emoji
      chipClasses: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      validChildren: [],
      validParents: ['tactical_plan']
    }
  ]
}
