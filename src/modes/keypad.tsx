import { MACHINE_COLOURS } from '../render/scene3d.js';
import { Keyboard } from '../ui/keyboard.js';

export interface KeypadWheel {
	readonly id: string;
	readonly window: string;
	readonly ring: string;
	readonly atNotch: boolean;
}

export interface KeypadProps {
	readonly wheels: readonly KeypadWheel[];
	readonly lit: string | null;
	readonly onPress: (letter: string) => void;
	readonly onBackspace: () => void;
	readonly onStep: (index: number) => void;
}

/**
 * The keys, and the wheels they turn.
 *
 * A calculator does not make you scroll to reach its buttons: the keypad takes
 * the height that is left, the wheels sit above it so you can watch them step,
 * and everything else lives in a sheet.
 */
export function Keypad({ wheels, lit, onPress, onBackspace, onStep }: KeypadProps) {
	return (
		<div class="keypad">
			<div class="wheels" role="group" aria-label="Rotors">
				{wheels.map((wheel, index) => (
					<button
						type="button"
						key={`${wheel.id}-${index}`}
						class={wheel.atNotch ? 'wheel wheel--notch' : 'wheel'}
						style={{ '--wheel': MACHINE_COLOURS.rotors[index % MACHINE_COLOURS.rotors.length] }}
						onClick={() => onStep(index)}
						aria-label={`Rotor ${index + 1}, ${wheel.id}, window ${wheel.window}, ring ${wheel.ring}${wheel.atNotch ? ', on its turnover notch' : ''}`}
					>
						<span class="wheel__letter">{wheel.window}</span>
						<span class="wheel__id">{wheel.id}</span>
					</button>
				))}
			</div>
			<Keyboard onKey={onPress} onBackspace={onBackspace} lit={lit} />
		</div>
	);
}
