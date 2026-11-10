import { formatKeyspace, type KeyspaceBreakdown } from '@enigma-lab/core';
import type { SceneRotor } from '@enigma-lab/core/render';
import type { LabState } from '../state/store.js';
import { Keyboard } from '../ui/keyboard.js';
import { ThreeD } from './three-d.js';

export interface ThreeDModeProps {
	readonly state: LabState;
	readonly onChange: (next: LabState) => void;
	readonly run: {
		readonly output: string;
		readonly window: string;
		readonly rotors: readonly SceneRotor[];
		readonly reflector: string;
		readonly alphabet: string;
	};
	readonly breakdown: KeyspaceBreakdown;
	readonly selected: number | null;
	readonly onSelectRotor: (index: number) => void;
	readonly lidOpen: boolean;
	readonly onToggleLid: () => void;
	readonly motion: boolean;
	readonly lit: string | null;
	readonly onPress: (letter: string) => void;
	readonly onBackspace: () => void;
	readonly onPlug: (letter: string) => void;
	readonly preference: 'auto' | 'webgpu' | 'webgl' | 'canvas';
	readonly onBackend: (backend: string) => void;
	readonly pendingPlug: string | null;
}

/**
 * The 3D interface: the whole machine, as one object.
 *
 * Keys, rotors and plugboard sockets are live in the model; the readouts stay in
 * HTML, so the result is always selectable, copyable and announced.
 */
export function ThreeDMode(props: ThreeDModeProps) {
	const { state, run, selected } = props;
	const plugged = state.plugboard.flat();
	return (
		<>
			<ThreeD
				windows={run.rotors.map((rotor) => rotor.window)}
				rings={run.rotors.map((rotor) => rotor.ring)}
				ids={run.rotors.map((rotor) => rotor.id)}
				reflector={run.reflector}
				alphabet={run.alphabet}
				lidOpen={props.lidOpen}
				lit={props.lit}
				plugged={plugged}
				motion={props.motion}
				preference={props.preference}
				onToggleLid={props.onToggleLid}
				onRotor={props.onSelectRotor}
				onKey={props.onPress}
				onPlug={props.onPlug}
				onBackend={props.onBackend}
			/>

			<div class="readout" aria-live="polite">
				<div class="readout__cell">
					<span class="readout__label">Window</span>
					<strong class="readout__value readout__value--wide">{run.window}</strong>
				</div>
				<div class="readout__cell">
					<span class="readout__label">Lampboard</span>
					<strong class="readout__value readout__value--wide">{run.output || '—'}</strong>
				</div>
				<div class="readout__cell">
					<span class="readout__label">Key space</span>
					<strong class="readout__value">{formatKeyspace(props.breakdown)}</strong>
					<small>{props.breakdown.bits.toFixed(1)} bits</small>
				</div>
			</div>

			{props.pendingPlug ? (
				<p class="hint" role="status">
					Plug <strong>{props.pendingPlug}</strong> into another socket — or tap it again to cancel.
				</p>
			) : null}

			{selected !== null ? (
				<div class="rotor-actions" role="group" aria-label={`Rotor ${selected + 1}`}>
					<span>
						Rotor {selected + 1}: {run.rotors[selected]?.id ?? ''} · ring {run.rotors[selected]?.ring ?? 'A'}
					</span>
					<button type="button" class="button button--ghost" onClick={() => props.onSelectRotor(selected)}>
						Step
					</button>
					<button
						type="button"
						class="button button--ghost"
						onClick={() => {
							const order = [...state.rotorOrder];
							const [moved] = order.splice(selected, 1);
							if (!moved) return;
							order.splice(Math.max(selected - 1, 0), 0, moved);
							props.onChange({ ...state, rotorOrder: order });
						}}
						disabled={selected === 0}
						aria-label="Move this rotor left"
					>
						←
					</button>
					<button
						type="button"
						class="button button--ghost"
						onClick={() => {
							const order = [...state.rotorOrder];
							const [moved] = order.splice(selected, 1);
							if (!moved) return;
							order.splice(Math.min(selected + 1, order.length), 0, moved);
							props.onChange({ ...state, rotorOrder: order });
						}}
						disabled={selected === state.rotorOrder.length - 1}
						aria-label="Move this rotor right"
					>
						→
					</button>
				</div>
			) : (
				<p class="hint">Tap a rotor to work it, a key to send a letter, a socket to plug a cable.</p>
			)}

			<Keyboard onKey={props.onPress} onBackspace={props.onBackspace} lit={props.lit} />
		</>
	);
}
