# Client-Side Caching Spec

## Status: Draft
## Date: 2026-02-13

---

## Current State

We already have:
- **IndexedDB via `nostr-idb`** — events persisted on insert, loaded on demand via `loadCachedEvents(filters)`
- **LRU + age-based eviction** — 10K max events, 30-day TTL, protects current user's events
- **Cache monitor** — reactive event count + size tracking, displayed in Settings
- **EventStore (applesauce-core)** — in-memory singleton, source of truth for UI

### What's Missing

1. **No cache-first loading** — every page load queries relays first; IndexedDB is loaded but doesn't render before relay data arrives
2. **No profile caching** — Kind 0 (metadata) fetched fresh every time, no dedup across sessions
3. **No stale-while-revalidate** — can't show cached data instantly while fetching updates
4. **No query result caching** — same filter runs duplicate relay queries across navigations
5. **No cache versioning** — schema changes would corrupt existing caches silently
6. **No size quota awareness** — eviction triggers on count, not actual storage quota

---

## Architecture

### Cache Layers

```
┌─────────────────────────────────────────┐
│  L1: In-Memory (EventStore)             │  ← instant, lost on refresh
│  - Applesauce EventStore singleton      │
│  - All events seen this session         │
├─────────────────────────────────────────┤
│  L2: IndexedDB (nostr-idb)             │  ← ~1-5ms reads, persists across sessions
│  - Full Nostr events                    │
│  - Eviction: LRU + age-based           │
├─────────────────────────────────────────┤
│  L3: Relay Network                      │  ← 50-500ms, canonical source of truth
│  - Public relays + (future) dedicated   │
└─────────────────────────────────────────┘
```

### Data Flow: Stale-While-Revalidate

```
Page Load → Check L1 (EventStore)
  ├─ HIT → render immediately
  └─ MISS → Check L2 (IndexedDB)
       ├─ HIT → render cached, then revalidate from L3
       └─ MISS → show skeleton, fetch from L3
                   └─ response → render + write to L1 + L2
```

---

## Spec: Cache-First Loading

### 1. Query Cache Layer

New module: `src/lib/nostr/cache-query.ts`

```typescript
interface CacheQueryOptions {
  filters: Filter[];
  /** Max age before considering stale (ms). Default: 5 min */
  maxAgeMs?: number;
  /** Skip relay revalidation entirely if cache is fresh */
  cacheOnly?: boolean;
}

interface CacheQueryResult {
  events: NostrEvent[];
  fromCache: boolean;
  stale: boolean;
}

/**
 * Load events cache-first with stale-while-revalidate semantics.
 *
 * 1. Check EventStore (L1) — if populated for this filter, return immediately
 * 2. Check IndexedDB (L2) — load matching events, render them
 * 3. Subscribe to relays (L3) — merge new/updated events as they arrive
 *
 * Returns a reactive store that updates as relay data comes in.
 */
function cachedQuery(options: CacheQueryOptions): {
  events: Readable<NostrEvent[]>;
  loading: Readable<boolean>;
  fromCache: Readable<boolean>;
  refresh: () => void;
}
```

### 2. Query Freshness Tracking

Track when each filter pattern was last fetched from relays.

```typescript
// localStorage key: 'bounty.ninja:cache-meta'
interface CacheMeta {
  queries: Record<string, {
    /** Filter hash (deterministic JSON of filter) */
    filterHash: string;
    /** Unix timestamp of last relay fetch */
    lastFetched: number;
    /** Number of events returned */
    eventCount: number;
  }>;
  /** Cache schema version — bump to invalidate */
  version: number;
}
```

**Filter hashing**: Sort filter keys + values deterministically, SHA-256 → hex string (first 16 chars). Used as lookup key.

**Freshness rules**:
| Data type | Fresh threshold | Stale threshold |
|-----------|----------------|-----------------|
| Bounty list (home) | 2 min | 10 min |
| Single bounty detail | 5 min | 30 min |
| Profile (Kind 0) | 15 min | 24 hours |
| Applications (Kind 30078) | 1 min | 5 min |

### 3. Profile Cache

Profiles are the highest-value cache target — fetched repeatedly, change rarely.

