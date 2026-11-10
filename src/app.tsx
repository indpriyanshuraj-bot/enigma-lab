import { formatKeyspace, indexToSymbol, PRESETS, transmit, VERSION } from '@enigma-lab/core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { Keypad } from './modes/keypad.js';
import { ThreeDMode } from './modes/three-d-mode.js';
import { CUSTOM_PRESET_ID, encodeHash, keyspaceFor, loadState, machineFor, nextLetter, rollKey, saveState, stateForPreset, type LabState } from './state/store.js';
import { applyTheme, loadPrefs, savePrefs, type Mode, type Prefs } from './state/prefs.js';
import { clearLogs, formatLogs, installRecorder, pauseRecorder, readLogs } from './state/logs.js';
import { Builder, KeyspaceExplorer, SignalPanel } from './ui/panels.js';
import { Controls } from './ui/controls.js';
import { IconChart, IconClear, IconCopy, IconGears, IconKeyboard, IconSignal, IconWheels } from './ui/icons.js';
import { InstallBanner } from './ui/install.js';
import { Settings } from './ui/settings.js';
import { Sheet } from './ui/sheet.js';

const PRESET_IDS = [...Object.keys(PRESETS), CUSTOM_PRESET_ID];
type SheetId = 'keys' | 'space' | 'signal' | 'message' | 'note' | 'log';

function dailyKey(state: LabState) {
	return { rotorOrder: [...state.rotorOrder], rings: state.rings, positions: state.positions };
}

