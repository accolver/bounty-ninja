// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { collectAllAssets, collectStaticAssets } from '../../../scripts/check-bundle-size';

const manifest = {
	start: { file: 'entry/start.js', name: 'entry/start', imports: ['shared'] },
	app: { file: 'entry/app.js', name: 'entry/app', imports: ['shared'] },
	layout: {
		file: 'nodes/layout.js',
		name: 'nodes/0',
		imports: ['shared'],
		css: ['assets/layout.css']
	},
	home: { file: 'nodes/home.js', name: 'nodes/3', imports: ['shared'] },
	shared: { file: 'chunks/shared.js' },
	lazy: { file: 'chunks/editor.js', name: 'editor', css: ['assets/editor.css'] }
};

describe('bundle budget manifest traversal', () => {
	it('counts only static dependencies of configured route entries as initial assets', () => {
		expect(
			collectStaticAssets(manifest, ['entry/start', 'entry/app', 'nodes/0', 'nodes/3'])
		).toEqual(
			new Set([
				'entry/start.js',
				'entry/app.js',
				'nodes/layout.js',
				'assets/layout.css',
				'nodes/home.js',
				'chunks/shared.js'
			])
		);
	});

	it('counts lazy JavaScript and CSS in total application assets', () => {
		const assets = collectAllAssets(manifest);
		expect(assets).toContain('chunks/editor.js');
		expect(assets).toContain('assets/editor.css');
		expect(assets).toHaveLength(8);
	});

	it('fails closed when a configured initial entry is absent', () => {
		expect(() => collectStaticAssets(manifest, ['missing'])).toThrow(
			'Vite manifest is missing initial entry: missing'
		);
	});
});
