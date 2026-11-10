import { defineConfig, devices } from '@playwright/test';

/**
 * One browser, two viewports, no retries: the smoke test exists to catch the
 * class of bug typechecking cannot see — a runtime error, a broken layout, a
 * missing fallback.
 */
export default defineConfig({
	testDir: './test',
	testMatch: /.*\.spec\.ts/,
	fullyParallel: true,
	forbidOnly: true,
	retries: 0,
	reporter: process.env.CI ? [['github'], ['list']] : [['list']],
	use: {
		baseURL: 'http://127.0.0.1:4173/enigma-lab/',
		trace: 'off',
		screenshot: 'off',
		// CI uses the browser Playwright installs; a locked-down machine can point
		// this at a system Chromium instead.
		launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
			: {},
	},
	projects: [
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
	],
	webServer: {
		command: 'pnpm exec vite preview --port 4173 --strictPort',
		url: 'http://127.0.0.1:4173/enigma-lab/',
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
});
