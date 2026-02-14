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
	build: {
		// Milkdown/Crepe WYSIWYG editor produces a ~1.4MB chunk (code-split, lazy-loaded).
		// Raise the limit to suppress the warning since this is an expected third-party cost.
		chunkSizeWarningLimit: 1500
	},
	optimizeDeps: {
		// Do NOT exclude @noble/* — they need to be pre-bundled along with their consumers
		// The PRD suggests excluding them, but Vite 7 handles them fine when included
	}
});
