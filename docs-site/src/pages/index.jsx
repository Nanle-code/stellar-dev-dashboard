import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

function HeroSection() {
  return (
    <div className={styles.hero}>
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>Stellar Dev Dashboard</h1>
        <p className={styles.heroSubtitle}>
          Comprehensive API documentation with interactive examples for Horizon,
          Soroban RPC, and the full SDK surface.
        </p>
        <div className={styles.heroCtas}>
          <Link className="button button--primary button--lg" to="/docs/getting-started">
            Get Started →
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/api-reference/overview">
            API Reference
          </Link>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: '🔭 Interactive Explorer',
    description:
      'Test every Horizon and Soroban RPC endpoint live from the browser. Load the OpenAPI spec into Postman, Insomnia, or Swagger UI in one click.',
    link: '/docs/api-explorer',
  },
  {
    title: '💻 Multi-language Examples',
    description:
      'Copy-paste ready code in JavaScript, TypeScript, and Python. Every example is runnable against the Stellar Testnet.',
    link: '/docs/examples/overview',
  },
  {
    title: '📚 Full API Reference',
    description:
      'Every endpoint, parameter, request/response shape, and error code documented. Covers Horizon REST, Soroban RPC, CoinGecko, and Friendbot.',
    link: '/docs/api-reference/overview',
  },
  {
    title: '🛠 SDK Module Docs',
    description:
      'Auto-generated reference for all 50+ exported modules in src/lib — stellar.ts, contractInvoker, rateLimiter, errorHandling, and more.',
    link: '/docs/api-reference/sdk/stellar-service',
  },
  {
    title: '📖 Step-by-step Guides',
    description:
      'Getting started, sending payments, Soroban smart contracts, DEX trading, error handling, offline support, and advanced patterns.',
    link: '/docs/guides/getting-started-guide',
  },
  {
    title: '🤖 CI/CD Auto-deploy',
    description:
      'Documentation regenerates from JSDoc on every push and deploys to GitHub Pages automatically via the docs.yml workflow.',
    link: 'https://github.com/damiedee96/stellar-dev-dashboard/blob/master/.github/workflows/docs.yml',
  },
];

function FeatureCard({ title, description, link }) {
  return (
    <Link className={styles.featureCard} to={link}>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{description}</p>
    </Link>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <main>
        <HeroSection />
        <section className={styles.features}>
          <div className={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>

        <section className={styles.quickStart}>
          <h2>60-second quick start</h2>
          <pre className={styles.codeBlock}>{`# 1. Install the SDK
npm install @stellar/stellar-sdk

# 2. Fund a testnet account
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"

# 3. Fetch the account
node -e "
import('@stellar/stellar-sdk').then(async ({ Horizon }) => {
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  const acct   = await server.loadAccount('YOUR_PUBLIC_KEY');
  acct.balances.forEach(b => console.log(b.asset_type, b.balance));
});
"`}</pre>
          <Link className="button button--primary" to="/docs/getting-started/quick-start">
            Full Quick Start →
          </Link>
        </section>
      </main>
    </Layout>
  );
}