```typescript
// New: src/lib/nostr/profile-cache.ts

interface CachedProfile {
  event: NostrEvent;       // Kind 0 event
  parsed: ProfileContent;  // { name, display_name, picture, about, ... }
  fetchedAt: number;       // Unix ms
}

/**
 * Get profile with cache-first semantics.
 * Returns cached immediately, triggers background revalidation if stale.
 */
function getCachedProfile(pubkey: string): {
  profile: Readable<CachedProfile | null>;
  loading: Readable<boolean>;
}

/**
 * Batch-load profiles efficiently.
 * Groups pubkeys into a single REQ filter instead of N individual subs.
 */
function batchLoadProfiles(pubkeys: string[]): void
```

**Storage**: Profiles stored as regular Kind 0 events in IndexedDB (already works). The profile-cache layer adds:
- In-memory LRU map (max 500 profiles) for instant access
- Parsed content cache (avoid re-parsing JSON on every render)
- Background revalidation scheduling

### 4. Cache Versioning

```typescript
const CACHE_VERSION = 1;

async function initCache(): Promise<void> {
  const stored = localStorage.getItem('bounty.ninja:cache-version');
  if (stored && parseInt(stored) !== CACHE_VERSION) {
    // Schema changed — nuke and rebuild
    await clearAllCaches();
    localStorage.setItem('bounty.ninja:cache-version', String(CACHE_VERSION));
  }
  // ... existing init
}
```

### 5. Storage Quota Awareness

```typescript
/**
 * Check available storage and trigger eviction if needed.
 * Uses navigator.storage.estimate() where available.
 */
async function checkStorageQuota(): Promise<{
  used: number;
  quota: number;
  percentUsed: number;
}> {
  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return {
      used: usage,
      quota: quota,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0
    };
  }
  // Fallback: estimate from event count
  const size = await estimateCacheSize();
  return { used: size, quota: 100 * 1024 * 1024, percentUsed: (size / (100 * 1024 * 1024)) * 100 };
}

// Trigger emergency eviction at 80% quota usage
// Trigger warning toast at 70%
```

### 6. Preloading & Prefetching

```typescript
/**
 * Prefetch data for likely navigation targets.
 * Called during idle time or on hover/focus of links.
 */
function prefetch(type: 'bounty' | 'profile', id: string): void

// Home page: prefetch first 5 bounty details on idle
// Bounty card: prefetch full bounty + creator profile on hover
// Profile link: prefetch Kind 0 on hover
```

Use `requestIdleCallback` to avoid blocking interactions.

---

## Implementation Priority

### Phase 1: Cache-First Profiles (High Impact, Low Effort)
- Profile LRU cache with parsed content
- Batch profile loading (single REQ for N pubkeys)
- Background revalidation for stale profiles
- **Impact**: Eliminates most redundant relay queries

### Phase 2: Stale-While-Revalidate for Bounty Lists
- `cachedQuery()` wrapper with freshness tracking
- Home page renders cached bounties instantly, updates in background
- Bounty detail page loads from cache first
- **Impact**: Near-instant page transitions

### Phase 3: Quota Management & Versioning
- Storage quota monitoring
- Cache version migration
- Improved eviction (priority-based, not just LRU)
- **Impact**: Reliability on storage-constrained devices

### Phase 4: Prefetching
- Idle-time prefetch on home page
- Hover-triggered prefetch on links
- **Impact**: Perceived zero-latency navigation

---

## Metrics

Track in `cache-monitor.svelte.ts`:
- **Cache hit rate**: % of queries served from L1/L2 vs L3
- **Time to first paint**: ms from navigation to first content render
- **Relay query reduction**: % fewer relay queries vs no-cache baseline
- **Cache size**: bytes + event count over time

Display summary in Settings → Cache section (already exists).

---

## Nosflare Integration Notes

If we deploy a dedicated relay via Nosflare (see below), the caching strategy shifts:

- **Single relay = simpler dedup** — no 8x duplicate events from multiple relays
- **Lower latency** — Cloudflare edge = ~20ms vs ~200ms for random public relays
- **Server-side filtering** — relay handles complex queries, client cache becomes a performance optimization rather than a necessity
- Client still caches for offline capability and instant renders

The cache-first architecture works regardless of relay topology — it just becomes even faster with a dedicated edge relay.
