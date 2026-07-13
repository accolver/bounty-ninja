<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { paymentJournal, type PaymentOperationRecord } from '$lib/cashu/payment-journal';
	import {
		activateCompatibleServiceWorkerUpdate,
		assessPaymentUpdateCompatibility,
		requestServiceWorkerUpdateMetadata
	} from '$lib/service-worker-update';
	import type { ServiceWorkerUpdateMetadata } from '$lib/service-worker-protocol';

	let waitingWorker = $state<ServiceWorker | null>(null);
	let pendingOperations = $state<PaymentOperationRecord[]>([]);
	let metadata = $state<ServiceWorkerUpdateMetadata | null>(null);
	let checking = $state(false);
	let activating = $state(false);
	let compatible = $derived(
		waitingWorker !== null &&
			metadata !== null &&
			assessPaymentUpdateCompatibility(pendingOperations, metadata).compatible
	);

	async function inspect(worker: ServiceWorker | null) {
		waitingWorker = worker;
		metadata = null;
		if (!worker) return;
		checking = true;
		try {
			const [nextMetadata, operations] = await Promise.all([
				requestServiceWorkerUpdateMetadata(worker),
				paymentJournal.listPending()
			]);
			if (waitingWorker !== worker) return;
			metadata = nextMetadata;
			pendingOperations = operations;
		} catch {
			// A missing or malformed compatibility response must fail closed.
			metadata = null;
		} finally {
			checking = false;
		}
	}

	function activate() {
		if (!waitingWorker || !metadata || !compatible) return;
		activating = true;
		activateCompatibleServiceWorkerUpdate(waitingWorker, pendingOperations, metadata);
	}

	onMount(() => {
		if (!('serviceWorker' in navigator)) return;
		let registration: ServiceWorkerRegistration | undefined;
		let reloading = false;

		const handleControllerChange = () => {
			if (reloading || !activating) return;
			reloading = true;
			window.location.reload();
		};
		const handleUpdateFound = () => {
			const installing = registration?.installing;
			installing?.addEventListener('statechange', () => {
				if (installing.state === 'installed') void inspect(registration?.waiting ?? null);
			});
		};

		navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
		void navigator.serviceWorker.ready.then((readyRegistration) => {
			registration = readyRegistration;
			registration.addEventListener('updatefound', handleUpdateFound);
			void inspect(registration.waiting);
		});

		return () => {
			navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
			registration?.removeEventListener('updatefound', handleUpdateFound);
		};
	});
</script>

{#if waitingWorker}
	<section
		class="border-y border-border bg-background"
		aria-live="polite"
		aria-labelledby="update-title"
	>
		<div
			class="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<h2 id="update-title" class="font-semibold text-foreground">Update available</h2>
				{#if checking}
					<p class="text-sm text-muted-foreground">Checking payment recovery compatibility...</p>
				{:else if compatible}
					<p class="text-sm text-muted-foreground">
						The update is compatible with {pendingOperations.length} pending payment
						{pendingOperations.length === 1 ? 'operation' : 'operations'}.
					</p>
				{:else}
					<p class="text-sm text-warning">
						Update blocked to preserve pending payment recovery data. Export or finish recovery,
						then check again.
					</p>
				{/if}
			</div>
			{#if compatible}
				<Button onclick={activate} disabled={activating}>
					{activating ? 'Activating update...' : 'Update and reload'}
				</Button>
			{:else if !checking}
				<Button variant="outline" onclick={() => inspect(waitingWorker)}>Check again</Button>
			{/if}
		</div>
	</section>
{/if}
