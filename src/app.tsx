import { indexToSymbol, PRESETS } from '@enigma-lab/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { detectRenderer, type RendererReport } from './render/webgpu.js';
import { encodeHash, keyspaceFor, machineFor, nextLetter, saveState, stateForPreset, type LabState } from './state/store.js';
import { loadState } from './state/store.js';
import { Controls } from './ui/controls.js';
import { Keyboard } from './ui/keyboard.js';
import { Keyspace } from './ui/keyspace.js';
import { MachineView } from './ui/machine-view.js';

const PRESET_IDS = Object.keys(PRESETS);

export function App() {
	const [state, setState] = useState<LabState>(() => loadState());
	const [renderer, setRenderer] = useState<RendererReport>({ kind: 'svg', reason: 'detecting' });
	const [theme, setTheme] = useState<'dark' | 'light'>(() =>
		globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
	);
	const [lit, setLit] = useState<string | null>(null);
	const [installable, setInstallable] = useState<{ prompt: () => Promise<void> } | null>(null);
	const installEvent = useRef<Event | null>(null);
	const outputRef = useRef<HTMLParagraphElement>(null);

	/** One machine per config: encrypting the input leaves it in a known state. */
	const run = useMemo(() => {
		const machine = machineFor(state);
		const output = machine.encrypt(state.input);
		return {
			output,
			window: machine.window,
			rotors: machine.rotors.map((rotor, index) => ({
				id: rotor.spec.id,
				index,
				window: indexToSymbol(machine.alphabet, rotor.position),
				ring: state.rings[index] ?? 'A',
				atNotch: rotor.atNotch(),
			})),
			reflector: machine.reflector.name,
		};
	}, [state]);

	const breakdown = useMemo(() => keyspaceFor(state), [state]);

	useEffect(() => {
		saveState(state);
		const { pathname, search } = location;
		history.replaceState(null, '', `${pathname}${search}${encodeHash(state)}`);
	}, [state]);

	useEffect(() => {
		void detectRenderer().then(setRenderer);
		document.documentElement.dataset.theme = theme;
	}, [theme]);

	useEffect(() => {
		if (!('serviceWorker' in navigator)) return;
		if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
		navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
			// Offline support is a bonus, never a requirement.
		});
	}, []);

	useEffect(() => {
		const onInstall = (event: Event) => {
			event.preventDefault();
			installEvent.current = event;
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

	const reset = () => setState({ ...stateForPreset(state.presetId) });

	const stepRotor = (index: number) => {
		const chars = [...state.positions];
		chars[index] = nextLetter(chars[index] ?? 'A');
		setState({ ...state, positions: chars.join('') });
	};

	return (
		<div class="app">
			<header class="masthead">
				<div>
					<h1>Enigma Lab</h1>
					<p class="masthead__sub">
						A working machine, not a picture of one. Every key press steps the rotors, crosses the reflector and comes
						back through the plugboard.
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
				<MachineView
					rotors={run.rotors}
					reflectorLabel={run.reflector}
					onSelect={stepRotor}
					label={`Enigma machine with ${run.rotors.length} rotors showing ${run.window}`}
				/>

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
						<p class="output__text" ref={outputRef} aria-live="polite">
							{run.output || '—'}
						</p>
						<button
							type="button"
							class="button button--ghost"
							disabled={!run.output}
							onClick={() => void navigator.clipboard?.writeText(run.output)}
						>
							Copy
						</button>
					</div>
					<p class="io__note">
						Enigma is reciprocal: put the cipher text back in with the same settings and the same start positions and
						the plain text returns. Start positions here: <strong>{state.positions}</strong>, window now{' '}
						<strong>{run.window}</strong>.
					</p>
				</section>

				<Keyboard onKey={press} onBackspace={backspace} lit={lit} />

				<Controls state={state} onChange={setState} presetIds={PRESET_IDS} onReset={reset} />

				<Keyspace breakdown={breakdown} cables={state.plugboard.length} />

				<section class="panel" aria-labelledby="history-heading">
					<h2 id="history-heading">Who actually broke it</h2>
					<p>
						The machine was never defeated by arithmetic. In 1932 the Polish Cipher Bureau handed the problem to three
						young mathematicians from Poznań — Marian Rejewski, Jerzy Różycki and Henryk Zygalski — and Rejewski
						reconstructed the military wiring from intercepted indicators before the end of that year. Różycki's clock
						method and Zygalski's perforated sheets carried the attack forward, and in July 1939 the Poles handed
						everything they had to British and French intelligence.
					</p>
					<p>
						At Bletchley Park, Alan Turing and Gordon Welchman turned that inheritance into the bombe, with Harold
						Keen's engineers at BTM building it. Hut 6 attacked army and air force traffic, Hut 8 the naval traffic.
						The rotors, notches and reflectors in this simulator follow the published measurements of the machines
						themselves.
					</p>
				</section>
			</main>

			<footer class="footer">
				<p>
					Rendering: <strong>{renderer.kind === 'webgpu' ? 'WebGPU' : 'SVG'}</strong> · {renderer.reason}
				</p>
				<p>
					Core maths from <code>@enigma-lab/core</code>. Nothing leaves your device; there is no server to send it to.
				</p>
			</footer>
		</div>
	);
}
