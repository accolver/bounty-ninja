# Nosflare Relay — Work Tracker

## Goal
Deploy a dedicated Nostr relay at `relay.bounty.ninja` using Nosflare on our existing Cloudflare account.

## Status: Not Started

---

## Tasks

### Phase 1: Setup & Deploy
- [ ] Fork `Spl0itable/nosflare` → `soveng/bounty-relay`
- [ ] Configure `src/config.ts` — relay info, allowed event kinds (0, 1, 5, 7, 30023, 30078, 10002)
- [ ] Configure rate limiting (30 events/min per pubkey)
- [ ] Configure spam filtering (NIP-05 validation optional, content hash dedup on)
- [ ] Update `wrangler.toml` with our CF account ID (`a60d0a4430a778bba92fa9d72d7adc87`)
- [ ] Create D1 database (`bounty-relay-db`) with read replication enabled
- [ ] Deploy Worker via `wrangler deploy`
- [ ] Verify relay responds at Worker URL (HTTP landing page + WebSocket)

### Phase 2: Custom Domain
- [ ] Add `relay.bounty.ninja` custom domain in Worker settings
- [ ] Add DNS CNAME record in Cloudflare dashboard
- [ ] Verify `wss://relay.bounty.ninja` accepts WebSocket connections
- [ ] Test with a Nostr client (e.g. nostrudel.ninja)

### Phase 3: Client Integration
- [ ] Add `wss://relay.bounty.ninja` as primary relay in `src/lib/utils/env.ts`
- [ ] Update `connectDefaultRelays()` — dedicated relay first, public relays as fallback
- [ ] Publish logic: write to dedicated + 2 public relays for redundancy
- [ ] Read logic: query dedicated first, fan out only if needed or for profile metadata
- [ ] Test bounty create → read round-trip through dedicated relay

### Phase 4: Monitoring & Hardening
- [ ] Set up Cloudflare analytics alerts for error rate spikes
- [ ] Add `mise run deploy:relay` command
- [ ] Monitor D1 read/write usage first week
- [ ] Monitor DO duration billing
- [ ] Load test: simulate 100 concurrent WebSocket connections

### Phase 5: Future Enhancements
- [ ] Contribute NIP-50 (search) to Nosflare upstream
- [ ] Add bounty-specific D1 indexes (tag, status, amount)
- [ ] NIP-42 auth for premium features
- [ ] Pay-to-relay for bounty posting (anti-spam)

---

## References
- Spec: `docs/SPEC-NOSFLARE-RELAY.md`
- Nosflare repo: https://github.com/Spl0itable/nosflare
- CF Account ID: `a60d0a4430a778bba92fa9d72d7adc87`
- Live relay example: `wss://relay.nosflare.com`

## Cost Tracking
| Date | Workers Reqs | D1 Reads | D1 Writes | DO Duration | Total |
|------|-------------|----------|-----------|-------------|-------|
| — | — | — | — | — | — |

## Notes
- NIP-50 search NOT yet supported — client-side search covers near-term
- Nosflare uses WebSocket Hibernation API to reduce idle DO costs
- D1 Session API enables global read replication automatically
