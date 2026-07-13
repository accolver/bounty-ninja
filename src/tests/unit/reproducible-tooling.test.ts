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
		const actionReferences = Object.entries(files)
			.filter(([path]) => path.startsWith('/.github/workflows/'))
			.flatMap(([, contents]) =>
				[...contents.matchAll(/uses:\s+([^\s#]+)/g)].map((match) => match[1])
			);

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
		expect(workflow).toContain('timeout-minutes: 60');
		expect(workflow).toContain('timeout-minutes: 15');
		expect(workflow).toContain('--branch=main');
		expect(workflow).toContain('bun run release:create');
		expect(workflow).toContain('cancel-in-progress: false');
		expect(workflow).toContain('Reject superseded release');
		expect(workflow).toContain('repos/$GITHUB_REPOSITORY/commits/main');
		expect(workflow).toContain('ref: ${{ github.sha }}');
		expect(workflow).toContain('path: source');
		expect(workflow).toContain('persist-credentials: false');
		expect(workflow).toContain('bun run source/scripts/smoke-deployment.ts');
		expect(workflow.match(/bun run build/g)).toHaveLength(1);
	});

	it('rolls back only through the protected retained-artifact workflow', () => {
		const workflow = files['/.github/workflows/rollback.yml'];
		expect(workflow).toContain('environment: production');
		expect(workflow).toContain('group: production-deploy');
		expect(workflow).toContain('run-id: ${{ inputs.run_id }}');
		expect(workflow).toContain('actions/workflows/ci.yml');
		expect(workflow).toContain('actions/runs/$EXPECTED_RUN_ID');
		expect(workflow).toContain('test "$(jq -r .event <<<"$run_json")" = "push"');
		expect(workflow).toContain('test "$(jq -r .head_branch <<<"$run_json")" = "main"');
		expect(workflow).toContain('test "$(jq -r .conclusion <<<"$run_json")" = "success"');
		expect(workflow).toContain('test "$(jq -r .head_sha <<<"$run_json")" = "$EXPECTED_COMMIT"');
		expect(workflow).toContain('ref: ${{ inputs.commit }}');
		expect(workflow).toContain('git merge-base --is-ancestor');
		expect(workflow.indexOf('Verify retained artifact source run')).toBeLessThan(
			workflow.indexOf('Download retained verified artifact')
		);
		expect(workflow).toContain('sha256sum --check bounty-ninja-build.tar.gz.sha256');
		expect(workflow).toContain(
			'bun run source/scripts/release-metadata.ts validate build/release.json'
		);
		expect(workflow).toContain('--branch=main');
		expect(workflow).toContain('https://bounty.ninja');
	});

	it('does not permit a dirty local production upload', () => {
		const mise = files['/mise.toml'];
		expect(mise).toContain('git status --porcelain');
		expect(mise).toContain('git rev-parse origin/main');
		expect(mise).toContain('gh workflow run ci.yml --ref main');
		expect(mise).not.toContain('--commit-dirty');
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
