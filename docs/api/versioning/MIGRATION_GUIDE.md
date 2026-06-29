# API Migration Guide

Complete step-by-step guide for migrating between API versions.

## Quick Start

**Migration Time:** 2-4 hours (depending on complexity)  
**Difficulty:** Moderate  
**Prerequisites:** Node.js 18+

---

## Table of Contents

1. [v1.0.0 to v1.1.0](#v100-to-v110)
2. [v1.1.0 to v1.2.0](#v110-to-v120)
3. [v1.2.0 to v2.0.0](#v120-to-v200)
4. [v1.0.0 to v2.0.0 (Direct)](#v100-to-v200-direct)
5. [Common Issues](#common-issues)
6. [Rollback Procedure](#rollback-procedure)

---

## v1.0.0 to v1.1.0

**Status:** ✅ Low Risk  
**Breaking Changes:** None  
**Time:** ~15 minutes

### Step 1: Review Changes
```
- New /health endpoint
- Improved error codes  
- Rate limiting headers
```

### Step 2: Update Header
```diff
- X-API-Version: 1.0.0
+ X-API-Version: 1.1.0
```

### Step 3: Handle New Headers
```typescript
// Rate limiting headers added in v1.1.0
const rateLimit = response.headers['X-RateLimit-Limit']
const remaining = response.headers['X-RateLimit-Remaining']
const reset = response.headers['X-RateLimit-Reset']
```

### Step 4: (Optional) Use Health Endpoint
```typescript
// New in v1.1.0
const health = await fetch('/health')
const status = await health.json()
console.log(status) // { status: 'ok', version: '1.1.0' }
```

### Step 5: Test
```bash
npm test
```

### Step 6: Deploy
```bash
npm run build
npm run deploy
```

---

## v1.1.0 to v1.2.0

**Status:** ✅ Low Risk  
**Breaking Changes:** None  
**Time:** ~30 minutes

### Step 1: Review Deprecations
```
⚠️ DEPRECATED (will be removed in v2.0.0):
- GET /transactions/:id/memo
- Field: user_address → use publicKey instead
- Header: X-Legacy-Auth → use OAuth 2.0 instead
```

### Step 2: Update Header
```diff
- X-API-Version: 1.1.0
+ X-API-Version: 1.2.0
```

### Step 3: Update Code (Preventive)
```typescript
// OLD (will break in v2.0.0)
const memo = transaction.memo

// NEW (works in v1.2.0 and v2.0.0)
const memo = transaction.transaction_meta?.memo
```

### Step 4: Remove Deprecated Patterns
```typescript
// OLD
const address = account.user_address

// NEW
const address = account.publicKey
```

### Step 5: Update Authentication
```typescript
// OLD
headers: {
  'X-Legacy-Auth': token
}

// NEW
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Step 6: Test
```bash
npm test
```

### Step 7: Deploy
```bash
npm run build
npm run deploy
```

---

## v1.2.0 to v2.0.0

**Status:** ⚠️ Significant Changes  
**Breaking Changes:** Yes  
**Time:** ~2 hours

### Step 1: Install Migration Tool (Optional)
```bash
npm install --save-dev @stellar-dev-dashboard/migrate-v1-to-v2

# Automated migration
npx migrate-v1-to-v2 --input src/api.ts --output src/api.v2.ts
```

### Step 2: Update Header/URL
```diff
# Header strategy:
- X-API-Version: 1.2.0
+ X-API-Version: 2.0.0

# URL path strategy:
- GET /api/v1/accounts/:id
+ GET /api/v2/accounts/:id
```

### Step 3: Response Format Changes

#### Accounts Endpoint
```typescript
// v1.2.0
{
  id: 'account-123',
  balance_string: '1000.50',
  balance_num: 1000.50,
  sequence: '12345'
}

// v2.0.0
{
  id: 'account-123',
  balances: [
    {
      balance: '1000.50',
      asset_code: 'XLM',
      asset_issuer: null
    }
  ],
  sequence: '12345'
}
```

**Update code:**
```typescript
// v1.2.0
const balance = account.balance_num

// v2.0.0
const balance = parseFloat(account.balances[0].balance)
```

#### Transactions Endpoint
```typescript
// v1.2.0
{
  id: 'tx-123',
  memo: 'payment',
  memo_type: 'text'
}

// v2.0.0
{
  id: 'tx-123',
  transaction_meta: {
    memo: 'payment',
    memo_type: 'text'
  }
}
```

**Update code:**
```typescript
// v1.2.0
const memo = transaction.memo

// v2.0.0
const memo = transaction.transaction_meta.memo
```

### Step 4: Field Renames
```typescript
// v1.2.0
interface Account {
  user_address: string
  account_id: string
  created_at: string
}

// v2.0.0
interface Account {
  publicKey: string      // was user_address
  accountId: string      // was account_id
  createdAt: string      // was created_at
}
```

**Update all occurrences:**
```typescript
// OLD
account.user_address
account.account_id
transaction.created_at

// NEW
account.publicKey
account.accountId
transaction.createdAt
```

### Step 5: Authentication Update
```typescript
// v1.2.0
headers: {
  'Authorization': `Bearer ${token}`
}

// v2.0.0 (OAuth 2.0)
const response = await fetch('https://auth.stellar.dev/oauth/token', {
  method: 'POST',
  body: JSON.stringify({
    grant_type: 'client_credentials',
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET
  })
})
const { access_token } = await response.json()

headers: {
  'Authorization': `Bearer ${access_token}`
}
```

### Step 6: Endpoint Path Changes
```typescript
// v1.2.0
GET /accounts/:id/transactions
GET /transactions/:id/operations

// v2.0.0
GET /accounts/:id/activity     // consolidated
GET /activity/:id/operations   // new structure
```

### Step 7: Error Handling Updates
```typescript
// v2.0.0 has improved error codes
{
  code: 'RATE_LIMIT_EXCEEDED',    // more specific
  message: 'Too many requests',
  retryAfter: 60,                  // new field
  details: {                       // new details object
    limit: 1000,
    remaining: 0,
    resetAt: '2024-01-01T12:00:00Z'
  }
}
```

### Step 8: Test All Changes
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e
```

### Step 9: Gradual Rollout (Recommended)
```typescript
// Version A/B test
const useV2 = Math.random() < 0.1 // Start with 10% users

const version = useV2 ? '2.0.0' : '1.2.0'
const headers = {
  'X-API-Version': version
}
```

### Step 10: Monitor and Deploy
```bash
# Check metrics
npm run check-version-adoption

# Deploy to production
npm run deploy

# Monitor error rates
npm run monitor-errors
```

---

## v1.0.0 to v2.0.0 (Direct)

**Status:** ⚠️ Complex  
**Breaking Changes:** Yes  
**Time:** ~4 hours

### Recommended: Upgrade Path
Instead of direct upgrade, go through intermediate versions:
```
1.0.0 → 1.1.0 → 1.2.0 → 2.0.0
```

This is safer and easier than a direct jump.

### If Direct Migration Required:

1. **Step 1-2:** Follow v1.2.0 to v2.0.0 guide (Steps 1-2)
2. **Step 3:** Map all v1.0.0 response formats to v2.0.0
3. **Step 4-10:** Continue with v1.2.0 to v2.0.0 guide (Steps 4-10)

---

## Common Issues

### Issue 1: "Invalid API Version"

**Symptom:**
```
Error: Invalid API Version: 1.2.0
```

**Solution:**
```typescript
// Make sure header is spelled correctly
headers: {
  'X-API-Version': '1.2.0'  // capital 'X', capital 'Version'
}

// Or use URL path
GET /api/v1/accounts/...  // if using URL strategy
```

### Issue 2: Response Format Mismatch

**Symptom:**
```
TypeError: Cannot read property 'balance' of undefined
```

**Solution:**
```typescript
// Check which version returned the response
const version = response.headers['X-API-Version']
console.log('API Version:', version)

// Map response to expected format
if (version === '2.0.0') {
  const balance = response.balances[0].balance
} else {
  const balance = response.balance_num
}
```

### Issue 3: Authentication Fails

**Symptom:**
```
Error: 401 Unauthorized
```

**Solution:**
```typescript
// v1.2.0: Bearer token
headers: {
  'Authorization': `Bearer ${token}`
}

// v2.0.0: OAuth 2.0
const token = await getOAuth2Token()
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Issue 4: Rate Limiting Changes

**Symptom:**
```
Error: 429 Too Many Requests
```

**Solution:**
```typescript
// Check new rate limit headers
const remaining = response.headers['X-RateLimit-Remaining']
const resetAt = response.headers['X-RateLimit-Reset']

if (remaining === '0') {
  const delay = new Date(resetAt) - new Date()
  await sleep(delay)
}
```

### Issue 5: Timeout Issues

**Symptom:**
```
Error: Request timeout
```

**Solution:**
```typescript
// v2.0.0 might be slower during transition
const timeout = 10000  // increase from 5000

fetch(url, {
  signal: AbortSignal.timeout(timeout)
})
```

---

## Rollback Procedure

If migration fails, here's how to rollback:

### Immediate Rollback
```bash
# Revert to previous version
git revert HEAD

# Or switch header back
headers: {
  'X-API-Version': '1.2.0'
}

# Or revert URL paths
GET /api/v1/accounts/...  // instead of /v2/
```

### Gradual Rollback
```typescript
// Use version voting to detect issues
const useV2 = checkVersionHealth()

const version = useV2 ? '2.0.0' : '1.2.0'
headers: {
  'X-API-Version': version
}
```

### Data Consistency
```typescript
// Check data format before processing
const format = detectResponseFormat(response)

if (format === 'v1') {
  return parseV1Response(response)
} else if (format === 'v2') {
  return parseV2Response(response)
}
```

---

## Success Criteria

✅ All tests pass  
✅ Error rate < 0.5%  
✅ Response time within normal range  
✅ No data loss  
✅ All endpoints responding  
✅ Rate limiting working  
✅ Authentication successful  
✅ Monitoring alerts cleared  

---

## Support

- **Questions:** support@stellar.dev
- **Issues:** github.com/stellar/dev-dashboard/issues
- **Migration Help:** migration-team@stellar.dev

---

## Related

- [VERSIONING.md](./VERSIONING.md) - Full versioning guide
- [CHANGELOG.md](./CHANGELOG.md) - Complete version history
- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Endpoint reference
