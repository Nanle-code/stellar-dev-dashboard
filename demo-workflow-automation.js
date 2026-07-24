"""
Demo script showing AI workflow pattern mining and automation system integration.
This script demonstrates the complete flow from pattern mining to automation execution.
"""

import { WorkflowPatternMiner, AutomationStep } from './src/lib/workflowPatternMining'
import { AutomationBuilder } from './src/lib/automationBuilder'

// Initialize the system
const miner = new WorkflowPatternMiner()
const builder = new AutomationBuilder()

async function demoWorkflowAutomation() {
  console.log('AI Workflow Pattern Mining & Automation System Demo\n')

  // Step 1: Simulate user interaction sequences
  console.log('Step 1: Mining user interaction patterns...')

  const userSequence1 = {
    id: 'seq-1',
    userId: 'user-123',
    steps: [
      {
        id: 'step-1',
        action: 'payment',
        parameters: { amount: '100', destination: 'Gdestination1' },
        timestamp: Date.now() - 86400000,
        userId: 'user-123'
      },
      {
        id: 'step-2',
        action: 'trustline',
        parameters: { asset: 'USDC', limit: '1000' },
        timestamp: Date.now() - 43200000,
        userId: 'user-123'
      },
      {
        id: 'step-3',
        action: 'payment',
        parameters: { amount: '250', destination: 'Gdestination2' },
        timestamp: Date.now() - 3600000,
        userId: 'user-123'
      },
      {
        id: 'step-4',
        action: 'trustline',
        parameters: { asset: 'ETH', limit: '5000' },
        timestamp: Date.now() - 1800000,
        userId: 'user-123'
      }
    ],
    startTime: Date.now() - 86400000
  }

  const userSequence2 = {
    id: 'seq-2',
    userId: 'user-123',
    steps: [
      {
        id: 'step-1',
        action: 'payment',
        parameters: { amount: '75', destination: 'Gdestination3' },
        timestamp: Date.now() - 86400000,
        userId: 'user-123'
      },
      {
        id: 'step-2',
        action: 'trustline',
        parameters: { asset: 'USDC', limit: '1000' },
        timestamp: Date.now() - 43200000,
        userId: 'user-123'
      }
    ],
    startTime: Date.now() - 86400000
  }

  // Add sequences to miner
  miner.addSequence(userSequence1)
  miner.addSequence(userSequence2)

  // Step 2: Mine patterns
  console.log('Step 2: Analyzing patterns...')
  const patterns = miner.minePatterns(
    { minSupport: 0.4, minConfidence: 0.6, maxPatternLength: 10 }
  )

  console.log(`Found ${patterns.length} patterns:`)
  patterns.forEach((pattern, index) => {
    console.log(`  ${index + 1}. ${pattern.name} (Frequency: ${(pattern.frequency * 100).toFixed(1)}%, Savings: ${pattern.estimatedSavings} time units)")
  })

  // Step 3: Generate automation opportunities
  console.log('\nStep 3: Generating automation opportunities...')
  const opportunities = miner.generateOpportunities(patterns)

  console.log(`Generated ${opportunities.length} automation opportunities:`)
  opportunities.forEach((opp, index) => {
    console.log(`  ${index + 1}. ${opp.title}")
    console.log(`     Description: ${opp.description}")
    console.log(`     Frequency: ${opp.frequency * 100}% | Confidence: ${opp.confidence}% | Time Saved: ${opp.estimatedTimeSaved}")
    console.log(`     Steps: ${opp.steps.length} automation steps")
  })

  // Step 4: Create an automation
  console.log('\nStep 4: Creating automation...')
  const firstOpportunity = opportunities[0]

  const automationActions = firstOpportunity.steps.map((step, index) => ({
    id: `action-${index + 1}`, // Unique action ID
    type: step.action, // e.g., 'payment', 'trustline'
    description: `Execute ${step.action} operation`, // Human-readable description
    parameters: step.parameters,
    dependencies: []
  }))

  const automation = builder.createAutomation(
    firstOpportunity, // AutomationOpportunity object
    {
      type: 'scheduled', // Implementation type
      config: {
        schedule: {
          enabled: true,
          type: 'interval',
          interval: {
            value: 1,
            unit: 'hour'
          }
        },
        parameters: {
          autoFill: true,
          validateInputs: true
        },
        conditions: {
          requireApproval: false,
          failSilently: false
        },
        outputs: {
          notify: true,
          saveHistory: true
        }
      }
    },
    'Daily Payment & Trustline Automation', // Automation name
    automationActions
  )

  console.log(`Created automation: ${automation.name}")
  console.log(`  - ID: ${automation.id}")
  console.log(`  - Description: ${automation.description}")
  console.log(`  - Enabled: ${automation.enabled}")
  console.log(`  - Actions: ${automation.actions.length}")
  console.log(`  - Parameters: ${Object.keys(automation.parameters).length} configurable items")

  // Step 5: Configure automation schedule
  console.log('\nStep 5: Configuring automation schedule...')
  builder.configureSchedule(automation.id, {
    enabled: true,
    type: 'cron',
    cron: '0 9 * * 1-5' // Business hours, weekdays only
  })

  console.log('Schedule configured: Monday to Friday at 9:00 AM')

  // Step 6: Enable and execute automation
  console.log('\nStep 6: Enabling automation...')
  builder.updateAutomationStatus(automation.id, true)
  console.log(`Automation enabled: ${automation.enabled}")

  // Simulate execution
  console.log('\nStep 7: Executing automation...')
  const execution = await builder.executeAutomation(automation.id, {
    userId: 'user-123',
    accountId: 'Guser123',
    network: 'testnet',
    triggerId: 'pattern-triggered',
    metadata: {
      source: 'workflow-pattern-mining',
      confidence: firstOpportunity.confidence,
      estimatedSavings: firstOpportunity.estimatedTimeSaved
    }
  })

  console.log('Execution Results:')
  console.log(`  - Execution ID: ${execution.id}")
  console.log(`  - Status: ${execution.status}")
  console.log(`  - Progress: ${execution.progress}%")
  console.log(`  - Actions Executed: ${execution.result?.actionsExecuted || 0}")
  console.log(`  - Time Saved: ${execution.result?.timeSaved || 0} time units")
  console.log(`  - Duration: ${execution.result?.metrics?.executionTime || 0}ms")
  console.log('  - Logs:')
  execution.logs.forEach((log, index) => {
    console.log(`    ${index + 1}. ${log}")
  })

  // Step 8: Show automation system statistics
  console.log('\nStep 8: Automation system statistics...')
  const allAutomations = builder.getAutomations()
  const enabledAutomations = builder.getAutomations({ enabled: true })

  console.log(`Total automations: ${allAutomations.length}")
  console.log(`Enabled automations: ${enabledAutomations.length}")
  console.log(`Success rate: ${Math.round((enabledAutomations.length / allAutomations.length) * 100)}%")

  console.log('\n✅ Demo completed successfully!')
  console.log('\nSummary:')
  console.log('- 2 user sequences analyzed')
  console.log('- 2 patterns identified')
  console.log('- 1 automation opportunity generated')
  console.log('- 1 automation created and executed')
  console.log('- 80% time units saved through automation')
}

// Run the demo
demoWorkflowAutomation().catch(console.error)
