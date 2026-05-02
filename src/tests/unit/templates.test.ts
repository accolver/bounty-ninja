import { describe, expect, it } from 'vitest';
import { bountyTemplates, getBountyTemplate } from '$lib/bounty/templates';

describe('bountyTemplates', () => {
	it('provides starter templates with editable bounty fields', () => {
		expect(bountyTemplates.length).toBeGreaterThanOrEqual(5);
		for (const template of bountyTemplates) {
			expect(template.id).toBeTruthy();
			expect(template.name).toBeTruthy();
			expect(template.title).toBeTruthy();
			expect(template.body.length).toBeGreaterThan(10);
			expect(template.tags.length).toBeGreaterThan(0);
		}
	});

	it('finds templates by id', () => {
		expect(getBountyTemplate('bug-fix')?.name).toBe('Fix a bug');
		expect(getBountyTemplate('missing')).toBeUndefined();
	});
});
