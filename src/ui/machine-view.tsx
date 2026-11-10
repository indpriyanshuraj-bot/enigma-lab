import { layoutRotors, project, type Camera } from '@enigma-lab/core/render';
import { machineGeometry } from '../render/theme.js';

export interface RotorFace {
	readonly id: string;
	readonly window: string;
	readonly ring: string;
	readonly atNotch: boolean;
	readonly index: number;
}

export interface MachineViewProps {
	readonly rotors: readonly RotorFace[];
	readonly reflectorLabel: string;
	readonly onSelect?: ((index: number) => void) | undefined;
	readonly label: string;
}

const WIDTH = 360;
const HEIGHT = 260;
const camera: Camera = { yaw: 0.34, pitch: 1.02, zoom: 1, origin: { x: WIDTH / 2, y: HEIGHT / 2 } };

/**
 * Top-down, scalable drawing of the rotor stack.
 *
 * The library supplies projection and layout; the site supplies the look. Every
 * rotor is a real hit target, so the drawing doubles as the machine's controls.
 */
export function MachineView({ rotors, reflectorLabel, onSelect, label }: MachineViewProps) {
	const slots = layoutRotors({
		rotorCount: Math.max(rotors.length, 1),
		radius: machineGeometry.radius,
		thickness: machineGeometry.thickness,
		gap: machineGeometry.gap,
	});
	const near = slots[0];
	const far = slots[slots.length - 1];
	const padding = machineGeometry.casePadding;
	const corners = [near, far]
		.filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
		.flatMap((slot) => [
			project({ x: slot.center.x - slot.radius, y: 0, z: slot.center.z - slot.radius }, camera),
			project({ x: slot.center.x + slot.radius, y: 0, z: slot.center.z + slot.radius }, camera),
		]);
	const minX = Math.min(...corners.map((point) => point.x)) - padding;
	const maxX = Math.max(...corners.map((point) => point.x)) + padding;
	const minY = Math.min(...corners.map((point) => point.y)) - padding;
	const maxY = Math.max(...corners.map((point) => point.y)) + padding;

	return (
		<figure class="machine">
			<svg
				viewBox={`${minX} ${minY} ${Math.max(maxX - minX, 1)} ${Math.max(maxY - minY, 1)}`}
				role="img"
				aria-label={label}
				preserveAspectRatio="xMidYMid meet"
			>
				<rect
					class="machine__case"
					x={minX}
					y={minY}
					width={maxX - minX}
					height={maxY - minY}
					rx={18}
				/>
				<text class="machine__case-label" x={minX + 10} y={minY + 16}>
					{reflectorLabel}
				</text>
				{[...slots].reverse().map((slot) => {
					const rotor = rotors[slot.index];
					if (!rotor) return null;
					const center = project(slot.center, camera);
					const notch = project({ x: slot.center.x, y: 0, z: slot.center.z - slot.radius * 0.92 }, camera);
					return (
						<g
							key={`${rotor.id}-${rotor.index}`}
							class={rotor.atNotch ? 'rotor rotor--notch' : 'rotor'}
							role={onSelect ? 'button' : undefined}
							tabindex={onSelect ? 0 : undefined}
							aria-label={`Rotor ${rotor.index + 1} ${rotor.id}, window ${rotor.window}, ring ${rotor.ring}`}
							onClick={() => onSelect?.(slot.index)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									onSelect?.(slot.index);
								}
							}}
						>
							<circle class="rotor__body" cx={center.x} cy={center.y} r={slot.radius} />
							<circle class="rotor__ring" cx={center.x} cy={center.y} r={slot.radius * 0.62} />
							<circle class="rotor__notch" cx={notch.x} cy={notch.y} r={2.6} />
							<text class="rotor__letter" x={center.x} y={center.y + 1}>
								{rotor.window}
							</text>
							<text class="rotor__meta" x={center.x} y={center.y + slot.radius * 0.78}>
								{rotor.id} · {rotor.ring}
							</text>
						</g>
					);
				})}
			</svg>
			<figcaption>Tap a rotor to step it. The gold dot marks a rotor sitting on its turnover notch.</figcaption>
		</figure>
	);
}
