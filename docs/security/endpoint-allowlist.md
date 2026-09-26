# Federation and SEP endpoint allowlist

Federation and SEP discovery crosses a security boundary: an anchor-controlled
`stellar.toml` can direct the dashboard to another server. The dashboard now
validates every discovered federation and SEP endpoint before using it.

## Default policy

- Endpoints must use HTTPS and must not include URL credentials.
- The endpoint host must equal the federation or anchor home domain, or be one
  of its subdomains. Matching is label-aware, so `anchor.example.evil.test`
  does not match `anchor.example`.
- Malformed URLs, unsupported protocols, missing domain context, and unexpected
  domains are blocked before a request is sent. A console warning is emitted;
  rejected SEP capability URLs are also written to the security audit trail.

## Cross-domain services

Some anchors intentionally host SEP services on a shared domain. Add those
trusted domains as a comma-separated Vite build variable:

```env
VITE_STELLAR_ENDPOINT_ALLOWLIST=stellar-services.example,sep.vendor.example
```

Entries authorize the named domain and its subdomains. Do not add public
suffixes or domains that can be registered by untrusted parties. Because Vite
embeds `VITE_*` values at build time, rebuild and redeploy after changing the
list. Existing same-domain integrations remain compatible without configuration;
cross-domain integrations must be migrated to the explicit allowlist.
