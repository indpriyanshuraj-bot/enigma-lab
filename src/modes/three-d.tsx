import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
	buildMachine3d,
	hitTest3d,
	paint3d,
	type Machine3DOptions,
	type OrbitCamera,
} from '../render/scene3d.js';
import { parseColour } from '../render/webgpu-machine.js';

export interface ThreeDProps {
	readonly windows: readonly string[];
	readonly rings: readonly string[];
	readonly ids: readonly string[];
	readonly reflector: string;
	readonly lidOpen: boolean;
	readonly onToggleLid: () => void;
	readonly onSelectRotor: (index: number) => void;
	readonly selected: number | null;
	readonly motion: boolean;
}

const START: OrbitCamera = { yaw: -0.62, pitch: 0.5, distance: 250, focal: 520, target: { x: 0, y: -6, z: 0 } };
const PITCH_MIN = 0.12;
const PITCH_MAX = 1.35;

function readColours(): { rotor: string; rotorRing: string; case: string; ink: string; accent: string } {
	const style = getComputedStyle(document.documentElement);
	const read = (name: string, fallback: string): string => {
		const value = style.getPropertyValue(name).trim();
		return parseColour(value) ? value : fallback;
	};
	return {
		rotor: read('--rotor', '#22303e'),
		rotorRing: read('--rotor-ring', '#2b3b4c'),
		case: read('--case', '#1a232e'),
		ink: read('--ink', '#e6edf3'),
		accent: read('--accent', '#d6a94a'),
	};
}

/**
 * The machine as an object you can turn over.
 *
 * Drawn on a 2D canvas by a painter's algorithm, so it works everywhere. The
 * camera eases towards where the pointer puts it; with motion switched off it
 * snaps, and nothing moves unless you move it.
 */
