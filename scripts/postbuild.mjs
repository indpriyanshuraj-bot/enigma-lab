#!/usr/bin/env node
/**
 * Finishes the static site: writes the service-worker precache manifest, checks
 * the artifacts that make this a real PWA, and reports bundle weight.
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

function walk(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = join(dir, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

const files = walk(dist);
const hashed = files.filter((file) => /\/assets\//.test(file));
const version = createHash('sha256')
	.update(hashed.map((file) => relative(dist, file)).sort().join('\n'))
	.digest('hex')
	.slice(0, 12);

// Every HTML file the build produced is part of the offline shell, so a deep link
// to the about page still works in a tunnel.
const pages = files
	.map((file) => relative(dist, file).split('\\').join('/'))
	.filter((file) => file.endsWith('.html'))
	.map((file) => `./${file}`);
const shell = [
	'./',
	...new Set([...pages, './manifest.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './404.html']),
];
const assets = hashed.map((file) => `./${relative(dist, file).split('\\').join('/')}`);
const urls = [...new Set([...shell, ...assets])];

writeFileSync(join(dist, 'precache.json'), `${JSON.stringify({ version, generated: new Date().toISOString(), urls }, null, '\t')}\n`);

const required = ['index.html', 'about.html', 'facts.html', '404.html', 'sw.js', 'manifest.webmanifest', 'precache.json', 'favicon.svg', 'sitemap.xml', 'robots.txt'];
const present = new Set(walk(dist).map((file) => relative(dist, file)));
const missing = required.filter((name) => !present.has(name));
if (missing.length) {
	console.error(`missing build artifacts: ${missing.join(', ')}`);
	process.exit(1);
}

const budgets = [
	['total js', hashed.filter((f) => f.endsWith('.js')).reduce((sum, f) => sum + statSync(f).size, 0), 120_000],
	['total css', hashed.filter((f) => f.endsWith('.css')).reduce((sum, f) => sum + statSync(f).size, 0), 40_000],
];
let failed = false;
for (const [label, size, budget] of budgets) {
	const ok = size <= budget;
	if (!ok) failed = true;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${(size / 1024).toFixed(1)} kB (budget ${(budget / 1024).toFixed(0)} kB)`);
}
const shellHtml = readFileSync(join(dist, 'index.html'));
console.log(`info index.html ${(shellHtml.length / 1024).toFixed(1)} kB raw, ${(gzipSync(shellHtml).length / 1024).toFixed(1)} kB gzip`);
console.log(`info precache ${urls.length} urls, version ${version}`);
process.exit(failed ? 1 : 0);
