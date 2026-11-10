import { getPreset } from '@enigma-lab/core';
import { formatPlugboard, nextLetter, parsePlugboard, stateForPreset, type LabState } from '../state/store.js';

export interface ControlsProps {
	readonly state: LabState;
	readonly onChange: (next: LabState) => void;
	readonly presetIds: readonly string[];
	readonly onReset: () => void;
}

/** Every setting an operator would have read off a daily key sheet. */
export function Controls({ state, onChange, presetIds, onReset }: ControlsProps) {
	const preset = getPreset(state.presetId);
	const letters = [...state.rotorOrder];

	const setRotor = (index: number, rotorId: string) => {
		const order = [...state.rotorOrder];
		order[index] = rotorId;
		onChange({ ...state, rotorOrder: order });
	};

	const shift = (field: 'rings' | 'positions', index: number, delta: number) => {
		const chars = [...state[field]];
		chars[index] = nextLetter(chars[index] ?? 'A', delta);
		onChange({ ...state, [field]: chars.join('') });
	};

	return (
		<section class="panel" aria-labelledby="settings-heading">
			<h2 id="settings-heading">Settings</h2>

			<label class="field">
				<span>Machine</span>
				<select
					value={state.presetId}
					onChange={(event) => {
						const next = (event.target as HTMLSelectElement).value;
						onChange({ ...stateForPreset(next), input: state.input });
					}}
				>
					{presetIds.map((id) => (
						<option key={id} value={id}>
							{getPreset(id).name}
						</option>
					))}
				</select>
			</label>

			<div class="rotors">
				{letters.map((rotorId, index) => (
					<div class="rotor-row" key={`slot-${index}`}>
						<label class="field field--tight">
							<span>Slot {index + 1}</span>
							<select value={rotorId} onChange={(event) => setRotor(index, (event.target as HTMLSelectElement).value)}>
								{preset.rotorPool.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
							</select>
						</label>
						<div class="stepper">
							<span>Ring</span>
							<button type="button" onClick={() => shift('rings', index, -1)} aria-label={`Ring of slot ${index + 1} back`}>
								−
							</button>
							<output>{state.rings[index] ?? 'A'}</output>
							<button type="button" onClick={() => shift('rings', index, 1)} aria-label={`Ring of slot ${index + 1} forward`}>
								+
							</button>
						</div>
						<div class="stepper">
							<span>Window</span>
							<button type="button" onClick={() => shift('positions', index, -1)} aria-label={`Window of slot ${index + 1} back`}>
								−
							</button>
							<output>{state.positions[index] ?? 'A'}</output>
							<button type="button" onClick={() => shift('positions', index, 1)} aria-label={`Window of slot ${index + 1} forward`}>
								+
							</button>
						</div>
					</div>
				))}
			</div>

			<label class="field">
				<span>Plugboard</span>
				<input
					type="text"
					inputmode="latin"
					autocapitalize="characters"
					spellcheck={false}
					placeholder="AM FI NV"
					value={formatPlugboard(state.plugboard)}
					onInput={(event) => onChange({ ...state, plugboard: parsePlugboard((event.target as HTMLInputElement).value) })}
				/>
				<small>{state.plugboard.length} of 13 possible cables</small>
			</label>

			<button type="button" class="button" onClick={onReset}>
				Reset to {preset.name}
			</button>
		</section>
	);
}
