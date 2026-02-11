import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 5573
	},
	preview: {
		port: 5573
	},
	optimizeDeps: {
		// Do NOT exclude @noble/* — they need to be pre-bundled along with their consumers
		// The PRD suggests excluding them, but Vite 7 handles them fine when included
	}
});
