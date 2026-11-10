#!/usr/bin/env node
/**
 * Fetches the pinned core release, verifies it, and unpacks it into vendor/core.
 *
 * The site never resolves the library from a registry and never from `latest`:
 * lib.lock.json names one tag, one tarball and one sha256, so a build is
 * reproducible and a tampered artifact stops the build instead of shipping.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const lockPath = join(root, 'lib.lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const vendorDir = join(root, 'vendor');
const coreDir = join(vendorDir, 'core');
const stampPath = join(coreDir, '.lock');

if (lock.sha256 === 'PENDING') {
	console.error(`lib.lock.json has no sha256 yet for ${lock.tag}; run the release, then pin it.`);
	process.exit(1);
}

if (existsSync(stampPath)) {
	const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
	if (stamp.sha256 === lock.sha256 && existsSync(join(coreDir, 'dist', 'index.js'))) {
		console.log(`core ${lock.version} already unpacked (${lock.sha256.slice(0, 12)}…)`);
		process.exit(0);
	}
}

mkdirSync(vendorDir, { recursive: true });
const tarball = join(vendorDir, `${lock.name.replace('@', '').replace('/', '-')}-${lock.version}.tgz`);

/**
 * Air-gapped escape hatch: ENIGMA_LIB_TARBALL points at an already-downloaded
 * copy. The sha256 check below still runs, so the pin is never relaxed — this
 * only changes where the bytes come from.
 */
const localCopy = process.env.ENIGMA_LIB_TARBALL;
let bytes;
if (localCopy) {
	console.log(`reading ${localCopy} (ENIGMA_LIB_TARBALL)`);
	bytes = readFileSync(localCopy);
} else {
	console.log(`fetching ${lock.url}`);
	const response = await fetch(lock.url, { redirect: 'follow' });
	if (!response.ok) {
		console.error(`download failed: ${response.status} ${response.statusText}`);
		process.exit(1);
	}
	bytes = Buffer.from(await response.arrayBuffer());
}
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== lock.sha256) {
	console.error(`sha256 mismatch for ${lock.tag}: expected ${lock.sha256}, got ${digest}`);
	process.exit(1);
}
writeFileSync(tarball, bytes);

rmSync(coreDir, { recursive: true, force: true });
mkdirSync(coreDir, { recursive: true });
execFileSync('tar', ['-xzf', tarball, '-C', coreDir, '--strip-components=1'], { stdio: 'inherit' });
writeFileSync(stampPath, JSON.stringify({ version: lock.version, sha256: digest, url: lock.url }, null, '\t'));

for (const [specifier, relative] of Object.entries(lock.files)) {
	if (!existsSync(join(coreDir, relative))) {
		console.error(`release is missing ${relative} (needed for ${specifier})`);
		process.exit(1);
	}
}
console.log(`core ${lock.version} unpacked, ${lock.sha256.slice(0, 12)}… verified`);
