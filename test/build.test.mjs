import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist');

test('the build ships a complete static site', () => {
	for (const file of ['index.html', '404.html', 'sw.js', 'manifest.webmanifest', 'precache.json', 'favicon.svg']) {
		assert.ok(existsSync(join(dist, file)), `${file} is missing from dist`);
	}
});

test('the shell carries the progressive-enhancement basics', () => {
	const html = readFileSync(join(dist, 'index.html'), 'utf8');
	assert.match(html, /<noscript>/, 'no <noscript> fallback');
	assert.match(html, /rel="manifest"/, 'no web app manifest link');
	assert.match(html, /name="theme-color"/, 'no theme-color');
	assert.match(html, /<html lang="en"/, 'no language');
	assert.ok(!/http:\/\//.test(html), 'insecure absolute URL in the shell');
});

test('the manifest is installable', () => {
	const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
	assert.equal(manifest.display, 'standalone');
	assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'no maskable icon');
	for (const icon of manifest.icons) {
		const path = icon.src.replace('./', '');
		if (path.startsWith('icons/')) assert.ok(existsSync(join(dist, path)), `${icon.src} does not resolve`);
	}
});

test('the precache list only references files that exist', () => {
	const { urls, version } = JSON.parse(readFileSync(join(dist, 'precache.json'), 'utf8'));
	assert.ok(version.length >= 8);
	for (const url of urls) {
		if (url === './') continue;
		assert.ok(existsSync(join(dist, url.replace('./', ''))), `${url} is precached but missing`);
	}
});

test('the 404 page stands on its own', () => {
	const html = readFileSync(join(dist, '404.html'), 'utf8');
	assert.match(html, /404/);
	assert.match(html, /href="\.\/"/, 'no way back to the machine');
});
