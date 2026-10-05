/**
 * Shared Playwright fixtures for critical-path E2E tests (#405).
 *
 *   import { test, expect } from './support/fixtures';
 *
 *   test('…', async ({ page, stellar, freighter }) => {
 *     stellar.setAccount(buildHorizonAccount({ seed: 'alice' }));
 *     stellar.setSorobanScenario('auth_failure');
 *     await freighter.install();
 *   });
 *
 * - `stellar` answers Horizon, Soroban RPC, Friendbot and price-feed calls
 *   from deterministic fixtures, so tests never touch a live network. Any
 *   request it does not recognise is aborted and recorded in
 *   `stellar.unhandled`, so an unmocked endpoint shows up in the test.
 * - `freighter` / `ledger` inject the wallet mocks in `tests/e2e/fixtures/`.
 * - `expect` gains Stellar-specific matchers (see `./stellarAssertions.ts`).
 */

import { test as base, expect as baseExpect, type Page, type Route } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSorobanFixtureFactory,
  type SorobanFixtureScenario,
} from '../../__factories__/sorobanContractFixtures';
import {
  buildHorizonAccount,
  buildLedgerRecord,
  buildNotFound,
  buildSubmitFailure,
  buildSubmitSuccess,
  horizonPage,
} from './dataFactories';
import {
  checkContractId,
  checkShortAddressOf,
  checkStellarAmount,
  checkStellarPublicKey,
  checkTransactionHash,
} from './stellarAssertions';

const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

type HorizonAccount = ReturnType<typeof buildHorizonAccount>;
type SubmitMode = 'success' | 'failure' | 'timeout';

export interface StellarNetworkMock {
  /** The account served for `GET /accounts/:id`; `null` serves a 404 (unfunded account). */
  setAccount(account: HorizonAccount | null): void;
  setSubmitMode(mode: SubmitMode): void;
  setSorobanScenario(scenario: SorobanFixtureScenario): void;
  readonly soroban: ReturnType<typeof createSorobanFixtureFactory>;
  /** Bodies of every `POST /transactions` the app sent. */
  readonly submissions: string[];
  /** Requests that matched no mock and were aborted. */
  readonly unhandled: string[];
}

export interface WalletMock {
  /** Inject the mock before the next navigation. */
  install(): Promise<void>;
}

const EXTERNAL = /^https?:\/\/(?!localhost|127\.0\.0\.1)/;

