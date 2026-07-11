import {
	deriveReputation,
	type ReputationProjection,
	type ReputationScore
} from '$lib/reputation/score';

/** Reactive cache populated only from trusted per-bounty financial projections. */
export class ReputationStore {
	#cache = $state<Map<string, ReputationScore>>(new Map());

	getReputation(pubkey: string): ReputationScore {
		const cached = this.#cache.get(pubkey);
		if (cached) return cached;
		const neutral = deriveReputation(pubkey, []);
		const updated = new Map(this.#cache);
		updated.set(pubkey, neutral);
		this.#cache = updated;
		return neutral;
	}

	setProjections(pubkey: string, projections: readonly ReputationProjection[]): void {
		const updated = new Map(this.#cache);
		updated.set(pubkey, deriveReputation(pubkey, projections));
		this.#cache = updated;
	}

	destroy(): void {
		this.#cache = new Map();
	}
}

export const reputationStore = new ReputationStore();
