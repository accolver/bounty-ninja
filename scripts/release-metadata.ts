import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

export type ReleaseMetadata = {
	commit: string;
	source: { type: 'github'; runId: string; attempt: string } | { type: 'local'; marker: string };
	timestamp: string;
	paymentWritesEnabled: boolean;
	deploymentChannel: string;
	artifactDigest: { algorithm: 'sha256'; scope: 'build-without-release-metadata'; value: string };
};

async function payloadFiles(directory: string, root = directory): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await payloadFiles(path, root)));
		else if (relative(root, path) !== 'release.json') files.push(path);
	}
	return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

export async function digestBuild(directory = 'build'): Promise<string> {
	const root = resolve(directory);
	const hash = createHash('sha256');
	for (const path of await payloadFiles(root)) {
		const name = relative(root, path);
		const contents = await readFile(path);
		hash.update(`${name.length}:${name}:${contents.byteLength}:`);
		hash.update(contents);
	}
	return hash.digest('hex');
}

export function validateReleaseMetadata(value: unknown): asserts value is ReleaseMetadata {
	if (!value || typeof value !== 'object') throw new Error('release metadata must be an object');
	const release = value as Partial<ReleaseMetadata>;
	if (!release.commit?.match(/^[0-9a-f]{40}$/))
		throw new Error('release commit must be a full SHA');
	if (!release.timestamp || Number.isNaN(Date.parse(release.timestamp))) {
		throw new Error('release timestamp must be ISO-8601');
	}
	if (typeof release.paymentWritesEnabled !== 'boolean') {
		throw new Error('release paymentWritesEnabled must be boolean');
	}
	if (!release.deploymentChannel) throw new Error('release deployment channel is required');
	if (
		!release.artifactDigest ||
		release.artifactDigest.algorithm !== 'sha256' ||
		release.artifactDigest.scope !== 'build-without-release-metadata' ||
		!/^[0-9a-f]{64}$/.test(release.artifactDigest.value)
	) {
		throw new Error('release artifact digest must identify the build payload SHA-256');
	}
	if (
		!release.source ||
		(release.source.type !== 'github' && release.source.type !== 'local') ||
		(release.source.type === 'github' && (!release.source.runId || !release.source.attempt)) ||
		(release.source.type === 'local' && !release.source.marker)
	) {
		throw new Error('release source must identify a GitHub run/attempt or local marker');
	}
}

async function main(): Promise<void> {
	const command = process.argv[2] ?? 'create';
	const path = process.argv[3] ?? 'build/release.json';
	if (command === 'validate') {
		const release: unknown = JSON.parse(await readFile(path, 'utf8'));
		validateReleaseMetadata(release);
		const digest = await digestBuild(resolve(path, '..'));
		if (release.artifactDigest.value !== digest)
			throw new Error('release artifact digest mismatch');
		return;
	}

	const commit = process.env.RELEASE_COMMIT ?? '';
	if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('RELEASE_COMMIT must be a full commit SHA');
	const githubRunId = process.env.GITHUB_RUN_ID;
	const source: ReleaseMetadata['source'] = githubRunId
		? { type: 'github', runId: githubRunId, attempt: process.env.GITHUB_RUN_ATTEMPT ?? '1' }
		: { type: 'local', marker: process.env.RELEASE_LOCAL_MARKER ?? 'operator-build' };
	const paymentWritesEnabled = process.env.PUBLIC_PAYMENT_WRITES_ENABLED === 'true';
	const release: ReleaseMetadata = {
		commit,
		source,
		timestamp: new Date().toISOString(),
		paymentWritesEnabled,
		deploymentChannel: process.env.RELEASE_CHANNEL ?? 'local',
		artifactDigest: {
			algorithm: 'sha256',
			scope: 'build-without-release-metadata',
			value: await digestBuild(resolve(path, '..'))
		}
	};
	await writeFile(path, `${JSON.stringify(release, null, 2)}\n`);
}

if (import.meta.main) await main();
