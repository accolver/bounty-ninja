import { TAXONOMY } from './taxonomy';
import type { BountySummary } from './types';

/** Maximum number of auto-suggested tags */
const MAX_SUGGESTIONS = 5;

/**
 * Scan the bounty title and description for taxonomy matches.
 *
 * Returns an ordered array of suggested tag names (most specific matches
 * first). The caller should present these as dismissible chips in the
 * BountyForm UI.
 *
 * @param title - Bounty title text.
 * @param description - Bounty description text (Markdown).
 * @returns Array of canonical tag names, at most MAX_SUGGESTIONS.
 */
export function suggestTags(title: string, description: string): string[] {
	const text = `${title} ${description}`.toLowerCase();
	const matches: Array<{ tag: string; score: number }> = [];

	for (const entry of TAXONOMY) {
		let score = 0;
		for (const pattern of entry.patterns) {
			// Count matches — more matches = higher confidence
			const globalPattern = new RegExp(pattern.source, 'gi');
			const hits = text.match(globalPattern);
			if (hits) {
				score += hits.length;
				// Title matches count double — they're more intentional
				const titleHits = title.toLowerCase().match(globalPattern);
				if (titleHits) score += titleHits.length;
			}
		}
		if (score > 0) {
			matches.push({ tag: entry.tag, score });
		}
	}

	// Sort by score (descending), take top N
	matches.sort((a, b) => b.score - a.score);
	return matches.slice(0, MAX_SUGGESTIONS).map((m) => m.tag);
}

/**
 * Get popular tags from cached bounty items for autocomplete.
 *
 * Scans all provided bounty summaries, counts tag frequency, and returns
 * tags matching the given prefix sorted by popularity.
 *
 * @param prefix - User's partial input (e.g., "bit" matches "bitcoin", "bitkey").
 * @param items - Array of BountySummary to scan for tags.
 * @param limit - Maximum number of suggestions to return.
 * @returns Array of { tag, count } sorted by count descending.
 */
export function getPopularTags(
	prefix: string,
	items: BountySummary[],
	limit = 10
): Array<{ tag: string; count: number }> {
	const normalizedPrefix = prefix.trim().toLowerCase();
	if (!normalizedPrefix) return [];

	const counts = new Map<string, number>();
	for (const item of items) {
		for (const tag of item.tags) {
			const normalized = tag.toLowerCase();
			if (normalized.startsWith(normalizedPrefix)) {
				counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
			}
		}
	}

	return Array.from(counts.entries())
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
}
