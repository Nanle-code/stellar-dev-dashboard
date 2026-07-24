// @ts-check
// Docusaurus configuration for Stellar Dev Dashboard API Documentation
// D-012: Comprehensive API Documentation with Interactive Examples

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Stellar Dev Dashboard',
  tagline: 'Comprehensive API documentation with interactive examples',
  favicon: 'img/favicon.ico',
  url: 'https://damiedee96.github.io',
  baseUrl: '/stellar-dev-dashboard/',
  organizationName: 'damiedee96',
  projectName: 'stellar-dev-dashboard',
  trailingSlash: false,
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/damiedee96/stellar-dev-dashboard/edit/master/docs-site/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'stellar-api',
        docsPluginId: 'classic',
        config: {
          stellarApi: {
            specPath: '../docs/api/openapi.yaml',
            outputDir: 'docs/api-reference',
            sidebarOptions: {
              groupPathsBy: 'tag',
              categoryLinkSource: 'tag',
            },
          },
        },
      },
    ],
  ],

  themes: ['docusaurus-theme-openapi-docs'],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Stellar Dev Dashboard',
        logo: {
          alt: 'Stellar Dev Dashboard Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'gettingStarted',
            position: 'left',
            label: 'Getting Started',
          },
          {
            type: 'docSidebar',
            sidebarId: 'apiReference',
            position: 'left',
            label: 'API Reference',
          },
          {
            type: 'docSidebar',
            sidebarId: 'guides',
            position: 'left',
            label: 'Guides',
          },
          {
            type: 'docSidebar',
            sidebarId: 'examples',
            position: 'left',
            label: 'Examples',
          },
          {
            label: 'Interactive Explorer',
            to: '/docs/api-explorer',
            position: 'left',
          },
          {
            href: 'https://github.com/damiedee96/stellar-dev-dashboard',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/docs/getting-started' },
              { label: 'API Reference', to: '/docs/api-reference' },
              { label: 'Examples', to: '/docs/examples' },
            ],
          },
          {
            title: 'Stellar Network',
            items: [
              { label: 'Stellar Developers', href: 'https://developers.stellar.org' },
              { label: 'Horizon API', href: 'https://developers.stellar.org/api/horizon' },
              { label: 'Soroban Docs', href: 'https://developers.stellar.org/docs/smart-contracts' },
            ],
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub', href: 'https://github.com/damiedee96/stellar-dev-dashboard' },
              { label: 'Stellar Discord', href: 'https://discord.gg/stellar' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Stellar Dev Dashboard. Built with Docusaurus.`,
      },
      prism: {
        theme: { plain: { color: '#cdd6f4', backgroundColor: '#1e1e2e' }, styles: [] },
        additionalLanguages: ['bash', 'json', 'python', 'typescript', 'rust'],
      },
      algolia: {
        // Replace with actual Algolia credentials when available
        appId: 'YOUR_APP_ID',
        apiKey: 'YOUR_SEARCH_API_KEY',
        indexName: 'stellar-dev-dashboard',
      },
    }),
};

export default config;
