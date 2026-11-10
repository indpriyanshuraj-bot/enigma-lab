/**
 * A console recorder, for the phones that have no console.
 *
 * Nothing is captured unless the operator turns it on in settings. When it is on,
 * console output, uncaught errors and unhandled rejections are kept in a ring
 * buffer that can be read and copied from the settings sheet.
 */
export interface LogEntry {
	readonly at: number;
	readonly level: 'log' | 'info' | 'warn' | 'error';
	readonly message: string;
}

const MAX = 200;
const buffer: LogEntry[] = [];
let installed = false;
let enabled = false;

function record(level: LogEntry['level'], args: unknown[]): void {
	if (!enabled) return;
	const message = args
		.map((value) => {
			if (value instanceof Error) return `${value.name}: ${value.message}`;
			if (typeof value === 'string') return value;
			try {
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		})
		.join(' ');
	buffer.push({ at: Date.now(), level, message });
	if (buffer.length > MAX) buffer.shift();
}

/** Starts capturing. Safe to call more than once. */
export function installRecorder(): void {
	if (installed) {
		enabled = true;
		return;
	}
	installed = true;
	enabled = true;
	for (const level of ['log', 'info', 'warn', 'error'] as const) {
		const original = console[level].bind(console);
		console[level] = (...args: unknown[]) => {
			record(level, args);
			original(...args);
		};
	}
	globalThis.addEventListener('error', (event) => {
		record('error', [event.message, `${event.filename}:${event.lineno}`]);
	});
	globalThis.addEventListener('unhandledrejection', (event) => {
		record('error', ['Unhandled rejection', event.reason]);
	});
}

/** Stops capturing without losing what was captured. */
export function pauseRecorder(): void {
	enabled = false;
}

export function readLogs(): readonly LogEntry[] {
	return [...buffer];
}

export function clearLogs(): void {
	buffer.length = 0;
}

/** A plain-text copy, for pasting into an issue. */
export function formatLogs(): string {
	return readLogs()
		.map((entry) => `${new Date(entry.at).toISOString()} ${entry.level.toUpperCase().padEnd(5)} ${entry.message}`)
		.join('\n');
}
