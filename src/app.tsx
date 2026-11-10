import { indexToSymbol, PRESETS, transmit, VERSION } from '@enigma-lab/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { detectRenderer } from './render/webgpu.js';
import { machineGeometry } from './render/theme.js';
import { MachineStage } from './render/machine-stage.js';
import {
	CUSTOM_PRESET_ID,
	encodeHash,
	keyspaceFor,
	loadState,
	machineFor,
	nextLetter,
	rollKey,
	saveState,
	stateForPreset,
	type LabState,
} from './state/store.js';
import { Builder, History, KeyspaceExplorer, SignalPanel } from './ui/panels.js';
import { Controls } from './ui/controls.js';
import { Keyboard } from './ui/keyboard.js';

const PRESET_IDS = [...Object.keys(PRESETS), CUSTOM_PRESET_ID];

export function App() {
	const [state, setState] = useState<LabState>(() => loadState());
	const [renderer, setRenderer] = useState<'webgpu' | 'svg'>('svg');
	const [rendererNote, setRendererNote] = useState('detecting');
	const [theme, setTheme] = useState<'dark' | 'light'>(() =>
		globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
	);
	const [lit, setLit] = useState<string | null>(null);
	const [selected, setSelected] = useState<number | null>(null);
	const [lidOpen, setLidOpen] = useState(true);
	const [messageKey, setMessageKey] = useState('QWE');
	const [installable, setInstallable] = useState<{ prompt: () => Promise<void> } | null>(null);

	/** One machine per config: encrypting the input leaves it in a known state. */
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
				const sender = machineFor(state);
				const key = messageKey.padEnd(3, 'A').slice(0, 3);
				const sent = transmit(sender, state.input, { rotorOrder: state.rotorOrder, rings: state.rings, positions: state.positions }, key, {
					reset: true,
				});
				return { indicator: sent.indicator, body: sent.body };
			} catch {
				return { indicator: '', body: '' };
			}
		})();
		return { output, window: machine.window, rotors, reflector: machine.reflector.name, signal };
	}, [state, messageKey]);

	const breakdown = useMemo(() => keyspaceFor(state), [state]);

	useEffect(() => {
		saveState(state);
		const { pathname, search } = location;
		history.replaceState(null, '', `${pathname}${search}${encodeHash(state)}`);
	}, [state]);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);

	useEffect(() => {
		void detectRenderer().then((report) => setRendererNote(report.reason));
	}, []);

	useEffect(() => {
		if (!('serviceWorker' in navigator)) return;
		if (!globalThis.isSecureContext) return;
		navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
			// Offline support is a bonus, never a requirement.
		});
	}, []);

	useEffect(() => {
		const onInstall = (event: Event) => {
			event.preventDefault();
			setInstallable({ prompt: async () => void (await (event as unknown as { prompt(): Promise<void> }).prompt()) });
		};
		globalThis.addEventListener('beforeinstallprompt', onInstall);
		return () => globalThis.removeEventListener('beforeinstallprompt', onInstall);
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

	const swapRotor = (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= state.rotorOrder.length) return;
		const order = [...state.rotorOrder];
		const [moved] = order.splice(index, 1);
		if (!moved) return;
		order.splice(target, 0, moved);
		setSelected(target);
		setState({ ...state, rotorOrder: order });
	};

	const rotorRow = selected === null ? null : (
		<div class="rotor-actions" role="group" aria-label={`Rotor ${selected + 1}`}>
			<span>
				Rotor {selected + 1}: {run.rotors[selected]?.id ?? ''}
			</span>
			<button type="button" class="button button--ghost" onClick={() => stepRotor(selected)}>
				Step
			</button>
			<button type="button" class="button button--ghost" onClick={() => swapRotor(selected, -1)} disabled={selected === 0}>
				←
			</button>
			<button
				type="button"
				class="button button--ghost"
				onClick={() => swapRotor(selected, 1)}
				disabled={selected === state.rotorOrder.length - 1}
			>
				→
			</button>
			<button type="button" class="button button--ghost" onClick={() => setSelected(null)}>
				Done
			</button>
		</div>
	);

	return (
		<div class="app">
			<header class="masthead">
				<div>
					<h1>Enigma Lab</h1>
					<p class="masthead__sub">
						A working machine, not a picture of one. Every key press steps the rotors, crosses the reflector and comes back
						through the plugboard.
					</p>
				</div>
				<div class="masthead__actions">
					{installable ? (
						<button type="button" class="button button--ghost" onClick={() => void installable.prompt()}>
							Install
						</button>
					) : null}
					<button
						type="button"
						class="button button--ghost"
						aria-label="Toggle colour scheme"
						onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
					>
						{theme === 'dark' ? 'Light' : 'Dark'}
					</button>
				</div>
			</header>

			<main>
				<MachineStage
					rotors={run.rotors}
					reflectorLabel={run.reflector}
					geometry={machineGeometry}
					onSelectRotor={stepRotor}
					selected={selected}
					lidOpen={lidOpen}
					onToggleLid={() => setLidOpen(!lidOpen)}
					rendererKind={renderer}
					onRendererChange={setRenderer}
				/>
				{rotorRow}

				<section class="panel panel--io" aria-labelledby="io-heading">
					<h2 id="io-heading">Message</h2>
					<label class="field">
						<span>Plain or cipher text</span>
						<textarea
							rows={3}
							value={state.input}
							spellcheck={false}
							autocapitalize="characters"
							onInput={(event) => setState({ ...state, input: (event.target as HTMLTextAreaElement).value.toUpperCase() })}
						/>
					</label>
					<div class="output">
						<span class="output__label">Lampboard</span>
						<p class="output__text" aria-live="polite">
							{run.output || '—'}
						</p>
						<button type="button" class="button button--ghost" disabled={!run.output} onClick={() => void navigator.clipboard?.writeText(run.output)}>
							Copy
						</button>
					</div>
					<p class="io__note">
						Enigma is reciprocal: put the cipher text back in with the same settings and start positions and the plain text
						returns. Start positions <strong>{state.positions}</strong>, window now <strong>{run.window}</strong>.
					</p>
				</section>

				<Keyboard onKey={press} onBackspace={backspace} lit={lit} />

				<Controls
					state={state}
					onChange={setState}
					presetIds={PRESET_IDS}
					onReset={() => setState({ ...stateForPreset(state.presetId) })}
					onRollKey={() => setState(rollKey(state, Math.floor(Math.random() * 99999) + 1))}
				/>

				{state.presetId === CUSTOM_PRESET_ID ? <Builder state={state} onChange={setState} /> : null}

				<section class="panel" aria-labelledby="signal-heading">
					<h2 id="signal-heading">As a signal</h2>
					<label class="field">
						<span>Message key</span>
						<input
							type="text"
							maxLength={3}
							value={messageKey}
							onInput={(event) => setMessageKey((event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, ''))}
						/>
					</label>
					<SignalPanel indicator={run.signal.indicator} body={run.signal.body} messageKey={messageKey} />
				</section>

				<KeyspaceExplorer state={state} />

				<History />
			</main>

			<footer class="footer">
				<p>
					Rendering: <strong>{renderer === 'webgpu' ? 'WebGPU' : 'SVG'}</strong> · {rendererNote} · core v{VERSION}
				</p>
				<p>
					Nothing leaves your device; there is no server to send it to. Settings live in <code>localStorage</code> and in the
					URL hash.
				</p>
			</footer>
		</div>
	);
}
