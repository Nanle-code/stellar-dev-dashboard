# API CHANGELOG

Track of all API versions, changes, and migration notes.

## Version History

### [2.0.0] - 2024-12-01

**Status:** Current Stable Release

**Features:**
- ✨ New account analytics endpoints
- ✨ Enhanced transaction filtering
- ✨ Real-time stream improvements
- ✨ Soroban contract execution API
- ✨ WebSocket support for live updates

**Breaking Changes:**
- 🚨 `/accounts/:id` response format changed
  - Removed: `balance_string`, `balance_num`
  - Added: `balances` (array)
  - Migration: See MIGRATION_GUIDE.md
- 🚨 `/transactions/:id` no longer returns `memo` as separate field
  - Memo is now nested under `transaction_meta`
- 🚨 Authentication changed from JWT to OAuth 2.0

**Deprecations:**
- ⚠️ `/v1/accounts/:id` - sunset 2024-12-31
- ⚠️ `X-Legacy-Auth` header - sunset 2024-12-31

**Improvements:**
- 🔧 Performance improvements (30% faster queries)
- 🔧 Improved error messages
- 🔧 Better rate limiting headers
- 🔧 Enhanced logging for debugging

**Migration Effort:** ~2 hours for average integration

---

### [1.2.0] - 2024-06-01

**Status:** Deprecated (Sunset: 2024-12-31)

**Features:**
- ✨ Added deprecation warnings
- ✨ New `/analytics/version-usage` endpoint
- ✨ Improved pagination

**Deprecations:**
- ⚠️ `/transactions/:id/memo` - removed in v2.0.0
- ⚠️ `user_address` field - renamed to `publicKey` in v2.0.0
- ⚠️ `X-Legacy-Auth` header - replaced by OAuth 2.0 in v2.0.0

**Notes:**
- Backward compatible with 1.0.0 and 1.1.0
- Recommended upgrade path: 1.2.0 → 2.0.0

**Migration Effort:** ~30 minutes

---

### [1.1.0] - 2024-03-01

**Status:** Unsupported (Sunset: 2024-12-31)

**Features:**
- ✨ Added `/health` endpoint
- ✨ Improved error codes
- ✨ Rate limiting support

**Improvements:**
- 🔧 Better error responses
- 🔧 Added `X-RateLimit-*` headers

**Backward Compatibility:** ✅ Compatible with 1.0.0

**Migration Effort:** Minimal

---

### [1.0.0] - 2023-12-01

**Status:** End of Life (Sunset: 2024-12-31)

**Initial Release:**
- Basic account query endpoints
- Transaction listing
- Operation history
- Simple rate limiting

---

## Upgrade Paths

### 1.0.0 → 1.1.0
- **Effort:** Minimal
- **Breaking Changes:** None
- **Time:** ~15 minutes

### 1.1.0 → 1.2.0
- **Effort:** Minimal
- **Breaking Changes:** None
- **Time:** ~30 minutes

### 1.2.0 → 2.0.0
- **Effort:** Moderate
- **Breaking Changes:** Yes (see MIGRATION_GUIDE.md)
- **Time:** ~2 hours
- **Tools:** `@stellar-dev-dashboard/migrate-v1-to-v2`

### 1.0.0 → 2.0.0 (Direct)
- **Effort:** Significant
- **Breaking Changes:** Yes
- **Time:** ~4 hours
- **Recommendation:** Upgrade to 1.2.0 first

---

## Support Timeline

| Version | Released   | Deprecated | Sunset     | Status      |
|---------|-----------|-----------|-----------|------------|
| 1.0.0   | 2023-12-01| 2024-03-01| 2024-12-31| End of Life |
| 1.1.0   | 2024-03-01| 2024-06-01| 2024-12-31| Unsupported |
| 1.2.0   | 2024-06-01| 2024-12-01| 2024-12-31| Deprecated  |
| 2.0.0   | 2024-12-01| TBD       | TBD       | Current    |

---

## Breaking Changes by Version

### v1.1.0
- None (fully backward compatible with v1.0.0)

### v1.2.0
- None (fully backward compatible with v1.0.0-1.1.0)

### v2.0.0
- ✅ Response format changes
- ✅ Field renames
- ✅ Authentication method
- ✅ Endpoint path changes
- ✅ Header changes

See MIGRATION_GUIDE.md for detailed list.

---

## Deprecated Features

### v1.2.0+

| Feature | Deprecated | Sunset | Replacement |
|---------|-----------|--------|-------------|
| `/transactions/:id/memo` | 2024-06-01 | 2024-12-31 | `transactions[].meta.memo` |
| `user_address` field | 2024-06-01 | 2024-12-31 | `publicKey` field |
| `X-Legacy-Auth` header | 2024-06-01 | 2024-12-31 | OAuth 2.0 |
| `/v1/accounts/:id` | 2024-06-01 | 2024-12-31 | `/v2/accounts/:id` |

---

## Migration Tools

### Available Tools

```bash
# Automated migration from v1 to v2
npm install @stellar-dev-dashboard/migrate-v1-to-v2

# Usage
migrate-v1-to-v2 --input data.json --output data-v2.json
```

### Manual Resources

- 📖 [Migration Guide](./MIGRATION_GUIDE.md)
- 📖 [API Endpoints](./API_ENDPOINTS.md)
- 📖 [Versioning Guide](./VERSIONING.md)

---

## FAQ

**Q: Which version should I use?**
A: Always use the latest stable version (2.0.0). It has the best performance and features.

**Q: When does my version sunset?**
A: Check the Support Timeline table above. All versions sunset on 2024-12-31.

**Q: Can I use multiple versions?**
A: No, use only one version in production. Use the `X-API-Version` header or URL prefix to specify.

**Q: How do I migrate?**
A: Follow the step-by-step guide in MIGRATION_GUIDE.md.

**Q: What happens after sunset?**
A: Old endpoints return 410 Gone with redirect information.

---

## Contact

- **Questions?** support@stellar.dev
- **Report Issues:** github.com/stellar/dev-dashboard/issues
- **Migration Help:** migration-team@stellar.dev
