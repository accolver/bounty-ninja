<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { paymentJournal, type PaymentOperationRecord } from '$lib/cashu/payment-journal';
	import { toastStore } from '$lib/stores/toast.svelte';

	let operations = $state<PaymentOperationRecord[]>([]);
	let exportedIds = $state<Set<string>>(new Set());
	let acknowledgedIds = $state<Set<string>>(new Set());
	let loading = $state(true);

	async function refresh() {
		try {
			operations = await paymentJournal.listPending();
		} catch {
			toastStore.error('Payment recovery data could not be loaded');
		} finally {
			loading = false;
		}
	}

	onMount(refresh);

	function exportRecovery(operation: PaymentOperationRecord) {
		const blob = new Blob([JSON.stringify(operation, null, 2)], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `bounty-ninja-payment-recovery-${operation.id}.json`;
		link.click();
		URL.revokeObjectURL(url);
		exportedIds = new Set([...exportedIds, operation.id]);
		toastStore.success('Recovery file exported. Store it like cash.');
	}

	async function acknowledge(operation: PaymentOperationRecord) {
		if (!exportedIds.has(operation.id) || !acknowledgedIds.has(operation.id)) return;
		try {
			await paymentJournal.acknowledgeRecovery(operation.id);
			await refresh();
			toastStore.success('Recovery responsibility acknowledged');
		} catch {
			toastStore.error('Recovery acknowledgement could not be saved');
		}
	}
</script>

{#if !loading && operations.length > 0}
	<section class="border-y border-warning bg-warning/10" aria-labelledby="payment-recovery-title">
		<div class="mx-auto w-full max-w-6xl space-y-4 px-4 py-4">
			<div>
				<h2 id="payment-recovery-title" class="font-semibold text-warning">
					Payment recovery required
				</h2>
				<p class="mt-1 text-sm text-foreground">
					These operations may contain Cashu bearer proofs. Export each recovery file before
					acknowledging responsibility. This notice cannot be dismissed normally.
				</p>
			</div>

			{#each operations as operation (operation.id)}
				<div
					class="flex flex-col gap-3 border-t border-warning/40 pt-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<div class="text-sm">
						<p class="font-medium text-foreground">
							{operation.intent.kind} · {operation.intent.amount.toLocaleString()} sats
						</p>
						<p class="text-muted-foreground">Status: {operation.status}</p>
						{#if operation.intent.bountyAddress}
							<p class="break-all text-xs text-muted-foreground">
								Bounty: {operation.intent.bountyAddress}
							</p>
						{/if}
						{#if operation.intent.kind === 'pledge'}
							<p class="text-xs text-foreground/80">
								Open this bounty to resume publication{operation.signedEvent
									? ' of the exact signed pledge event'
									: ''}.
							</p>
						{/if}
					</div>
					<div class="flex flex-col gap-2 sm:items-end">
						<Button variant="outline" size="sm" onclick={() => exportRecovery(operation)}>
							Export recovery file
						</Button>
						<label class="flex cursor-pointer items-start gap-2 text-xs text-foreground">
							<input
								type="checkbox"
								checked={acknowledgedIds.has(operation.id)}
								onchange={(event) => {
									const next = new Set(acknowledgedIds);
									if (event.currentTarget.checked) next.add(operation.id);
									else next.delete(operation.id);
									acknowledgedIds = next;
								}}
							/>
							<span>I saved the export and accept responsibility for its bearer value.</span>
						</label>
						<Button
							variant="outline"
							size="sm"
							disabled={!exportedIds.has(operation.id) || !acknowledgedIds.has(operation.id)}
							onclick={() => acknowledge(operation)}
						>
							Acknowledge and hide
						</Button>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}
