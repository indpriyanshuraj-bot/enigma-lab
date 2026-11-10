import { expect, test } from '@playwright/test';

/** Every console error is a failure: this is the check typecheck cannot make. */
function watchConsole(page: import('@playwright/test').Page): string[] {
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
	// Default preset, rings AAA, start AAA: the published trace for I II III / UKW-B.
	await page.getByRole('button', { name: 'Press A' }).click();
	await page.getByRole('button', { name: 'Press A' }).click();
	await page.getByRole('button', { name: 'Press A' }).click();
	await page.getByRole('button', { name: 'Press A' }).click();
	await page.getByRole('button', { name: 'Press A' }).click();

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

test('the lid opens, a rotor can be worked, and the renderer reports itself', async ({ page }) => {
	await page.goto('./');
	await expect(page.getByText(/Rendering:/)).toBeVisible();
	await expect(page.getByText(/SVG|WebGPU/)).toBeVisible();

	const lidButton = page.getByRole('button', { name: /Lift the lid|Close the lid/ }).first();
	if (await page.getByRole('button', { name: 'Lift the lid' }).count()) {
		await lidButton.click();
	}
	const rotor = page.getByRole('button', { name: /^Rotor 1,/ });
	await rotor.click();
	await expect(page.getByRole('group', { name: /Rotor 1$/ })).toBeVisible();
	await expect(page.getByText(/Rotor 1: /)).toBeVisible();
});

test('the key space panel agrees with the arithmetic', async ({ page }) => {
	await page.goto('./');
	// The panel starts from the machine's own settings, so the figure is the
	// current key space, not a textbook constant.
	await expect(page.locator('.keyspace__total span')).toHaveText(/^[\d.,]+( × 10\^\d+)?$/);
	await expect(page.locator('.keyspace__total small')).toHaveText(/keys · \d+\.\d bits/);
	await expect(page.getByText(/Ten cables is stronger than thirteen/)).toBeVisible();
});

test('a custom machine can be built with many rotors', async ({ page }) => {
	await page.goto('./');
	await page.getByRole('combobox').first().selectOption('custom');
	await expect(page.getByRole('heading', { name: 'Build your own' })).toBeVisible();
	const slider = page.getByLabel(/Rotors: \d+/);
	await slider.fill('40');
	await expect(page.getByLabel(/Rotors: 40/)).toBeVisible();
	await page.getByRole('button', { name: 'Press A' }).click();
	await expect(page.locator('.output__text')).toHaveText(/^[A-Z]$/);
});

test('nothing overflows a 360 pixel phone', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('./');
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
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
