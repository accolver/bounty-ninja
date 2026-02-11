import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: [
			'src/tests/unit/**/*.{test,spec}.{js,ts}',
			'src/tests/integration/**/*.{test,spec}.{js,ts}'
		],
		environment: 'jsdom'
	}
});
