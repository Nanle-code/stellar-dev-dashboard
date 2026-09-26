// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  gettingStarted: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/authentication',
        'getting-started/networks',
      ],
    },
  ],

  apiReference: [
    {
      type: 'category',
      label: 'API Reference',
      collapsed: false,
      items: [
        'api-reference/overview',
        {
          type: 'category',
          label: 'Horizon REST API',
          items: [
            'api-reference/horizon/accounts',
            'api-reference/horizon/transactions',
            'api-reference/horizon/operations',
            'api-reference/horizon/ledgers',
            'api-reference/horizon/order-book',
            'api-reference/horizon/path-finding',
            'api-reference/horizon/submit-transaction',
          ],
        },
        {
          type: 'category',
          label: 'Soroban RPC',
          items: [
            'api-reference/soroban/overview',
            'api-reference/soroban/simulate-transaction',
            'api-reference/soroban/send-transaction',
            'api-reference/soroban/get-transaction',
            'api-reference/soroban/get-contract-data',
            'api-reference/soroban/get-events',
          ],
        },
        {
          type: 'category',
          label: 'SDK Modules',
          items: [
            'api-reference/sdk/stellar-service',
            'api-reference/sdk/transaction-builder',
            'api-reference/sdk/contract-invoker',
            'api-reference/sdk/dex',
            'api-reference/sdk/encryption',
            'api-reference/sdk/storage',
            'api-reference/sdk/rate-limiter',
            'api-reference/sdk/error-handling',
          ],
        },
        {
          type: 'category',
          label: 'External Services',
          items: [
            'api-reference/external/coingecko',
            'api-reference/external/friendbot',
          ],
        },
        'api-reference/error-reference',
        'api-reference/rate-limiting',
      ],
    },
  ],

  guides: [
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        'guides/getting-started-guide',
        'guides/sending-payments',
        'guides/working-with-assets',
        'guides/soroban-smart-contracts',
        'guides/dex-trading',
        'guides/transaction-templates',
        'guides/developer-toolkit',
        'guides/error-handling',
        'guides/rate-limiting',
        'guides/horizon-pagination',
        'guides/offline-support',
        'guides/advanced-tutorials',
        'guides/wallet-connection-troubleshooting',
        'guides/troubleshooting',
        {
          type: 'category',
          label: 'App features',
          items: [
            'guides/features/overview',
            'guides/features/asset-discovery',
            'guides/features/chart-accessibility',
            'guides/features/collaboration',
            'guides/features/dashboard-customization',
            'guides/features/liquidity-position-estimates',
            'guides/features/live-activity-feed',
            'guides/features/multi-agent-system',
            'guides/features/muxed-federated',
            'guides/features/power-user',
            'guides/features/sentiment-quick-start',
            'guides/features/transaction-builder',
            'guides/features/tutorial-system',
            'guides/features/visual-flow',
          ],
        },
        {
          type: 'category',
          label: 'Portfolio',
          items: [
            'guides/portfolio/analytics-guide',
            'guides/portfolio/analytics-example',
            'guides/portfolio/analytics-implementation',
          ],
        },
        {
          type: 'category',
          label: 'Mobile',
          items: [
            'guides/mobile/optimization',
            'guides/mobile/quick-reference',
            'guides/mobile/responsive-features',
          ],
        },
        {
          type: 'category',
          label: 'Developer',
          items: [
            'guides/developer/ai-contract-testing',
            'guides/developer/code-structure',
            'guides/developer/developer-tools',
            'guides/developer/documentation-index',
            'guides/developer/environment-profiles',
            'guides/developer/error-handling-app',
            'guides/developer/typescript-setup',
            'guides/developer/visual-testing',
          ],
        },
      ],
    },
  ],

  examples: [
    {
      type: 'category',
      label: 'Code Examples',
      collapsed: false,
      items: [
        'examples/overview',
        {
          type: 'category',
          label: 'JavaScript / TypeScript',
          items: [
            'examples/js/fetch-account',
            'examples/js/send-payment',
            'examples/js/create-trustline',
            'examples/js/invoke-contract',
            'examples/js/dex-swap',
            'examples/js/stream-transactions',
          ],
        },
        {
          type: 'category',
          label: 'Python',
          items: [
            'examples/python/fetch-account',
            'examples/python/send-payment',
            'examples/python/create-trustline',
            'examples/python/invoke-contract',
          ],
        },
        {
          type: 'category',
          label: 'Error Scenarios',
          items: [
            'examples/errors/transaction-failed',
            'examples/errors/rate-limit',
            'examples/errors/insufficient-funds',
          ],
        },
      ],
    },
  ],

  archive: [
    {
      type: 'category',
      label: 'Archive',
      collapsed: true,
      items: [
        'archive/implementation-checklist',
        'archive/todo',
      ],
    },
  ],
};

export default sidebars;
