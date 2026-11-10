import { indexToSymbol, PRESETS, transmit, VERSION } from '@enigma-lab/core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { FormMode } from './modes/form.js';
import { ThreeDMode } from './modes/three-d-mode.js';
import { detectRenderer } from './render/webgpu.js';
import { CUSTOM_PRESET_ID, encodeHash, keyspaceFor, loadState, machineFor, nextLetter, rollKey, saveState, type LabState } from './state/store.js';
import { applyTheme, loadPrefs, savePrefs, type Mode, type Prefs } from './state/prefs.js';
import { Settings } from './ui/settings.js';

const PRESET_IDS = [...Object.keys(PRESETS), CUSTOM_PRESET_ID];

/** Rotor order, rings and start positions, in the shape the procedures want. */
function dailyKey(state: LabState) {
	return { rotorOrder: [...state.rotorOrder], rings: state.rings, positions: state.positions };
}

export function App() {
	const [state, setState] = useState<LabState>(() => loadState());
	const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
	const [renderer, setRenderer] = useState<'webgpu' | 'svg'>('svg');
	const [rendererNote, setRendererNote] = useState('detecting');
	const [lit, setLit] = useState<string | null>(null);
	const [selected, setSelected] = useState<number | null>(null);
	const [lidOpen, setLidOpen] = useState(true);
	const [messageKey, setMessageKey] = useState('QWE');
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [installable, setInstallable] = useState<{ prompt: () => Promise<void> } | null>(null);

	const mode: Mode = prefs.mode;

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
		return { output, window: machine.window, rotors, reflector: machine.reflector.name, signal };
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
	}, [prefs]);

	useEffect(() => {
		void detectRenderer().then((report) => setRendererNote(report.reason));
	}, []);

	useEffect(() => {
		if (!('serviceWorker' in navigator) || !globalThis.isSecureContext) return;
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
			// Letters still reach the machine while the 3D stage has focus; only the
			// stage's own arrow and zoom keys are handled there.
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
		<div class="app">
			<a class="skip-link" href="#main">
				Skip to the machine
			</a>

			<header class="masthead">
				<div class="masthead__brand">
					<span class="masthead__mark" aria-hidden="true">
						<svg viewBox="0 0 32 32" width="28" height="28">
							<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2" />
							<circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6" />
							<circle cx="16" cy="16" r="2" fill="currentColor" />
							<path d="M16 5v3M16 24v3M5 16h3M24 16h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
						</svg>
					</span>
					<div>
						<h1>Enigma Lab</h1>
						<p class="masthead__sub">A working machine, not a picture of one.</p>
					</div>
				</div>

				<nav class="nav" aria-label="Sections">
					<a href="./" aria-current="page">
						Machine
					</a>
					<a href="./about.html">About</a>
					<a href="./facts.html">Fun facts</a>
				</nav>

				<div class="masthead__actions">
					<div class="switch" role="group" aria-label="Interface">
						<button type="button" aria-pressed={mode === 'form'} class={mode === 'form' ? 'switch__option is-on' : 'switch__option'} onClick={() => setPrefs({ ...prefs, mode: 'form' })}>
							Form
						</button>
						<button type="button" aria-pressed={mode === '3d'} class={mode === '3d' ? 'switch__option is-on' : 'switch__option'} onClick={() => setPrefs({ ...prefs, mode: '3d' })}>
							3D
						</button>
					</div>
					{installable ? (
						<button type="button" class="button button--ghost" onClick={() => void installable.prompt()}>
							Install
						</button>
					) : null}
					<button type="button" class="button button--ghost" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
						Settings
					</button>
				</div>
			</header>

			<main id="main">
				{mode === 'form' ? (
					<FormMode
						{...shared}
						presetIds={PRESET_IDS}
						rendererKind={renderer}
						onRendererChange={setRenderer}
						messageKey={messageKey}
						onMessageKey={setMessageKey}
						onRollKey={() => setState(rollKey(state, Math.floor(Math.random() * 99999) + 1))}
					/>
				) : (
					<ThreeDMode {...shared} motion={prefs.motion} />
				)}
			</main>

			<footer class="footer">
				<p>
					<strong>{mode === '3d' ? 'Canvas 3D' : renderer === 'webgpu' ? 'WebGPU' : 'SVG'}</strong> · core v{VERSION} · {rendererNote}
				</p>
				<p>
					Nothing leaves your device; there is no server to send it to. The machine lives in the URL, your preferences stay
					here.
				</p>
			</footer>

			<Settings prefs={prefs} onChange={setPrefs} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
		</div>
	);
}
