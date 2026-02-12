import type { Subscription } from 'rxjs';
import type { NostrEvent } from 'nostr-tools';
import type { TaskSummary, TaskStatus } from '$lib/task/types';
import { eventStore } from '$lib/nostr/event-store';
import { parseTaskSummary, parsePledge, parseSolution, parsePayout } from '$lib/task/helpers';
import { TASK_KIND, PLEDGE_KIND, SOLUTION_KIND, PAYOUT_KIND } from '$lib/task/kinds';
import { createTaskListLoader } from '$lib/nostr/loaders/task-loader';
import {
	createAllPledgesLoader,
	createAllSolutionsLoader,
	createAllPayoutsLoader
} from '$lib/nostr/loaders/pledge-loader';

/**
 * Reactive store for the task list.
 * Bridges EventStore timeline Observable to Svelte 5 runes.
 *
 * Subscribes to task, pledge, solution, and payout events so that
 * task summaries are enriched with real totalPledged, solutionCount,
 * and derived status values.
 */
class TaskListStore {
	#tasks = $state<TaskSummary[]>([]);
	/** Pledge totals keyed by task address (e.g. "37300:<pubkey>:<d-tag>") */
	#pledgeTotals = $state<Map<string, number>>(new Map());
	/** Solution counts keyed by task address */
	#solutionCounts = $state<Map<string, number>>(new Map());
	/** Set of task addresses that have payout events */
	#completedTasks = $state<Set<string>>(new Set());
	#loading = $state(true);
	#error = $state<string | null>(null);
	#taskSub: Subscription | null = null;
	#pledgeSub: Subscription | null = null;
	#solutionSub: Subscription | null = null;
	#payoutSub: Subscription | null = null;
	#taskLoader: { unsubscribe(): void } | null = null;
	#pledgeLoader: { unsubscribe(): void } | null = null;
	#solutionLoader: { unsubscribe(): void } | null = null;
	#payoutLoader: { unsubscribe(): void } | null = null;

	constructor() {
		this.#startSubscription();
	}

	#startSubscription() {
		// Subscribe to EventStore timeline for task events
		this.#taskSub = eventStore.timeline({ kinds: [TASK_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				this.#tasks = events.map(parseTaskSummary).filter((s): s is TaskSummary => s !== null);
				this.#loading = false;
			},
			error: (err: unknown) => {
				this.#error = err instanceof Error ? err.message : 'Failed to load tasks';
				this.#loading = false;
			}
		});

		// Subscribe to EventStore timeline for pledge events
		this.#pledgeSub = eventStore.timeline({ kinds: [PLEDGE_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				const totals = new Map<string, number>();
				for (const event of events) {
					const pledge = parsePledge(event);
					if (pledge && pledge.taskAddress) {
						totals.set(pledge.taskAddress, (totals.get(pledge.taskAddress) ?? 0) + pledge.amount);
					}
				}
				this.#pledgeTotals = totals;
			}
		});

		// Subscribe to EventStore timeline for solution events
		this.#solutionSub = eventStore.timeline({ kinds: [SOLUTION_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				const counts = new Map<string, number>();
				for (const event of events) {
					const solution = parseSolution(event);
					if (solution && solution.taskAddress) {
						counts.set(solution.taskAddress, (counts.get(solution.taskAddress) ?? 0) + 1);
					}
				}
				this.#solutionCounts = counts;
			}
		});

		// Subscribe to EventStore timeline for payout events
		this.#payoutSub = eventStore.timeline({ kinds: [PAYOUT_KIND] }).subscribe({
			next: (events: NostrEvent[]) => {
				const completed = new Set<string>();
				for (const event of events) {
					const payout = parsePayout(event);
					if (payout && payout.taskAddress) {
						completed.add(payout.taskAddress);
					}
				}
				this.#completedTasks = completed;
			}
		});

		// Start relay loaders to feed events into EventStore
		this.#taskLoader = createTaskListLoader();
		this.#pledgeLoader = createAllPledgesLoader();
		this.#solutionLoader = createAllSolutionsLoader();
		this.#payoutLoader = createAllPayoutsLoader();
	}

	/** Derive status from available lifecycle data */
	#deriveStatus(task: TaskSummary, address: string, totalPledged: number, solutionCount: number): TaskStatus {
		const now = Math.floor(Date.now() / 1000);

		// Completed — payout events exist
		if (this.#completedTasks.has(address)) return 'completed';

		// Expired — deadline in the past
		if (task.deadline !== null && task.deadline <= now) return 'expired';

		// In review — solutions exist
		if (solutionCount > 0) return 'in_review';

		// Open — pledges exist
		if (totalPledged > 0) return 'open';

		// Draft — no activity
		return 'draft';
	}

	/** Enrich task summaries with aggregated pledge totals, solution counts, and derived status */
	#enriched = $derived.by(() => {
		return this.#tasks.map((task) => {
			const address = `${TASK_KIND}:${task.pubkey}:${task.dTag}`;
			const totalPledged = this.#pledgeTotals.get(address) ?? 0;
			const solutionCount = this.#solutionCounts.get(address) ?? 0;
			const status = this.#deriveStatus(task, address, totalPledged, solutionCount);

			if (
				totalPledged === task.totalPledged &&
				solutionCount === task.solutionCount &&
				status === task.status
			)
				return task;

			return { ...task, totalPledged, solutionCount, status };
		});
	});

	/** All task summaries, sorted by created_at descending (from timeline) */
	get items(): TaskSummary[] {
		return this.#enriched;
	}

	/** Whether the initial load is still in progress */
	get loading(): boolean {
		return this.#loading;
	}

	/** Error message if loading failed */
	get error(): string | null {
		return this.#error;
	}

	/** Items sorted by totalPledged descending */
	get popular(): TaskSummary[] {
		return [...this.#enriched].sort((a, b) => b.totalPledged - a.totalPledged);
	}

	/** Clean up all subscriptions */
	destroy() {
		this.#taskSub?.unsubscribe();
		this.#taskSub = null;
		this.#pledgeSub?.unsubscribe();
		this.#pledgeSub = null;
		this.#solutionSub?.unsubscribe();
		this.#solutionSub = null;
		this.#payoutSub?.unsubscribe();
		this.#payoutSub = null;
		this.#taskLoader?.unsubscribe();
		this.#taskLoader = null;
		this.#pledgeLoader?.unsubscribe();
		this.#pledgeLoader = null;
		this.#solutionLoader?.unsubscribe();
		this.#solutionLoader = null;
		this.#payoutLoader?.unsubscribe();
		this.#payoutLoader = null;
	}
}

/** Singleton task list store */
export const taskList = new TaskListStore();
