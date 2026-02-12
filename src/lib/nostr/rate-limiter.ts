import { TASK_KIND, SOLUTION_KIND, PLEDGE_KIND, VOTE_KIND, PAYOUT_KIND } from '$lib/task/kinds';

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
	/** Whether the publish is allowed */
	allowed: boolean;
	/** Milliseconds remaining until the cooldown expires (0 if allowed) */
	remainingMs: number;
}

/** Per-kind cooldowns in milliseconds */
const DEFAULT_COOLDOWNS: Record<number, number> = {
	[TASK_KIND]: 30_000, // 30s — creating a new task
	[SOLUTION_KIND]: 60_000, // 60s — submitting a solution
	[PLEDGE_KIND]: 10_000, // 10s — pledging funds
	[VOTE_KIND]: 5_000, // 5s — casting a vote
	[PAYOUT_KIND]: 60_000 // 60s — recording a payout
};

/** Reduced cooldown for updating an existing replaceable event */
const REPLACEABLE_UPDATE_COOLDOWN = 10_000;

/** Fallback cooldown for unknown event kinds */
const DEFAULT_COOLDOWN = 30_000;

/**
 * Client-side rate limiter for event publishing.
 * Enforces per-kind cooldowns to prevent accidental double-publishes
 * and reduce relay spam. Not a security measure — just UX protection.
 *
 * Tracks the last publish time per kind (or kind:dTag for replaceable events).
 * Replaceable event updates (kind 37300 with an existing dTag) get a reduced cooldown.
 */
export class RateLimiter {
	#lastPublish = new Map<string, number>();

	/**
	 * Check whether a publish of the given kind is allowed.
	 *
	 * @param kind - Nostr event kind number
	 * @param dTag - Optional d-tag for parameterized replaceable events
	 * @returns Whether the publish is allowed and remaining cooldown time
	 */
	canPublish(kind: number, dTag?: string): RateLimitResult {
		const key = this.#makeKey(kind, dTag);
		const lastTime = this.#lastPublish.get(key);

		if (!lastTime) return { allowed: true, remainingMs: 0 };

		const cooldown = this.#getCooldown(kind, dTag);
		const elapsed = Date.now() - lastTime;

		if (elapsed >= cooldown) return { allowed: true, remainingMs: 0 };
		return { allowed: false, remainingMs: cooldown - elapsed };
	}

	/**
	 * Record that a publish just occurred for the given kind.
	 * Call this after a successful publish.
	 *
	 * @param kind - Nostr event kind number
	 * @param dTag - Optional d-tag for parameterized replaceable events
	 */
	recordPublish(kind: number, dTag?: string): void {
		const key = this.#makeKey(kind, dTag);
		this.#lastPublish.set(key, Date.now());
	}

	/**
	 * Reset all tracked publish times.
	 * Useful for testing or on logout.
	 */
	reset(): void {
		this.#lastPublish.clear();
	}

	/**
	 * Build a map key from kind and optional dTag.
	 * For replaceable events, the key includes the dTag to allow
	 * different cooldowns for new vs. update operations.
	 */
	#makeKey(kind: number, dTag?: string): string {
		return dTag ? `${kind}:${dTag}` : `${kind}`;
	}

	/**
	 * Get the cooldown duration for a given kind and dTag combination.
	 * Kind 37300 (task) with a dTag that has been published before
	 * gets a reduced cooldown since it's an update, not a new creation.
	 */
	#getCooldown(kind: number, dTag?: string): number {
		// Replaceable event update: reduced cooldown
		if (kind === TASK_KIND && dTag) {
			const updateKey = this.#makeKey(kind, dTag);
			const hasExistingPublish = this.#lastPublish.has(updateKey);
			if (hasExistingPublish) return REPLACEABLE_UPDATE_COOLDOWN;
		}

		return DEFAULT_COOLDOWNS[kind] ?? DEFAULT_COOLDOWN;
	}
}

/** Singleton rate limiter instance */
export const rateLimiter = new RateLimiter();
