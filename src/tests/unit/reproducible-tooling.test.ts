import { describe, expect, it } from 'vitest';

const files = import.meta.glob(['/mise.toml', '/docker-compose.yml', '/.github/workflows/*.yml'], {
	eager: true,
	import: 'default',
	query: '?raw'
}) as Record<string, string>;

describe('reproducible tooling', () => {
	it('pins runtime tools, relay tooling, and the relay image', () => {
		expect(files['/mise.toml']).toContain('node = "22.23.1"');
		expect(files['/mise.toml']).toContain('bun = "1.3.5"');
		expect(files['/mise.toml']).toContain('"go:github.com/fiatjaf/nak" = "0.20.0"');
		expect(files['/mise.toml']).not.toMatch(/= "latest"/);
		expect(files['/docker-compose.yml']).toMatch(/dockurr\/strfry@sha256:[0-9a-f]{64}/);
	});

	it('pins every GitHub Action to a full commit SHA', () => {
		const workflow = files['/.github/workflows/ci.yml'];
		const actionReferences = [...workflow.matchAll(/uses:\s+([^\s#]+)/g)].map((match) => match[1]);

		expect(actionReferences.length).toBeGreaterThan(0);
		for (const reference of actionReferences) {
			expect(reference).toMatch(/@[0-9a-f]{40}$/);
		}
		expect(workflow).toContain('node-version: 22.23.1');
		expect(workflow).toContain('bun-version: 1.3.5');
		expect(workflow).toContain('wranglerVersion: 4.110.0');
		expect(workflow).toContain('sha256sum --check bounty-ninja-build.tar.gz.sha256');
		expect(workflow).toContain('retention-days: 30');
		expect(workflow).toContain('bun run check:headers');
		expect(workflow).toContain('bunx playwright install --with-deps chromium');
		expect(workflow).toContain('bun run test:e2e');
		expect(workflow).toContain('environment: production');
		expect(workflow).toContain('group: production-deploy');
		expect(workflow).toContain('cancel-in-progress: false');
		expect(workflow).toContain('Reject superseded release');
		expect(workflow).toContain('repos/$GITHUB_REPOSITORY/commits/main');
		expect(workflow.match(/bun run build/g)).toHaveLength(1);
	});

	it('pins every direct package dependency exactly', async () => {
		const manifest = (await import('../../../package.json')).default;
		const versions = [
			...Object.values(manifest.dependencies),
			...Object.values(manifest.devDependencies)
		];

		expect(manifest.packageManager).toBe('bun@1.3.5');
		expect(manifest.engines.node).toBe('22.23.1');
		for (const version of versions) {
			expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
		}
	});
});
