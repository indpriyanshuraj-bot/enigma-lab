import { fileURLToPath, URL } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

/**
 * Vite 8 is built on Rolldown, so the site gets the same bundler as the library
 * it consumes, with OXC for minification. `BASE_PATH` is injected by CI so the
 * same source deploys to a project page or a custom domain.
 */
export default defineConfig({
	base: process.env.BASE_PATH ?? '/enigma-lab/',
	plugins: [preact()],
	resolve: {
		alias: {
			'@enigma-lab/core/render': fileURLToPath(new URL('./vendor/core/dist/render.js', import.meta.url)),
			'@enigma-lab/core': fileURLToPath(new URL('./vendor/core/dist/index.js', import.meta.url)),
		},
	},
	build: {
		target: 'es2022',
		cssMinify: 'esbuild',
		assetsInlineLimit: 2048,
		reportCompressedSize: true,
		rollupOptions: {
			// Three pages, one bundle graph: the app, plus two static pages that ship no
			// JavaScript at all beyond a theme probe.
			input: {
				main: fileURLToPath(new URL('./index.html', import.meta.url)),
				about: fileURLToPath(new URL('./about.html', import.meta.url)),
				facts: fileURLToPath(new URL('./facts.html', import.meta.url)),
			},
			output: {
				entryFileNames: 'assets/[name]-[hash].js',
				chunkFileNames: 'assets/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash][extname]',
			},
		},
	},
	server: { port: 5173, host: true },
	preview: { port: 4173 },
});
