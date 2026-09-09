# Webhook Signature Verification

Inbound automation webhooks from the Stellar Dev Dashboard are signed with HMAC-SHA256.

## Signature format

Header: `X-Webhook-Signature`

Value format:

```text
t=<unix-seconds>,v1=<hex-hmac>
```

The signed payload is:

```text
${timestamp}.${rawBody}
```

Verify the **raw request body bytes** before JSON parsing. Re-stringifying parsed JSON can change field order and break signatures.

## Signing (outbound)

```ts
import { signWebhookPayload } from '@/lib/webhookSignatures';

const rawBody = JSON.stringify(payload);
const signature = await signWebhookPayload(rawBody, endpointSecret);
```

## Verification (inbound)

```ts
import { verifyWebhookSignature } from '@/lib/webhookSignatures';

const rawBody = await readRawBody(request);
const signature = request.headers.get('x-webhook-signature');
const result = await verifyWebhookSignature(rawBody, signature, sharedSecret, {
  toleranceSeconds: 300,
});

if (!result.valid) {
  throw new Error(`Invalid webhook signature: ${result.reason}`);
}
```

## Failure handling

| Reason | Meaning |
| --- | --- |
| `missing_signature` | Header absent or empty |
| `malformed_signature` | Header missing `t=` or `v1=` parts |
| `invalid_timestamp` | Timestamp is not a positive integer |
| `timestamp_out_of_tolerance` | Possible replay attack or clock skew |
| `signature_mismatch` | Secret mismatch or body tampering |
| `unsupported_environment` | Web Crypto unavailable |

## Security notes

- Use a unique secret per webhook endpoint.
- Rotate secrets by accepting both old and new secrets during a overlap window.
- Reject requests outside the replay tolerance (default 300 seconds).
- Compare signatures in constant time (handled by the helper).

## Migration from legacy signatures

Earlier builds used a placeholder `btoa(body + secret)` digest. Receivers should upgrade to the `t=...,v1=...` format documented above. Outbound delivery now uses the HMAC helper in `src/lib/webhookSignatures.ts`.
