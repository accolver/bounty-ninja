import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '$lib/nostr/rate-limiter';

describe('RateLimiter', () => {
	let limiter: RateLimiter;

	beforeEach(() => {
		vi.useFakeTimers();
		limiter = new RateLimiter();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ── Basic Cooldown Behavior ─────────────────────────────────────────

	describe('cooldown enforcement', () => {
		it('allows first publish for any kind', () => {
			const result = limiter.canPublish(73001);
			expect(result.allowed).toBe(true);
			expect(result.remainingMs).toBe(0);
		});

		it('blocks same kind immediately after publish', () => {
			limiter.recordPublish(73001); // SOLUTION_KIND — 60s cooldown

			const result = limiter.canPublish(73001);
			expect(result.allowed).toBe(false);
			expect(result.remainingMs).toBeGreaterThan(0);
		});

		it('blocks with correct remaining time for SOLUTION_KIND (60s)', () => {
			limiter.recordPublish(73001);

			vi.advanceTimersByTime(30_000); // 30s elapsed
			const result = limiter.canPublish(73001);
			expect(result.allowed).toBe(false);
			expect(result.remainingMs).toBe(30_000); // 60s - 30s = 30s remaining
		});

		it('blocks with correct remaining time for VOTE_KIND (5s)', () => {
			limiter.recordPublish(1018);

			vi.advanceTimersByTime(2_000); // 2s elapsed
			const result = limiter.canPublish(1018);
			expect(result.allowed).toBe(false);
			expect(result.remainingMs).toBe(3_000); // 5s - 2s = 3s remaining
		});

		it('blocks with correct remaining time for PLEDGE_KIND (10s)', () => {
			limiter.recordPublish(73002);

			vi.advanceTimersByTime(5_000);
			const result = limiter.canPublish(73002);
			expect(result.allowed).toBe(false);
			expect(result.remainingMs).toBe(5_000);
		});
	});

	// ── Kind Independence ───────────────────────────────────────────────

	describe('kind independence', () => {
		it('different kinds have independent cooldowns', () => {
			limiter.recordPublish(73001); // Solution
			limiter.recordPublish(1018); // Vote

			// Solution should be blocked
			expect(limiter.canPublish(73001).allowed).toBe(false);

			// Vote should also be blocked
			expect(limiter.canPublish(1018).allowed).toBe(false);

			// Pledge was never published — should be allowed
			expect(limiter.canPublish(73002).allowed).toBe(true);
		});

		it('expiring one kind does not affect another', () => {
			limiter.recordPublish(1018); // Vote — 5s cooldown
			limiter.recordPublish(73001); // Solution — 60s cooldown

			vi.advanceTimersByTime(5_000); // 5s elapsed

			// Vote cooldown expired
			expect(limiter.canPublish(1018).allowed).toBe(true);

			// Solution still blocked (60s cooldown, only 5s elapsed)
			expect(limiter.canPublish(73001).allowed).toBe(false);
		});
	});

	// ── Cooldown Expiry ─────────────────────────────────────────────────

	describe('cooldown expiry', () => {
		it('allows publish after TASK_KIND cooldown (30s) expires', () => {
			limiter.recordPublish(37300); // Task — 30s cooldown (no dTag = new task)

			vi.advanceTimersByTime(29_999);
			expect(limiter.canPublish(37300).allowed).toBe(false);

			vi.advanceTimersByTime(1); // Now at exactly 30s
			expect(limiter.canPublish(37300).allowed).toBe(true);
		});

		it('allows publish after SOLUTION_KIND cooldown (60s) expires', () => {
			limiter.recordPublish(73001);

			vi.advanceTimersByTime(60_000);
			expect(limiter.canPublish(73001).allowed).toBe(true);
		});

		it('allows publish after VOTE_KIND cooldown (5s) expires', () => {
			limiter.recordPublish(1018);

			vi.advanceTimersByTime(5_000);
			expect(limiter.canPublish(1018).allowed).toBe(true);
		});

		it('allows publish after PLEDGE_KIND cooldown (10s) expires', () => {
			limiter.recordPublish(73002);

			vi.advanceTimersByTime(10_000);
			expect(limiter.canPublish(73002).allowed).toBe(true);
		});

		it('allows publish after PAYOUT_KIND cooldown (60s) expires', () => {
			limiter.recordPublish(73004);

			vi.advanceTimersByTime(60_000);
			expect(limiter.canPublish(73004).allowed).toBe(true);
		});

		it('uses default 30s cooldown for unknown kinds', () => {
			limiter.recordPublish(9999); // Unknown kind

			vi.advanceTimersByTime(29_999);
			expect(limiter.canPublish(9999).allowed).toBe(false);

			vi.advanceTimersByTime(1);
			expect(limiter.canPublish(9999).allowed).toBe(true);
		});
	});

	// ── Replaceable Event Reduced Cooldown ──────────────────────────────

	describe('replaceable event reduced cooldown', () => {
		it('uses 10s cooldown for task with dTag (recordPublish marks it as existing)', () => {
			// After recordPublish, the key exists in the map, so getCooldown
			// treats it as an update (hasExistingPublish = true) → 10s cooldown
			limiter.recordPublish(37300, 'my-task');

			vi.advanceTimersByTime(9_999);
			expect(limiter.canPublish(37300, 'my-task').allowed).toBe(false);

			vi.advanceTimersByTime(1); // Now at 10s
			expect(limiter.canPublish(37300, 'my-task').allowed).toBe(true);
		});

		it('uses 10s reduced cooldown for updating existing task (same dTag)', () => {
			// First publish — establishes the dTag
			limiter.recordPublish(37300, 'my-task');
			vi.advanceTimersByTime(30_000); // Wait for first cooldown to expire

			// Second publish — this is an update, should get reduced cooldown
			limiter.recordPublish(37300, 'my-task');

			vi.advanceTimersByTime(9_999);
			expect(limiter.canPublish(37300, 'my-task').allowed).toBe(false);

			vi.advanceTimersByTime(1); // Now at 10s
			expect(limiter.canPublish(37300, 'my-task').allowed).toBe(true);
		});

		it('different dTags have independent cooldowns', () => {
			limiter.recordPublish(37300, 'task-a');

			// Different dTag should be allowed
			expect(limiter.canPublish(37300, 'task-b').allowed).toBe(true);

			// Same dTag should be blocked
			expect(limiter.canPublish(37300, 'task-a').allowed).toBe(false);
		});

		it('task without dTag uses standard 30s cooldown', () => {
			limiter.recordPublish(37300); // No dTag

			vi.advanceTimersByTime(10_000);
			expect(limiter.canPublish(37300).allowed).toBe(false);

			vi.advanceTimersByTime(20_000); // 30s total
			expect(limiter.canPublish(37300).allowed).toBe(true);
		});
	});

	// ── State Management ────────────────────────────────────────────────

	describe('state management', () => {
		it('new RateLimiter has no cooldowns', () => {
			const fresh = new RateLimiter();
			expect(fresh.canPublish(37300).allowed).toBe(true);
			expect(fresh.canPublish(73001).allowed).toBe(true);
			expect(fresh.canPublish(73002).allowed).toBe(true);
			expect(fresh.canPublish(1018).allowed).toBe(true);
			expect(fresh.canPublish(73004).allowed).toBe(true);
		});

		it('reset clears all cooldowns', () => {
			limiter.recordPublish(37300);
			limiter.recordPublish(73001);
			limiter.recordPublish(1018);

			expect(limiter.canPublish(37300).allowed).toBe(false);
			expect(limiter.canPublish(73001).allowed).toBe(false);
			expect(limiter.canPublish(1018).allowed).toBe(false);

			limiter.reset();

			expect(limiter.canPublish(37300).allowed).toBe(true);
			expect(limiter.canPublish(73001).allowed).toBe(true);
			expect(limiter.canPublish(1018).allowed).toBe(true);
		});

		it('recordPublish updates the last publish time', () => {
			limiter.recordPublish(1018); // Vote — 5s cooldown

			vi.advanceTimersByTime(4_000); // 4s elapsed
			expect(limiter.canPublish(1018).allowed).toBe(false);

			// Record a new publish — resets the cooldown
			limiter.recordPublish(1018);

			vi.advanceTimersByTime(4_000); // 4s from second publish
			expect(limiter.canPublish(1018).allowed).toBe(false);

			vi.advanceTimersByTime(1_000); // 5s from second publish
			expect(limiter.canPublish(1018).allowed).toBe(true);
		});
	});

	// ── canPublish return value ─────────────────────────────────────────

	describe('canPublish return value', () => {
		it('returns remainingMs of 0 when allowed', () => {
			const result = limiter.canPublish(73001);
			expect(result.remainingMs).toBe(0);
		});

		it('returns correct remainingMs when blocked', () => {
			limiter.recordPublish(73002); // Pledge — 10s cooldown

			vi.advanceTimersByTime(3_000);
			const result = limiter.canPublish(73002);
			expect(result.allowed).toBe(false);
			expect(result.remainingMs).toBe(7_000);
		});

		it('returns remainingMs of 0 after cooldown expires', () => {
			limiter.recordPublish(1018); // Vote — 5s cooldown

			vi.advanceTimersByTime(5_000);
			const result = limiter.canPublish(1018);
			expect(result.allowed).toBe(true);
			expect(result.remainingMs).toBe(0);
		});
	});
});
