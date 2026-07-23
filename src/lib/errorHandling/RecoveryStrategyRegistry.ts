import { selfHealingManager, type RecoveryStrategy } from './SelfHealingManager'

const defaultStrategy: RecoveryStrategy = {
  id: 'default',
  name: 'Default Recovery',
  description: 'Marks the service healthy after a short delay.',
  apply: async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  },
}

export function registerBuiltInStrategies(): void {
  selfHealingManager.registerStrategy(defaultStrategy)
}

export async function registerNetworkProbes(): Promise<void> {
  await Promise.resolve()
}