export function ThreeD(props: ThreeDProps) {
	const { windows, rings, ids, reflector, lidOpen, onToggleLid, onSelectRotor, selected, motion } = props;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const [camera, setCamera] = useState<OrbitCamera>(START);
	const target = useRef<OrbitCamera>(START);
	const frame = useRef<number | null>(null);
	const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: number } | null>(null);

	const options = useMemo<Machine3DOptions>(
		() => ({
			rotorCount: Math.max(windows.length, 1),
			radius: 46,
			length: 26,
			gap: 6,
			reflectorThickness: 10,
			reflectorGap: 8,
			case: 7,
			lidOpen,
		}),
		[windows.length, lidOpen],
	);

	const draw = useCallback(
		(active: OrbitCamera) => {
			const canvas = canvasRef.current;
			const host = hostRef.current;
			if (!canvas || !host) return;
			const rect = host.getBoundingClientRect();
			const width = Math.max(rect.width, 1);
			const height = Math.max(rect.height, 1);
			const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
			if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
				canvas.width = Math.round(width * ratio);
				canvas.height = Math.round(height * ratio);
			}
			const context = canvas.getContext('2d');
			if (!context) return;
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			const faces = buildMachine3d(options, { windows, rings, ids, reflector }, readColours());
			paint3d(context, faces, active, width, height);
		},
		[options, windows, rings, ids, reflector],
	);

	useEffect(() => {
		const step = () => {
			setCamera((current) => {
				const goal = target.current;
				if (!motion) return goal;
				const ease = 0.22;
				const next: OrbitCamera = {
					...goal,
					yaw: current.yaw + (goal.yaw - current.yaw) * ease,
					pitch: current.pitch + (goal.pitch - current.pitch) * ease,
					distance: current.distance + (goal.distance - current.distance) * ease,
				};
				const settled =
					Math.abs(next.yaw - goal.yaw) < 0.001 &&
					Math.abs(next.pitch - goal.pitch) < 0.001 &&
					Math.abs(next.distance - goal.distance) < 0.4;
				return settled ? goal : next;
			});
			frame.current = requestAnimationFrame(step);
		};
		frame.current = requestAnimationFrame(step);
		return () => {
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			frame.current = null;
		};
	}, [motion]);

	useEffect(() => {
		draw(camera);
	}, [draw, camera, selected]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const observer = new ResizeObserver(() => draw(camera));
		observer.observe(host);
		return () => observer.disconnect();
	}, [draw, camera]);

	const orbit = (deltaYaw: number, deltaPitch: number) => {
		const goal = target.current;
		target.current = {
			...goal,
			yaw: goal.yaw + deltaYaw,
			pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, goal.pitch + deltaPitch)),
		};
		if (!motion) setCamera(target.current);
	};

	const zoom = (factor: number) => {
		const goal = target.current;
		target.current = { ...goal, distance: Math.min(900, Math.max(140, goal.distance * factor)) };
		if (!motion) setCamera(target.current);
	};

	return (
		<figure class="machine machine--3d">
			<div
				class="machine__stage machine__stage--3d"
				ref={hostRef}
				tabindex={0}
				role="application"
				aria-label={`Enigma machine in three dimensions, showing ${windows.join('')}. Arrow keys turn it, plus and minus zoom, Enter works the selected rotor.`}
				onPointerDown={(event) => {
					(event.currentTarget as Element).setPointerCapture?.(event.pointerId);
					drag.current = { x: event.clientX, y: event.clientY, yaw: target.current.yaw, pitch: target.current.pitch, moved: 0 };
				}}
				onPointerMove={(event) => {
					const current = drag.current;
					if (!current) return;
					const dx = event.clientX - current.x;
					const dy = event.clientY - current.y;
					current.moved = Math.max(current.moved, Math.abs(dx) + Math.abs(dy));
					if (current.moved < 5) return;
					target.current = {
						...target.current,
						yaw: current.yaw - dx * 0.008,
						pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, current.pitch + dy * 0.006)),
					};
					if (!motion) setCamera(target.current);
				}}
				onPointerUp={(event) => {
					const current = drag.current;
					drag.current = null;
					if (!current || current.moved >= 5) return;
					const host = hostRef.current;
					if (!host) return;
					const rect = host.getBoundingClientRect();
					const hit = hitTest3d(
						{ x: event.clientX - rect.left, y: event.clientY - rect.top },
						options,
						camera,
						rect.width,
						rect.height,
					);
					if (hit !== null) onSelectRotor(hit);
				}}
				onWheel={(event) => {
					event.preventDefault();
					zoom(event.deltaY > 0 ? 1.08 : 0.92);
				}}
				onKeyDown={(event) => {
					const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'];
					if (!handled.includes(event.key)) return;
					event.preventDefault();
					if (event.key === 'ArrowLeft') orbit(-0.14, 0);
					else if (event.key === 'ArrowRight') orbit(0.14, 0);
					else if (event.key === 'ArrowUp') orbit(0, -0.1);
					else if (event.key === 'ArrowDown') orbit(0, 0.1);
					else if (event.key === '+' || event.key === '=') zoom(0.9);
					else zoom(1.1);
				}}
			>
				<canvas ref={canvasRef} class="machine__canvas3d" />
				{lidOpen ? null : (
					<button type="button" class="machine__lid-hint" onClick={onToggleLid}>
						Lift the lid
					</button>
				)}
			</div>
			<figcaption class="machine__caption">
				<span>Drag to turn, scroll to zoom, tap a rotor to work it.</span>
				<span class="machine__camera-actions">
					<button type="button" class="button button--ghost" onClick={() => orbit(-0.3, 0)} aria-label="Turn left">
						↺
					</button>
					<button type="button" class="button button--ghost" onClick={() => orbit(0.3, 0)} aria-label="Turn right">
						↻
					</button>
					<button type="button" class="button button--ghost" onClick={() => zoom(0.85)} aria-label="Zoom in">
						+
					</button>
					<button type="button" class="button button--ghost" onClick={() => zoom(1.15)} aria-label="Zoom out">
						−
					</button>
					<button
						type="button"
						class="button button--ghost"
						onClick={() => {
							target.current = START;
							if (!motion) setCamera(START);
						}}
					>
						Reset view
					</button>
				</span>
			</figcaption>
		</figure>
	);
}
