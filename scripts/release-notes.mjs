#!/usr/bin/env node
/**
 * Prints the changelog section for one version, and nothing else.
 *
 * A release body is a release note, not an archive: shipping the whole
 * CHANGELOG.md on every tag is noise. This takes `v1.2.3` or `1.2.3` and emits
 * the `## [1.2.3]` block up to the next `## [` heading.
 */
import { readFileSync } from 'node:fs';

const version = (process.argv[2] ?? '').replace(/^v/, '');
if (!version) {
	console.error('usage: release-notes.mjs <version>');
	process.exit(1);
}

const text = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = text.split('\n');
const start = lines.findIndex((line) => line.startsWith('## [') && line.includes(`[${version}]`));
if (start === -1) {
	console.error(`no section for ${version} in CHANGELOG.md`);
	process.exit(1);
}
let end = lines.length;
for (let index = start + 1; index < lines.length; index += 1) {
	if (lines[index]?.startsWith('## [')) {
		end = index;
		break;
	}
}

const body = lines
	.slice(start + 1, end)
	.join('\n')
	.replace(/\n{3,}/g, '\n\n')
	.trim();

if (!body) {
	console.error(`section for ${version} is empty`);
	process.exit(1);
}
process.stdout.write(`${body}\n`);
