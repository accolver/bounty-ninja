import type { FinancialProjection } from '$lib/bounty/types';
import { reputationStore } from '$lib/stores/reputation.svelte';

class ProjectionRegistry {
	#sources = $state<Map<string, Map<string, FinancialProjection>>>(new Map());
	#knownPubkeys = new Set<string>();

	#items = $derived.by(() => {
		const merged = new Map<string, FinancialProjection>();
		for (const projections of this.#sources.values()) {
			for (const [address, projection] of projections) merged.set(address, projection);
		}
		return [...merged.values()];
	});

	get items(): readonly FinancialProjection[] {
		return this.#items;
	}

	replace(source: string, projections: readonly FinancialProjection[]): void {
		const next = new Map(this.#sources);
		next.set(
			source,
			new Map(projections.map((projection) => [projection.bountyAddress, projection]))
		);
		this.#sources = next;
		this.#refreshReputation();
	}

	remove(source: string): void {
		const next = new Map(this.#sources);
		next.delete(source);
		this.#sources = next;
		this.#refreshReputation();
	}

	#refreshReputation(): void {
		const pubkeys = new Set(this.#knownPubkeys);
		for (const projection of this.#items) {
			const creator = projection.bountyAddress.split(':')[1];
			if (creator) pubkeys.add(creator);
			for (const pledge of projection.validatedPledges) pubkeys.add(pledge.pubkey);
			for (const solution of projection.solutions) pubkeys.add(solution.pubkey);
			for (const payout of projection.validPayouts) {
				pubkeys.add(payout.pubkey);
				pubkeys.add(payout.solverPubkey);
			}
			for (const retraction of projection.authorizedRetractions) pubkeys.add(retraction.pubkey);
		}
		this.#knownPubkeys = pubkeys;
		for (const pubkey of pubkeys) reputationStore.setProjections(pubkey, this.#items);
	}
}

export const projectionRegistry = new ProjectionRegistry();
