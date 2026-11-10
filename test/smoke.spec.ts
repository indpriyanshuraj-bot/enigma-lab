import { expect, test, type Page } from '@playwright/test';

/** Every console error is a failure: this is the check typecheck cannot make. */
function watchConsole(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));
	return errors;
}

test('the machine boots and ciphers AAAAA to BDZGO', async ({ page }) => {
	const errors = watchConsole(page);
	await page.goto('./');

	await expect(page.getByRole('heading', { name: 'Enigma Lab', level: 1 })).toBeVisible();
	for (let index = 0; index < 5; index += 1) await page.getByRole('button', { name: 'Press A' }).click();

	await expect(page.locator('.output__text')).toHaveText('BDZGO');
	expect(errors).toEqual([]);
});

test('typing on a physical keyboard works and Backspace edits', async ({ page }) => {
	await page.goto('./');
	await page.locator('body').click({ position: { x: 4, y: 4 } });
	await page.keyboard.type('HELLO');
	await expect(page.locator('.output__text')).toHaveText(/^[A-Z]{5}$/);
	await page.keyboard.press('Backspace');
	await expect(page.locator('.output__text')).toHaveText(/^[A-Z]{4}$/);
});

test('the two interfaces share one machine', async ({ page }) => {
	await page.goto('./');
	for (let index = 0; index < 3; index += 1) await page.getByRole('button', { name: 'Press A' }).click();
	const formOutput = await page.locator('.output__text').textContent();

	await page.getByRole('button', { name: '3D', exact: true }).click();
	await expect(page.locator('.machine__canvas3d')).toBeVisible();
	// The same letters, read out in HTML so they stay selectable and announced.
	await expect(page.locator('.readout__value--wide').nth(1)).toHaveText(formOutput ?? '');
	await expect(page.locator('.readout__value--wide').first()).toHaveText('AAD');

	await page.getByRole('button', { name: 'Form', exact: true }).click();
	await expect(page.locator('.output__text')).toHaveText(formOutput ?? '');
});

test('the 3D machine turns with the keyboard', async ({ page }) => {
	await page.goto('./');
	await page.getByRole('button', { name: '3D', exact: true }).click();
	const stage = page.getByRole('application');
	await stage.focus();
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('.machine__canvas3d')).toBeVisible();
	await page.getByRole('button', { name: 'Reset view' }).click();
	await expect(page.locator('.machine__canvas3d')).toBeVisible();
});

test('settings change the theme and the theme persists', async ({ page }) => {
	await page.goto('./');
	await page.getByRole('button', { name: 'Settings' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await dialog.getByRole('radio', { name: /Archive/ }).check();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia');
	await dialog.getByRole('button', { name: 'Close settings' }).click();
	await expect(dialog).toBeHidden();

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia');
});

test('the key space panel agrees with the arithmetic', async ({ page }) => {
	await page.goto('./');
	await expect(page.locator('.keyspace__total small')).toHaveText(/keys · \d+\.\d bits/);
	await expect(page.getByText(/Ten cables is stronger than thirteen/)).toBeVisible();
});

test('a custom machine can be built with many rotors', async ({ page }) => {
	await page.goto('./');
	await page.getByRole('combobox').first().selectOption('custom');
	await expect(page.getByRole('heading', { name: 'Build your own' })).toBeVisible();
	await page.getByLabel(/Rotors: \d+/).fill('40');
	await expect(page.getByLabel(/Rotors: 40/)).toBeVisible();
	await page.getByRole('button', { name: 'Press A' }).click();
	await expect(page.locator('.output__text')).toHaveText(/^[A-Z]$/);
});

test('the about and facts pages stand on their own', async ({ page }) => {
	await page.goto('./about.html');
	await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible();
	await expect(page.getByText('Marian Rejewski')).toBeVisible();

	await page.getByRole('link', { name: 'Fun facts' }).first().click();
	await expect(page.getByRole('heading', { name: 'Fun facts', level: 1 })).toBeVisible();
	await expect(page.locator('.facts li')).toHaveCount(12);
});

test('nothing overflows a 360 pixel phone', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	for (const path of ['./', './about.html', './facts.html']) {
		await page.goto(path);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		expect(overflow, path).toBeLessThanOrEqual(1);
	}
});

test('the offline shell is registered', async ({ page }) => {
	await page.goto('./');
	await expect
		.poll(
			() =>
				page.evaluate(async () => {
					if (!('serviceWorker' in navigator)) return false;
					const registration = await navigator.serviceWorker.getRegistration('./');
					return Boolean(registration);
				}),
			{ timeout: 10_000 },
		)
		.toBe(true);
});

test('pages carry the metadata a crawler needs', async ({ page }) => {
	for (const [path, title] of [
		['./', /Enigma Lab/],
		['./about.html', /About Enigma Lab/],
		['./facts.html', /Enigma facts/],
	] as const) {
		await page.goto(path);
		await expect(page).toHaveTitle(title);
		const description = await page.locator('meta[name="description"]').getAttribute('content');
		expect(description?.length ?? 0, path).toBeGreaterThan(60);
		await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
		await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	}
});