async function installNetworkMock(page: Page): Promise<StellarNetworkMock> {
  let account: HorizonAccount | null = buildHorizonAccount();
  let submitMode: SubmitMode = 'success';
  let sorobanScenario: SorobanFixtureScenario = 'success';
  const soroban = createSorobanFixtureFactory({ seed: 'e2e' });
  const submissions: string[] = [];
  const unhandled: string[] = [];

  const handle = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (/soroban|rpc/i.test(url.hostname) || /\/(soroban\/)?rpc\/?$/.test(pathname)) {
      if (request.method() !== 'POST') return route.fulfill({ status: 405, json: {} });
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        /* malformed body — handled as an invalid request below */
      }
      return route.fulfill({ json: soroban.handle(body, sorobanScenario) });
    }

    if (url.hostname.startsWith('friendbot') || pathname.startsWith('/friendbot')) {
      return route.fulfill({ json: buildSubmitSuccess('friendbot') });
    }

    if (/coingecko|\/simple\/price/.test(url.href)) {
      return route.fulfill({ json: { stellar: { usd: 0.1, usd_24h_change: 0 } } });
    }

    if (/horizon/i.test(url.hostname)) {
      if (request.method() === 'POST' && pathname === '/transactions') {
        submissions.push(request.postData() ?? '');
        if (submitMode === 'timeout') return route.fulfill({ status: 504, json: { status: 504, title: 'Timeout' } });
        if (submitMode === 'failure') return route.fulfill({ status: 400, json: buildSubmitFailure() });
        return route.fulfill({ json: buildSubmitSuccess(`submit-${submissions.length}`) });
      }
      const accountMatch = /^\/accounts\/([A-Z0-9]+)\/?$/.exec(pathname);
      if (accountMatch) {
        return account
          ? route.fulfill({ json: { ...account, id: accountMatch[1], account_id: accountMatch[1] } })
          : route.fulfill({ status: 404, json: buildNotFound() });
      }
      const ledgerMatch = /^\/ledgers\/(\d+)\/?$/.exec(pathname);
      if (ledgerMatch) return route.fulfill({ json: buildLedgerRecord(Number(ledgerMatch[1])) });
      if (pathname === '/ledgers' || pathname === '/ledgers/') {
        // Newest first, like `?order=desc`, which is what every dashboard widget requests.
        return route.fulfill({ json: horizonPage(Array.from({ length: 10 }, (_, i) => buildLedgerRecord(1000 - i))) });
      }
      if (pathname === '/fee_stats') {
        const p = { max: '100', min: '100', mode: '100', p10: '100', p50: '100', p90: '100', p99: '100' };
        return route.fulfill({ json: { last_ledger: '1000', last_ledger_base_fee: '100', ledger_capacity_usage: '0.5', fee_charged: p, max_fee: p } });
      }
      if (pathname === '/' || pathname === '') {
        return route.fulfill({ json: { network_passphrase: 'Test SDF Network ; September 2015', history_latest_ledger: 1000, core_latest_ledger: 1000 } });
      }
      // Collections (transactions, operations, payments, offers, ledgers, …) are quiet by default.
      return route.fulfill({ json: horizonPage([]) });
    }

    unhandled.push(`${request.method()} ${url.origin}${pathname}`);
    return route.abort('blockedbyclient');
  };

  await page.route(EXTERNAL, handle);

  return {
    setAccount: (next) => {
      account = next;
    },
    setSubmitMode: (mode) => {
      submitMode = mode;
    },
    setSorobanScenario: (scenario) => {
      sorobanScenario = scenario;
    },
    soroban,
    submissions,
    unhandled,
  };
}

export const test = base.extend<{ stellar: StellarNetworkMock; freighter: WalletMock; ledger: WalletMock }>({
  stellar: async ({ page }, provide) => {
    // Skip first-run onboarding so every test starts on the connect screen.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('hasCompletedOnboarding', 'true');
      } catch {
        /* storage unavailable (private mode) — onboarding will show */
      }
    });
    // Decline the first-run analytics consent dialog whenever it covers the page.
    await page.addLocatorHandler(page.getByRole('button', { name: 'Decline', exact: true }), async (decline) => {
      await decline.click();
    }, { noWaitAfter: true });
    // The guided tour can open over the dashboard for first-time sessions.
    await page.addLocatorHandler(page.getByRole('button', { name: 'Skip tour', exact: true }), async (skip) => {
      await skip.click();
    }, { noWaitAfter: true });
    await provide(await installNetworkMock(page));
  },
  freighter: async ({ page }, provide) => {
    await provide({ install: () => page.addInitScript({ path: path.join(FIXTURES_DIR, 'freighter-mock.js') }) });
  },
  ledger: async ({ page }, provide) => {
    await provide({ install: () => page.addInitScript({ path: path.join(FIXTURES_DIR, 'ledger-mock.js') }) });
  },
});

type Check = { pass: boolean; message: string };
const toMatcher = (check: Check) => ({ pass: check.pass, message: () => check.message });

export const expect = baseExpect.extend({
  toBeStellarPublicKey(received: unknown) {
    return toMatcher(checkStellarPublicKey(received));
  },
  toBeContractId(received: unknown) {
    return toMatcher(checkContractId(received));
  },
  toBeTransactionHash(received: unknown) {
    return toMatcher(checkTransactionHash(received));
  },
  toBeStellarAmount(received: unknown) {
    return toMatcher(checkStellarAmount(received));
  },
  toBeShortAddressOf(received: unknown, fullAddress: string) {
    return toMatcher(checkShortAddressOf(received, fullAddress));
  },
});
