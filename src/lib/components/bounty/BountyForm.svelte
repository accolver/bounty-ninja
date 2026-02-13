<script lang="ts">
	import { goto } from '$app/navigation';
	import { nip19 } from 'nostr-tools';
	import { BOUNTY_KIND } from '$lib/bounty/kinds';
	import { bountyBlueprint } from '$lib/bounty/blueprints';
	import { publishEvent } from '$lib/nostr/signer.svelte';
	import { accountState } from '$lib/nostr/account.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { getMinSubmissionFee, getMaxSubmissionFee } from '$lib/utils/env';
	import { rateLimiter } from '$lib/nostr/rate-limiter';
	import { connectivity } from '$lib/stores/connectivity.svelte';
	import { suggestTags, getPopularTags } from '$lib/bounty/auto-tagger';
	import { bountyList } from '$lib/stores/bounties.svelte';
	import TagAutoSuggest from './TagAutoSuggest.svelte';
	import Tooltip from '$lib/components/shared/Tooltip.svelte';

	// Advanced settings toggle
	let showAdvanced = $state(false);

	// ── Constants ────────────────────────────────────────────────
	const TITLE_MAX = 200;
	const DESCRIPTION_MAX = 50_000;

	// ── Form state ──────────────────────────────────────────────
	let title = $state('');
	let description = $state('');
	let rewardAmount = $state(0);
	let tagInput = $state('');
	let tags = $state<string[]>([]);
	let deadline = $state('');
	let mintUrl = $state('');
	let submissionFee = $state(0);
	let submitting = $state(false);

	// ── Rate limit state ────────────────────────────────────────
	let rateLimitRemaining = $state(0);

	$effect(() => {
		if (rateLimitRemaining <= 0) return;
		const interval = setInterval(() => {
			const result = rateLimiter.canPublish(BOUNTY_KIND);
			rateLimitRemaining = result.allowed ? 0 : Math.ceil(result.remainingMs / 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	const isRateLimited = $derived(rateLimitRemaining > 0);

	// ── Env-derived fee bounds ──────────────────────────────────
	const minFee = getMinSubmissionFee();
	const maxFee = getMaxSubmissionFee();

	// ── Validation ──────────────────────────────────────────────
	const titleValid = $derived(title.trim().length > 0);
	const titleLengthValid = $derived(title.length <= TITLE_MAX);
	const descriptionValid = $derived(description.trim().length > 0);
	const descriptionLengthValid = $derived(description.length <= DESCRIPTION_MAX);
	const rewardValid = $derived(rewardAmount > 0);
	const deadlineValid = $derived(deadline === '' || new Date(deadline).getTime() > Date.now());
	const feeValid = $derived(
		submissionFee === 0 || (submissionFee >= minFee && submissionFee <= maxFee)
	);

	const isValid = $derived(
		titleValid &&
			titleLengthValid &&
			descriptionValid &&
			descriptionLengthValid &&
			rewardValid &&
			deadlineValid &&
			feeValid &&
			!submitting &&
			!isRateLimited &&
			connectivity.online
	);

	// ── Tag management ──────────────────────────────────────────
	function addTag(value: string) {
		const trimmed = value.trim().toLowerCase();
		if (trimmed && !tags.includes(trimmed)) {
			tags = [...tags, trimmed];
		}
	}

	function addTagsFromInput() {
		const parts = tagInput
			.split(',')
			.map((t) => t.trim().toLowerCase())
			.filter(Boolean);
		for (const part of parts) {
			if (!tags.includes(part)) {
				tags = [...tags, part];
			}
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTagsFromInput();
		}
	}

	// ── Auto-tag suggestions ────────────────────────────────────
	let dismissedSuggestions = $state<Set<string>>(new Set());

	const filteredSuggestions = $derived.by(() => {
		const raw = suggestTags(title, description);
		return raw.filter((t) => !tags.includes(t) && !dismissedSuggestions.has(t));
	});

	function acceptSuggestion(tag: string) {
		addTag(tag);
	}

	function dismissSuggestion(tag: string) {
		dismissedSuggestions = new Set([...dismissedSuggestions, tag]);
	}

	// ── Community autocomplete ──────────────────────────────────
	const autocompleteResults = $derived.by(() => {
		const prefix = tagInput.trim();
		if (!prefix) return [];
		return getPopularTags(prefix, bountyList.items).filter((r) => !tags.includes(r.tag));
	});

	let showAutocomplete = $state(false);

	function selectAutocomplete(tag: string) {
		addTag(tag);
		tagInput = '';
		showAutocomplete = false;
	}

	// ── d-tag generation ────────────────────────────────────────
	function generateDTag(title: string): string {
		const slug = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 50);
		const bytes = crypto.getRandomValues(new Uint8Array(8));
		const suffix = Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
		return `${slug}-${suffix}`;
	}

	// ── Submit ──────────────────────────────────────────────────
	async function handleSubmit() {
		if (!isValid || !accountState.pubkey) return;

		// Rate limit check
		const rateCheck = rateLimiter.canPublish(BOUNTY_KIND);
		if (!rateCheck.allowed) {
			rateLimitRemaining = Math.ceil(rateCheck.remainingMs / 1000);
			toastStore.error(`Wait ${rateLimitRemaining}s before creating another bounty`);
			return;
		}

		submitting = true;

		try {
			const dTag = generateDTag(title);
			const deadlineUnix = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : undefined;

			const template = bountyBlueprint({
				dTag,
				title: title.trim(),
				description: description.trim(),
				rewardAmount,
				tags: tags.length > 0 ? tags : undefined,
				deadline: deadlineUnix,
				mintUrl: mintUrl.trim() || undefined,
				submissionFee: submissionFee > 0 ? submissionFee : undefined
			});

			const { broadcast } = await publishEvent(template);
			rateLimiter.recordPublish(BOUNTY_KIND, dTag);

			if (!broadcast.success) {
				toastStore.error(
					'Failed to publish to relays. Your bounty was saved locally but may not be visible to others.'
				);
				return;
			}

			toastStore.success('Bounty created!');

			const naddr = nip19.naddrEncode({
				identifier: dTag,
				pubkey: accountState.pubkey,
				kind: BOUNTY_KIND
			});
			goto(`/bounty/${naddr}`);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to create bounty');
		} finally {
			submitting = false;
		}
	}
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
	class="rounded-lg border border-border bg-card p-6 shadow-sm"
	aria-label="Create bounty form"
>
	<div class="flex flex-col gap-5">
		<!-- Title -->
		<div class="flex flex-col gap-1.5">
			<label for="bounty-title" class="text-sm font-medium text-foreground">
				Title <span class="text-destructive" aria-hidden="true">*</span>
			</label>
			<input
				id="bounty-title"
				type="text"
				bind:value={title}
				required
				maxlength={TITLE_MAX}
				placeholder="e.g. Build a Nostr relay in Rust"
				class="rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:outline-none"
				aria-required="true"
				aria-invalid={title.length > 0 && (!titleValid || !titleLengthValid)}
				aria-describedby="bounty-title-count"
			/>
			<div class="flex items-center justify-between">
				{#if !titleLengthValid}
					<p class="text-xs text-destructive" role="alert">
						Title must be {TITLE_MAX} characters or fewer.
					</p>
				{:else}
					<span></span>
				{/if}
				<p
					id="bounty-title-count"
					class="text-xs {!titleLengthValid
						? 'text-destructive font-medium'
						: 'text-muted-foreground'}"
					aria-live="polite"
				>
					{title.length}/{TITLE_MAX}
				</p>
			</div>
		</div>

		<!-- Description -->
		<div class="flex flex-col gap-1.5">
			<label for="bounty-description" class="text-sm font-medium text-foreground">
				Description <span class="text-destructive" aria-hidden="true">*</span>
			</label>
			<textarea
				id="bounty-description"
				bind:value={description}
				required
				rows={6}
				maxlength={DESCRIPTION_MAX}
				placeholder="What do you need built? Include:&#10;• Clear requirements and acceptance criteria&#10;• Technical details or constraints&#10;• Examples of what success looks like&#10;&#10;Markdown is supported."
				class="rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:outline-none resize-y"
				aria-required="true"
				aria-invalid={description.length > 0 && (!descriptionValid || !descriptionLengthValid)}
				aria-describedby="bounty-desc-count"
			></textarea>
			<div class="flex items-center justify-between">
				{#if !descriptionLengthValid}
					<p class="text-xs text-destructive" role="alert">
						Description must be {DESCRIPTION_MAX.toLocaleString()} characters or fewer.
					</p>
				{:else}
					<p class="text-xs text-muted-foreground">Markdown supported</p>
				{/if}
				<p
					id="bounty-desc-count"
					class="text-xs {!descriptionLengthValid
						? 'text-destructive font-medium'
						: 'text-muted-foreground'}"
					aria-live="polite"
				>
					{description.length.toLocaleString()}/{DESCRIPTION_MAX.toLocaleString()}
				</p>
			</div>
		</div>

		<!-- Reward Amount -->
		<div class="flex flex-col gap-1.5">
			<label for="bounty-reward" class="text-sm font-medium text-foreground">
				<Tooltip text="Satoshis (sats) are small units of Bitcoin. ~100K sats ≈ $50–100 USD at recent rates.">
					{#snippet children()}
						<span class="cursor-help border-b border-dotted border-muted-foreground/50">Reward Amount (sats)</span>
					{/snippet}
				</Tooltip>
				<span class="text-destructive" aria-hidden="true">*</span>
			</label>
			<input
				id="bounty-reward"
				type="number"
				bind:value={rewardAmount}
				required
				min="1"
				step="1"
				placeholder="1000"
				class="rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:outline-none"
				aria-required="true"
				aria-invalid={rewardAmount !== 0 && !rewardValid}
			/>
			{#if rewardAmount !== 0 && !rewardValid}
				<p class="text-xs text-destructive" role="alert">Reward must be greater than 0 sats.</p>
			{/if}
		</div>

		<!-- Tags -->
		<div class="flex flex-col gap-1.5">
			<label for="bounty-tags" class="text-sm font-medium text-foreground"> Tags </label>
			{#if tags.length > 0}
				<ul class="flex flex-wrap gap-1.5" aria-label="Selected tags">
					{#each tags as tag (tag)}
						<li>
							<span
								class="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
							>
								{tag}
								<button
									type="button"
									onclick={() => removeTag(tag)}
									class="ml-0.5 cursor-pointer rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive focus-visible:ring-1 focus-visible:ring-ring"
									aria-label="Remove tag {tag}"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 16 16"
										fill="currentColor"
										class="h-3 w-3"
										aria-hidden="true"
									>
										<path
											d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
										/>
									</svg>
								</button>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
			<TagAutoSuggest
				suggestedTags={filteredSuggestions}
				onaccept={acceptSuggestion}
				ondismiss={dismissSuggestion}
			/>
			<div class="relative">
				<div class="flex gap-2">
					<input
						id="bounty-tags"
						type="text"
						bind:value={tagInput}
						onkeydown={handleTagKeydown}
						onfocus={() => (showAutocomplete = true)}
						onblur={() => setTimeout(() => (showAutocomplete = false), 150)}
						placeholder="rust, nostr, relay"
						class="flex-1 rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:outline-none"
						role="combobox"
						aria-expanded={showAutocomplete && autocompleteResults.length > 0}
						aria-controls="tag-autocomplete-list"
						aria-autocomplete="list"
					/>
					<button
						type="button"
						onclick={addTagsFromInput}
						disabled={!tagInput.trim()}
						class="cursor-pointer rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
					>
						Add
					</button>
				</div>
				{#if showAutocomplete && autocompleteResults.length > 0}
					<ul
						id="tag-autocomplete-list"
						class="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-md"
						role="listbox"
						aria-label="Popular tags"
					>
						{#each autocompleteResults as result (result.tag)}
							<li role="option" aria-selected="false">
								<button
									type="button"
									class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
									onmousedown={() => selectAutocomplete(result.tag)}
								>
									<span>{result.tag}</span>
									<span class="text-xs text-muted-foreground">{result.count} bounties</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<p class="text-xs text-muted-foreground">Comma-separated or press Enter to add</p>
		</div>

		<!-- Deadline -->
		<div class="flex flex-col gap-1.5">
			<label for="bounty-deadline" class="text-sm font-medium text-foreground"> Deadline </label>
			<input
				id="bounty-deadline"
				type="datetime-local"
				bind:value={deadline}
				class="rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:outline-none"
			/>
			{#if deadline && !deadlineValid}
				<p class="text-xs text-destructive" role="alert">Deadline must be in the future.</p>
			{/if}
			<p class="text-xs text-muted-foreground">Optional. Leave blank for no deadline.</p>
		</div>

		<!-- Advanced Settings Toggle -->
		<button
			type="button"
			onclick={() => (showAdvanced = !showAdvanced)}
			class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
		>
			<span class="transition-transform {showAdvanced ? 'rotate-90' : ''}" aria-hidden="true">▸</span>
			Advanced Settings
		</button>

		{#if showAdvanced}
			<!-- Mint URL -->
			<div class="flex flex-col gap-1.5 rounded-md border border-border/50 bg-muted/30 p-4">
				<label for="bounty-mint" class="text-sm font-medium text-foreground">
					<Tooltip text="A Cashu mint holds Bitcoin in escrow for your bounty. Think of it as the payment processor. The default works great for most users.">
						{#snippet children()}
							<span class="cursor-help border-b border-dotted border-muted-foreground/50">Cashu Mint URL</span>
						{/snippet}
					</Tooltip>
				</label>
				<input
					id="bounty-mint"
					type="url"
					bind:value={mintUrl}
					placeholder="https://mint.minibits.cash/Bitcoin"
					class="rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:outline-none"
				/>
				<p class="text-xs text-muted-foreground">Leave blank to use the default mint. Most users don't need to change this.</p>
			</div>

			<!-- Submission Fee -->
			<div class="flex flex-col gap-1.5 rounded-md border border-border/50 bg-muted/30 p-4">
				<label for="bounty-fee" class="text-sm font-medium text-foreground">
					<Tooltip text="A small fee that builders pay to submit a solution. This prevents spam submissions on popular bounties.">
						{#snippet children()}
							<span class="cursor-help border-b border-dotted border-muted-foreground/50">Submission Fee (sats)</span>
						{/snippet}
					</Tooltip>
				</label>
				<input
					id="bounty-fee"
					type="number"
					bind:value={submissionFee}
					min="0"
					max={maxFee}
					step="1"
					placeholder="0"
					class="rounded-md border border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:outline-none"
				/>
				{#if submissionFee !== 0 && !feeValid}
					<p class="text-xs text-destructive" role="alert">
						Fee must be between {minFee} and {maxFee} sats.
					</p>
				{/if}
				<p class="text-xs text-muted-foreground">
					Optional anti-spam fee ({minFee}–{maxFee} sats). Builders pay this when submitting — set to 0 for no fee.
				</p>
			</div>
		{/if}

		<!-- Submit -->
		<div class="flex items-center gap-3 pt-2">
			<button
				type="submit"
				disabled={!isValid}
				class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
				aria-busy={submitting}
			>
				{#if submitting}
					<svg
						class="h-4 w-4 animate-spin"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Publishing...
				{:else if isRateLimited}
					Wait {rateLimitRemaining}s
				{:else}
					Create Bounty
				{/if}
			</button>

			{#if !connectivity.online}
				<p class="text-xs text-warning" role="alert">Offline — cannot publish</p>
			{:else if !isValid && (title || description || rewardAmount)}
				<p class="text-xs text-muted-foreground">
					{#if !titleValid}
						Title is required.
					{:else if !titleLengthValid}
						Title exceeds {TITLE_MAX} characters.
					{:else if !descriptionValid}
						Description is required.
					{:else if !descriptionLengthValid}
						Description exceeds {DESCRIPTION_MAX.toLocaleString()} characters.
					{:else if !rewardValid}
						Reward must be greater than 0.
					{:else if !deadlineValid}
						Deadline must be in the future.
					{:else if !feeValid}
						Fee must be {minFee}–{maxFee} sats.
					{:else if isRateLimited}
						Please wait {rateLimitRemaining}s before creating another bounty.
					{/if}
				</p>
			{/if}
		</div>
	</div>
</form>