export function App() {
	const [state, setState] = useState<LabState>(() => loadState());
	const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
	const [backend, setBackend] = useState('detecting');
	const [lit, setLit] = useState<string | null>(null);
	const [selected, setSelected] = useState<number | null>(null);
	const [lidOpen, setLidOpen] = useState(true);
	const [messageKey, setMessageKey] = useState('QWE');
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [sheet, setSheet] = useState<SheetId | null>(null);
	const [pendingPlug, setPendingPlug] = useState<string | null>(null);
	const [notes, setNotes] = useState(() => {
		try {
			return localStorage.getItem('enigma-lab:notes') ?? 'GRUNDSTELLUNG AAA\nRINGS BBB\nCABLES 10';
		} catch {
			return 'GRUNDSTELLUNG AAA';
		}
	});

	const mode: Mode = prefs.mode;
	const noteLines = notes.split('\n');

	useEffect(() => {
		try {
			localStorage.setItem('enigma-lab:notes', notes);
		} catch {
			// Private mode: the note simply does not persist.
		}
	}, [notes]);

	const run = useMemo(() => {
		const machine = machineFor(state);
		const output = machine.encrypt(state.input);
		const rotors = machine.rotors.map((rotor, index) => ({
			id: rotor.spec.id,
			window: indexToSymbol(machine.alphabet, rotor.position),
			ring: state.rings[index] ?? 'A',
			atNotch: rotor.atNotch(),
		}));
		const signal = (() => {
			try {
				const sent = transmit(machineFor(state), state.input, dailyKey(state), messageKey.padEnd(3, 'A').slice(0, 3));
				return { indicator: sent.indicator, body: sent.body };
			} catch {
				return { indicator: '', body: '' };
			}
		})();
		return { output, window: machine.window, rotors, reflector: machine.reflector.name, signal, alphabet: machine.alphabet };
	}, [state, messageKey]);

	const breakdown = useMemo(() => keyspaceFor(state), [state]);

	useEffect(() => {
		saveState(state);
		const { pathname, search } = location;
		history.replaceState(null, '', `${pathname}${search}${encodeHash(state)}`);
	}, [state]);

	useEffect(() => {
		savePrefs(prefs);
		applyTheme(prefs.theme);
		document.documentElement.dataset.motion = prefs.motion ? 'on' : 'off';
		document.documentElement.dataset.density = prefs.density;
	}, [prefs]);

	useEffect(() => {
		if (prefs.logs) installRecorder();
		else pauseRecorder();
	}, [prefs.logs]);

	useEffect(() => {
		if (!('serviceWorker' in navigator) || !globalThis.isSecureContext) return;
		navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
			// Offline support is a bonus, never a requirement.
		});
	}, []);

	const press = useCallback((letter: string) => {
		setState((current) => ({ ...current, input: `${current.input}${letter}`.slice(0, 400) }));
		setLit(letter);
	}, []);

	const backspace = useCallback(() => {
		setState((current) => ({ ...current, input: [...current.input].slice(0, -1).join('') }));
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const letter = event.key.toUpperCase();
			if (/^[A-Z]$/.test(letter)) {
				event.preventDefault();
				press(letter);
			} else if (event.key === 'Backspace') {
				event.preventDefault();
				backspace();
			} else if (event.key === 'Escape') {
				setState((current) => ({ ...current, input: '' }));
			}
		};
		globalThis.addEventListener('keydown', onKeyDown);
		return () => globalThis.removeEventListener('keydown', onKeyDown);
	}, [press, backspace]);

	useEffect(() => {
		if (!lit) return;
		const timer = setTimeout(() => setLit(null), 180);
		return () => clearTimeout(timer);
	}, [lit]);

	const stepRotor = (index: number) => {
		setSelected(index);
		const chars = [...state.positions];
		chars[index] = nextLetter(chars[index] ?? 'A');
		setState({ ...state, positions: chars.join('') });
	};

	const plug = (letter: string) => {
		if (!pendingPlug) {
			setPendingPlug(letter);
			return;
		}
		if (pendingPlug === letter) {
			setPendingPlug(null);
			return;
		}
		const kept = state.plugboard.filter((pair) => !pair.includes(letter) && !pair.includes(pendingPlug));
		setState({ ...state, plugboard: [...kept, [pendingPlug, letter] as const] });
		setPendingPlug(null);
	};

	const shared = {
		state,
		onChange: setState,
		run,
		breakdown,
		selected,
		onSelectRotor: stepRotor,
		lidOpen,
		onToggleLid: () => setLidOpen(!lidOpen),
		lit,
		onPress: press,
		onBackspace: backspace,
	};

	return (
		<div class="app" data-mode={mode}>
			<a class="skip-link" href="#pad">
				Skip to the keys
			</a>

			<header class="bar">
				<div class="bar__brand">
					<span class="bar__mark" aria-hidden="true">
						<svg viewBox="0 0 32 32" width="22" height="22">
							<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2.5" />
							<circle cx="16" cy="16" r="3.4" fill="currentColor" />
							<path d="M16 5v3.4M16 23.6V27M5 16h3.4M23.6 16H27" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
						</svg>
					</span>
					<h1 class="bar__title">Enigma Lab</h1>
				</div>

				<div class="switch" role="group" aria-label="Interface">
					<button type="button" aria-pressed={mode === 'form'} class={mode === 'form' ? 'switch__option is-on' : 'switch__option'} onClick={() => setPrefs({ ...prefs, mode: 'form' })}>
						Keys
					</button>
					<button type="button" aria-pressed={mode === '3d'} class={mode === '3d' ? 'switch__option is-on' : 'switch__option'} onClick={() => setPrefs({ ...prefs, mode: '3d' })}>
						3D
					</button>
				</div>

				<button type="button" class="icon-button" aria-haspopup="dialog" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
					<IconGears />
				</button>
			</header>

			<InstallBanner />

			<section class="display" aria-label="Machine readout">
				<div class="display__meta">
					<span class="display__window">{run.window}</span>
					<span class="display__bits">{breakdown.bits.toFixed(1)} bits</span>
				</div>
				<p class="display__input" aria-hidden="true">
					{state.input || 'Type a letter'}
				</p>
				<div class="display__row">
					<p class="display__out" aria-live="polite" aria-label="Lampboard">
						{run.output || '—'}
					</p>
					<button type="button" class="icon-button icon-button--onDark" disabled={!state.input} onClick={() => setState({ ...state, input: '' })} aria-label="Clear">
						<IconClear />
					</button>
					<button type="button" class="icon-button icon-button--onDark" disabled={!run.output} onClick={() => void navigator.clipboard?.writeText(run.output)} aria-label="Copy output">
						<IconCopy />
					</button>
				</div>
			</section>

			<main class="stage" id="pad">
				{mode === 'form' ? (
					<Keypad wheels={run.rotors} lit={lit} onPress={press} onBackspace={backspace} onStep={stepRotor} />
				) : (
					<ThreeDMode
						{...shared}
						onBackend={setBackend}
						onPlug={plug}
						onNote={() => setSheet('note')}
						notes={noteLines}
						pendingPlug={pendingPlug}
					/>
				)}
			</main>

			<nav class="toolbar" aria-label="Machine settings">
				<button type="button" class="tool" onClick={() => setSheet('keys')}>
					<IconWheels />
					<span>Set-up</span>
				</button>
				<button type="button" class="tool" onClick={() => setSheet('space')}>
					<IconChart />
					<span>Space</span>
				</button>
				<button type="button" class="tool" onClick={() => setSheet('signal')}>
					<IconSignal />
					<span>Signal</span>
				</button>
				<button type="button" class="tool" onClick={() => setSheet('message')}>
					<IconKeyboard />
					<span>Text</span>
				</button>
			</nav>

			<Sheet open={sheet === 'keys'} title="Key sheet" onClose={() => setSheet(null)}>
				<Controls
					state={state}
					onChange={setState}
					presetIds={PRESET_IDS}
					onReset={() => setState({ ...stateForPreset(state.presetId), input: state.input })}
					onRollKey={() => setState(rollKey(state, Math.floor(Math.random() * 99999) + 1))}
				/>
				{state.presetId === CUSTOM_PRESET_ID ? <Builder state={state} onChange={setState} /> : null}
			</Sheet>

			<Sheet open={sheet === 'space'} title="Key space" onClose={() => setSheet(null)}>
				<KeyspaceExplorer state={state} breakdown={breakdown} total={formatKeyspace(breakdown)} />
			</Sheet>

			<Sheet open={sheet === 'signal'} title="As a signal" onClose={() => setSheet(null)}>
				<label class="field field--row">
					<span>Message key</span>
					<input
						type="text"
						maxLength={3}
						value={messageKey}
						onInput={(event) => setMessageKey((event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, ''))}
					/>
				</label>
				<SignalPanel indicator={run.signal.indicator} body={run.signal.body} messageKey={messageKey} />
			</Sheet>

			<Sheet open={sheet === 'note'} title="Operator's note" onClose={() => setSheet(null)}>
				<label class="field">
					<span>Written on the card beside the machine</span>
					<textarea rows={5} value={notes} onInput={(event) => setNotes((event.target as HTMLTextAreaElement).value.toUpperCase())} />
				</label>
				<p class="io__note">Four lines, fourteen characters each — the card is small, the way the real one was.</p>
			</Sheet>

			<Sheet open={sheet === 'message'} title="Message" onClose={() => setSheet(null)}>
				<label class="field">
					<span>Plain or cipher text</span>
					<textarea
						rows={5}
						value={state.input}
						spellcheck={false}
						autocapitalize="characters"
						placeholder="Type, or use the keys"
						onInput={(event) => setState({ ...state, input: (event.target as HTMLTextAreaElement).value.toUpperCase() })}
					/>
				</label>
				<p class="io__note">
					Enigma is reciprocal: put the cipher text back in with the same settings and start positions and the plain text returns.
					Start <strong>{state.positions}</strong>, window now <strong>{run.window}</strong>.
				</p>
				<button type="button" class="button" onClick={() => setState({ ...state, input: run.output })} disabled={!run.output}>
					Swap input and output
				</button>
			</Sheet>

			<Settings prefs={prefs} onChange={setPrefs} open={settingsOpen} onClose={() => setSettingsOpen(false)} onShowLog={() => setSheet('log')} />

			<Sheet open={sheet === 'log'} title="Console log" onClose={() => setSheet(null)}>
				<pre class="log">
					{readLogs()
						.map((entry) => `${new Date(entry.at).toLocaleTimeString()} ${entry.level.toUpperCase()} ${entry.message}`)
						.join('\n') || 'Nothing captured yet.'}
				</pre>
				<div class="controls__actions">
					<button type="button" class="button" onClick={() => void navigator.clipboard?.writeText(formatLogs())}>
						Copy
					</button>
					<button type="button" class="button button--ghost" onClick={() => clearLogs()}>
						Clear
					</button>
				</div>
			</Sheet>

			<p class="colophon">
				<strong>{mode === '3d' ? backend : 'keys'}</strong> · core v{VERSION}
			</p>
		</div>
	);
}
