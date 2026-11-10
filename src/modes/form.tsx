import { formatKeyspace, type KeyspaceBreakdown } from '@enigma-lab/core';
import type { MachineGeometry, SceneRotor } from '@enigma-lab/core/render';
import { machineGeometry } from '../render/theme.js';
import { MachineStage } from '../render/machine-stage.js';
import { CUSTOM_PRESET_ID, stateForPreset, type LabState } from '../state/store.js';
import { Builder, KeyspaceExplorer, SignalPanel } from '../ui/panels.js';
import { Controls } from '../ui/controls.js';
import { Keyboard } from '../ui/keyboard.js';

export interface FormModeProps {
	readonly state: LabState;
	readonly onChange: (next: LabState) => void;
	readonly run: {
		readonly output: string;
		readonly window: string;
		readonly rotors: readonly SceneRotor[];
		readonly reflector: string;
		readonly signal: { readonly indicator: string; readonly body: string };
	};
	readonly breakdown: KeyspaceBreakdown;
	readonly presetIds: readonly string[];
	readonly preference: 'auto' | 'webgpu' | 'webgl' | 'canvas';
	readonly onBackend: (backend: string) => void;
	readonly selected: number | null;
	readonly onSelectRotor: (index: number) => void;
	readonly lidOpen: boolean;
	readonly onToggleLid: () => void;
	readonly messageKey: string;
	readonly onMessageKey: (value: string) => void;
	readonly lit: string | null;
	readonly onPress: (letter: string) => void;
	readonly onBackspace: () => void;
	readonly onRollKey: () => void;
	readonly geometry?: MachineGeometry | undefined;
}

/**
 * The form interface: every setting as a control, with the top-down machine
 * above it. It is the same machine as the 3D view — same state, same output —
 * and it is the one that works best with a keyboard and a screen reader.
 */
export function FormMode(props: FormModeProps) {
	const { state, onChange, run, breakdown, presetIds, selected, onSelectRotor, lidOpen, onToggleLid } = props;
	return (
		<>
			<MachineStage
				rotors={run.rotors}
				reflectorLabel={run.reflector}
				geometry={props.geometry ?? machineGeometry}
				onSelectRotor={onSelectRotor}
				selected={selected}
				lidOpen={lidOpen}
				onToggleLid={onToggleLid}
				preference={props.preference}
				onBackend={props.onBackend}
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
						placeholder="Type, or use the keyboard below"
						onInput={(event) => onChange({ ...state, input: (event.target as HTMLTextAreaElement).value.toUpperCase() })}
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
					Enigma is reciprocal: put the cipher text back in with the same settings and start positions and the plain text returns.
					Start <strong>{state.positions}</strong>, window now <strong>{run.window}</strong>.
				</p>
			</section>

			<Keyboard onKey={props.onPress} onBackspace={props.onBackspace} lit={props.lit} />

			<Controls
				state={state}
				onChange={onChange}
				presetIds={presetIds}
				onReset={() => onChange({ ...stateForPreset(state.presetId), input: state.input })}
				onRollKey={props.onRollKey}
			/>

			{state.presetId === CUSTOM_PRESET_ID ? <Builder state={state} onChange={onChange} /> : null}

			<section class="panel" aria-labelledby="signal-heading">
				<h2 id="signal-heading">As a signal</h2>
				<label class="field field--row">
					<span>Message key</span>
					<input
						type="text"
						maxLength={3}
						value={props.messageKey}
						onInput={(event) => props.onMessageKey((event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, ''))}
					/>
				</label>
				<SignalPanel indicator={run.signal.indicator} body={run.signal.body} messageKey={props.messageKey} />
			</section>

			<KeyspaceExplorer state={state} breakdown={breakdown} total={formatKeyspace(breakdown)} />
		</>
	);
}
