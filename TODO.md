# Security and Nostr Compliance TODO

Follow-up recommendations from the security/NIP audit:

- [ ] Remove main-app raw private-key entry for payout/reclaim flows, or move it to an isolated advanced/offline recovery tool.
- [ ] Replace public anti-spam Cashu bearer tokens with P2PK-locked tokens or a private encrypted claim flow.
- [ ] Revisit CSP to remove `script-src 'unsafe-inline'` if SvelteKit static output can support hashes/nonces.
- [ ] Add NIP-11 relay information checks to warn about relay auth, limits, and supported NIPs before use.
- [ ] Track per-relay EOSE/CLOSED/auth states instead of relying on fixed loading timeouts.
- [ ] Honor NIP-33 `naddr` relay hints when loading bounty detail pages.
- [ ] Consider NIP-65 relay list support for better cross-client relay discovery.
- [ ] Separate optimistic local events from relay-confirmed events in cache/UI.
- [ ] Add dependency audit automation in CI.
