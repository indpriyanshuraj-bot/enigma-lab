import { expect, test } from '@playwright/test';

test('the 3D machine types when a key is tapped and turns when dragged', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('./');
	await page.getByRole('button', { name: '3D', exact: true }).click();
	await page.waitForTimeout(1500);
	const stage = page.locator('.machine--3d .machine__stage');
	const box = await stage.boundingBox();
	if (!box) throw new Error('no stage');

	// Tap a key on the deck: the machine must press it and the display must answer.
	let pressed = false;
	for (const [fx, fy] of [[0.5, 0.55], [0.5, 0.6], [0.45, 0.58], [0.55, 0.58]]) {
		await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
		await page.waitForTimeout(250);
		if ((await page.locator('.display__out').textContent()) !== '—') {
			pressed = true;
			break;
		}
	}
	expect(pressed, 'a tap on the deck must press a key').toBe(true);

	// Drag: the camera must move. The stage publishes its view, so this is checked
	// against the real camera rather than against pixels a headless GL may not paint.
	await page.getByRole('button', { name: 'Reset', exact: true }).click();
	await page.waitForTimeout(400);
	const before = await stage.getAttribute('data-view');
	await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.5 + 120, box.y + box.height * 0.5, { steps: 12 });
	await page.mouse.up();
	await page.waitForTimeout(600);
	const after = await stage.getAttribute('data-view');
	expect(after, 'dragging must move the camera').not.toBe(before);
	expect(errors).toEqual([]);
});
