# Nosflare as Dedicated Relay — Assessment

## Status: Draft

## Date: 2026-02-13

---

## What is Nosflare?

[github.com/Spl0itable/nosflare](https://github.com/Spl0itable/nosflare) — A
serverless Nostr relay built on:

- **Cloudflare Workers** — request handling, WebSocket upgrades
- **Cloudflare D1** — SQLite-based event storage with global read replication
- **Durable Objects** — long-lived WebSocket connections, multi-region mesh (9
  locations) for real-time event broadcast
- **WebSocket Hibernation API** — reduces DO billing during idle connections

### Supported NIPs

1, 2, 4, 5, 9, 11, 12, 15, 16, 17, 20, 22, 33, 40, 42

### NOT yet supported (on roadmap)

- **NIP-50** (full-text search) — critical for our search feature
- **NIP-65** (relay list metadata)

---

## Fit for Bounty.ninja

### ✅ Strong Fit

| Factor                    | Assessment                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Already on Cloudflare** | We deploy Pages to the same account. Shared billing, same dashboard, zero new infra.                                       |
| **D1 read replication**   | Global read replicas = low-latency queries from any region. Perfect for a read-heavy bounty board.                         |
| **Durable Objects mesh**  | 9-region WebSocket mesh means real-time bounty updates broadcast globally with low latency.                                |
| **Event kind filtering**  | `allowedEventKinds` config lets us restrict to bounty-relevant kinds only (30023, 30078, 1, 0, etc.), keeping the DB lean. |
| **Pay-to-relay**          | Could gate bounty posting behind a small sat fee — anti-spam + revenue.                                                    |
| **NIP-42 auth**           | Can authenticate publishers, restrict who posts bounties.                                                                  |
| **Spam filtering**        | NIP-05 validation, content hashing, rate limiting — all configurable.                                                      |
| **Wrangler deployment**   | Same toolchain we already use for Pages. `mise run deploy:relay` trivially.                                                |
| **Cost**                  | Workers Paid plan ($5/mo base) + D1 + DO usage. At moderate scale, ~$10-30/mo total.                                       |

### ⚠️ Gaps

| Gap                       | Severity | Workaround                                                                                                                                       |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No NIP-50 search**      | High     | Client-side search (current approach) works to ~10K bounties. Could contribute NIP-50 to Nosflare, or implement a separate Workers search index. |
| **No NIP-45 COUNT**       | Medium   | Can't efficiently get total counts for pagination. Use cursor-based `until`/`limit` instead.                                                     |
| **D1 row limits**         | Low      | D1 free: 5M rows/day reads, 100K writes. Paid: 25B reads, 50M writes. More than enough.                                                          |
| **DO cost at scale**      | Medium   | Hibernation API helps. At 10K concurrent WebSockets across 9 DOs, ~$50-100/mo in DO charges. Manageable.                                         |
| **Single-maintainer OSS** | Medium   | Code is clean, MIT licensed. We can fork and maintain if needed.                                                                                 |

### ❌ Dealbreakers? None.

The missing NIP-50 is the biggest gap but it's on their roadmap and we can work
around it. Everything else is a strong fit.

---

## Deployment Plan

### Domain

`relay.bounty.ninja` — CNAME to the Worker's custom domain

### Architecture

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  bounty.ninja│────▶│  relay.bounty.ninja  │────▶│  Public      │
│  (SvelteKit) │     │  (Nosflare Worker)   │     │  Relays      │
│  CF Pages    │     │  CF Workers + D1     │     │  (fallback)  │
└──────────────┘     │  + Durable Objects   │     └──────────────┘
                     └─────────────────────┘
```

**Client relay priority**:

1. `wss://relay.bounty.ninja` (primary — fastest, our data)
2. Public relays (fallback — for profiles, cross-posting, redundancy)

### Config

```typescript
// src/config.ts (Nosflare)
export const relayInfo = {
  name: "Bounty.ninja Relay",
  description: "Dedicated relay for the Bounty.ninja decentralized task board",
  supported_nips: [1, 2, 9, 11, 12, 15, 16, 20, 22, 33, 40, 42],
  software: "https://github.com/Spl0itable/nosflare",
  version: "1.0.0",
};

// Allow only bounty-relevant event kinds
export const allowedEventKinds = [
  0, // Profile metadata
  1, // Short text (comments on bounties)
  5, // Event deletion (legacy — prefer Kind 73005 retraction)
  7, // Reaction
  1018, // Consensus vote
  10002, // Relay list metadata (NIP-65)
  37300, // Bounty definition (parameterized replaceable)
  73001, // Solution submission
  73002, // Pledge (funding)
  73004, // Payout record
  73005, // Retraction (bounty cancellation / pledge retraction)
  73006, // Reputation attestation
];

// Rate limiting
export const rateLimitEventsPerMin = 30;
export const excludedRateLimitKinds = [0, 10002]; // Profile updates + relay lists exempt
```

### Client Integration

```typescript
// src/lib/nostr/relay-pool.ts changes

const DEDICATED_RELAY = "wss://relay.bounty.ninja";

export function getConfiguredRelays(): string[] {
  const saved = getSavedRelays();
  if (saved) return saved;

  // Dedicated relay always first
  return [
    DEDICATED_RELAY,
    ...PUBLIC_FALLBACK_RELAYS,
  ];
}

// For publishing: write to dedicated relay + 2-3 public relays for redundancy
// For reading: query dedicated relay first, fan out to public only if needed
```

---

## Cost Estimate

| Component        | Free Tier | Paid ($5/mo base)       |
| ---------------- | --------- | ----------------------- |
| Workers requests | 100K/day  | 10M/mo included         |
| D1 reads         | 5M/day    | 25B/mo                  |
| D1 writes        | 100K/day  | 50M/mo                  |
| D1 storage       | 5GB       | 5GB (then $0.75/GB)     |
| Durable Objects  | —         | 1M requests/mo included |
| DO duration      | —         | 400K GB-s/mo included   |
| DO storage       | —         | 1GB included            |

**Projected monthly cost at various scales**:

| Users    | Estimated cost |
| -------- | -------------- |
| 100      | $5 (base plan) |
| 1,000    | $5-10          |
| 10,000   | $15-30         |
| 50,000   | $50-100        |
| 100,000+ | $100-300       |

Dramatically cheaper than running a VPS relay (strfry/nostr-rs-relay) with
equivalent global performance.

---

## Implementation Steps

1. **Fork Nosflare** → `<your-org>/nosflare` or `<your-org>/bounty-relay`
2. **Configure** — set allowed event kinds, relay info, rate limits
3. **Deploy** — `wrangler deploy` to existing CF account
4. **Custom domain** — add `relay.bounty.ninja` in Worker settings
5. **Client update** — add dedicated relay as primary, adjust publish/subscribe
   logic
6. **Test** — verify event round-trip, WebSocket stability, D1 replication
7. **Monitor** — CF analytics dashboard for request volume, error rates, DO
   billing

### Future Enhancements

- Contribute NIP-50 (search) implementation to Nosflare
- Add bounty-specific indexes (by tag, by status, by amount range)
- Implement relay-side feed algorithms via custom Worker logic
- Add NIP-42 auth for premium features (priority relay access for bounty
  posters)

---

## Verdict

**Nosflare is an excellent fit.** Same Cloudflare account, same toolchain,
serverless scaling, global edge performance, and ~$5-30/mo at reasonable scale.
The main gap (NIP-50 search) is workable — client-side search handles the near
term, and we can contribute search support upstream.

Recommend deploying as the **first scaling investment** once we have real users
posting bounties.
