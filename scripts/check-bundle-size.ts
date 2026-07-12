import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import budgets from '../bundle-budgets.json';

type ManifestChunk = {
	file: string;
	name?: string;
	imports?: string[];
	css?: string[];
};

type Manifest = Record<string, ManifestChunk>;

const manifestPath = '.svelte-kit/output/client/.vite/manifest.json';
const clientRoot = '.svelte-kit/output/client';

function isBudgetedAsset(path: string): boolean {
	return path.endsWith('.js') || path.endsWith('.css');
}

export function collectStaticAssets(
	manifest: Manifest,
	entryNames: readonly string[]
): Set<string> {
	const keysByName = new Map(
		Object.entries(manifest)
			.filter(([, chunk]) => chunk.name)
			.map(([key, chunk]) => [chunk.name!, key])
	);
	const assets = new Set<string>();
	const visited = new Set<string>();

	function visit(key: string): void {
		if (visited.has(key)) return;
		visited.add(key);
		const chunk = manifest[key];
		if (!chunk) throw new Error(`Vite manifest references missing chunk: ${key}`);
		if (isBudgetedAsset(chunk.file)) assets.add(chunk.file);
		for (const css of chunk.css ?? []) assets.add(css);
		for (const dependency of chunk.imports ?? []) visit(dependency);
	}

	for (const name of entryNames) {
		const key = keysByName.get(name);
		if (!key) throw new Error(`Vite manifest is missing initial entry: ${name}`);
		visit(key);
	}
	return assets;
}

export function collectAllAssets(manifest: Manifest): Set<string> {
	const assets = new Set<string>();
	for (const chunk of Object.values(manifest)) {
		if (isBudgetedAsset(chunk.file)) assets.add(chunk.file);
		for (const css of chunk.css ?? []) assets.add(css);
	}
	return assets;
}

function gzipBytes(path: string): number {
	return gzipSync(readFileSync(`${clientRoot}/${path}`), { level: 9 }).byteLength;
}

function formatKiB(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} KiB`;
}

function assertBudget(label: string, actual: number, limitKiB: number): void {
	const limit = limitKiB * 1024;
	console.log(`${label}: ${formatKiB(actual)} / ${limitKiB} KiB`);
	if (actual > limit) throw new Error(`${label} exceeds its transfer budget`);
}

export function main(): void {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
	const initialAssets = collectStaticAssets(manifest, budgets.initialEntryNames);
	const allAssets = collectAllAssets(manifest);
	const lazyAssets = [...allAssets].filter((asset) => !initialAssets.has(asset));
	const initialBytes = [...initialAssets].reduce((total, asset) => total + gzipBytes(asset), 0);
	const totalBytes = [...allAssets].reduce((total, asset) => total + gzipBytes(asset), 0);
	const largestLazy = lazyAssets
		.map((asset) => ({ asset, bytes: gzipBytes(asset) }))
		.sort((left, right) => right.bytes - left.bytes)[0];

	assertBudget('Initial home route', initialBytes, budgets.initialRouteKiB);
	assertBudget('Largest lazy chunk', largestLazy?.bytes ?? 0, budgets.largestLazyChunkKiB);
	if (largestLazy) console.log(`Largest lazy asset: ${largestLazy.asset}`);
	assertBudget('Total application JS/CSS', totalBytes, budgets.totalAssetsKiB);
}

if (import.meta.main) main();
