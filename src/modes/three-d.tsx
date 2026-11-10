import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
	buildScene3D,
	hitTest3d,
	MACHINE_COLOURS,
	paintLabels,
	renderTriangles,
	type Hotspot,
	type OrbitCamera,
} from '../render/scene3d.js';
import { createSurface, type Surface } from '../render/surface.js';

export interface ThreeDProps {
	readonly windows: readonly string[];
	readonly rings: readonly string[];
	readonly ids: readonly string[];
	readonly reflector: string;
	readonly alphabet: string;
	readonly lidOpen: boolean;
	readonly lit: string | null;
	readonly plugged: readonly string[];
	readonly motion: boolean;
	readonly preference: 'auto' | 'webgpu' | 'webgl' | 'canvas';
	readonly onToggleLid: () => void;
	readonly onRotor: (index: number) => void;
	readonly onKey: (letter: string) => void;
	readonly onPlug: (letter: string) => void;
	readonly onBackend: (backend: string) => void;
}

const START: OrbitCamera = { yaw: -0.5, pitch: 0.5, distance: 400, focal: 640, target: { x: 0, y: -60, z: 0 } };
const PITCH_MIN = 0.08;
const PITCH_MAX = 1.4;

/**
 * The whole machine, in three dimensions.
 *
 * Geometry goes through the shared triangle pipeline — WebGPU, then WebGL2, then
 * a 2D canvas — and every label is drawn on a 2D overlay, so text stays crisp
 * whatever rasterises the faces. Keys are live: tapping one sends a letter.
 */
export function ThreeD(props: ThreeDProps) {
	const { windows, rings, ids, reflector, alphabet, lidOpen, lit, plugged, motion, preference } = props;
	const surfaceRef = useRef<Surface | null>(null);
	// Bumped when the surface finishes initialising, so the first frame is drawn.
	const [surfaceReady, setSurfaceReady] = useState(0);
	const geometryRef = useRef<HTMLCanvasElement>(null);
	const overlayRef = useRef<HTMLCanvasElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const [camera, setCamera] = useState<OrbitCamera>(START);
	const target = useRef<OrbitCamera>(START);
	const frame = useRef<number | null>(null);
	const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: number } | null>(null);

	const scene = useMemo(
		() => buildScene3D({ rotorCount: windows.length, windows, rings, ids, reflector, lidOpen, alphabet, lit, plugged }, MACHINE_COLOURS),
		[windows, rings, ids, reflector, lidOpen, alphabet, lit, plugged],
	);

	// One surface for the life of the view.
	useEffect(() => {
		let cancelled = false;
		const canvas = geometryRef.current;
		if (!canvas) return;
		void createSurface(canvas, preference).then((surface) => {
			if (cancelled) {
				surface.dispose();
				return;
			}
			surfaceRef.current = surface;
			setSurfaceReady((value) => value + 1);
			props.onBackend(`${surface.backend}: ${surface.reason}`);
		});
		return () => {
			cancelled = true;
			surfaceRef.current?.dispose();
			surfaceRef.current = null;
		};
		// Re-creating the surface on a preference change is deliberate: it is the
		// only way to honour "draw on the canvas, not the GPU".
	}, [preference]);

	const draw = useCallback(
		(active: OrbitCamera) => {
			const host = hostRef.current;
			const overlay = overlayRef.current;
			if (!host || !overlay) return;
			const rect = host.getBoundingClientRect();
			const width = Math.max(rect.width, 1);
			const height = Math.max(rect.height, 1);
			const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);

			const surface = surfaceRef.current;
			if (surface) {
				surface.resize(width, height, ratio);
				surface.draw(renderTriangles(scene.faces, active, width, height));
			}

			const context = overlay.getContext('2d');
			if (!context) return;
			overlay.width = Math.max(1, Math.round(width * ratio));
			overlay.height = Math.max(1, Math.round(height * ratio));
			paintLabels(context, scene, active, width, height, ratio);
		},
		[scene],
	);

	// Ease towards the target camera; snap when motion is off.
	useEffect(() => {
		const step = () => {
			setCamera((current) => {
				const goal = target.current;
				if (!motion) return goal;
				const ease = 0.24;
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
	}, [draw, camera, surfaceReady]);

	// A phone-shaped stage needs a longer lens: the machine is wide, the screen is
	// tall, so the camera steps back instead of cropping the rotors.
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const fit = () => {
			const rect = host.getBoundingClientRect();
			const aspect = rect.width / Math.max(rect.height, 1);
			const wanted = aspect < 1.1 ? 700 : aspect < 1.5 ? 540 : aspect < 2 ? 430 : 380;
			if (Math.abs(target.current.distance - wanted) > 1) {
				target.current = { ...target.current, distance: wanted };
				if (!motion) setCamera(target.current);
			}
			draw(camera);
		};
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(host);
		return () => observer.disconnect();
	}, [draw, camera, motion]);

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
		target.current = { ...goal, distance: Math.min(900, Math.max(150, goal.distance * factor)) };
		if (!motion) setCamera(target.current);
	};

	const activate = (hit: Hotspot | null) => {
		if (!hit) return;
		if (hit.kind === 'rotor') props.onRotor(hit.index);
		else if (hit.kind === 'key') props.onKey(hit.letter);
		else props.onPlug(hit.letter);
	};

	return (
		<figure class="machine machine--3d">
			<div
				class="machine__stage machine__stage--3d"
				ref={hostRef}
				tabindex={0}
				role="application"
				aria-label={`Enigma machine in three dimensions, showing ${windows.join('')}. Arrow keys turn it, plus and minus zoom, letters type.`}
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
					activate(hitTest3d({ x: event.clientX - rect.left, y: event.clientY - rect.top }, scene, camera, rect.width, rect.height));
				}}
				onWheel={(event) => {
					event.preventDefault();
					zoom(event.deltaY > 0 ? 1.08 : 0.92);
				}}
				onKeyDown={(event) => {
					if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(event.key)) return;
					event.preventDefault();
					if (event.key === 'ArrowLeft') orbit(-0.14, 0);
					else if (event.key === 'ArrowRight') orbit(0.14, 0);
					else if (event.key === 'ArrowUp') orbit(0, -0.1);
					else if (event.key === 'ArrowDown') orbit(0, 0.1);
					else if (event.key === '+' || event.key === '=') zoom(0.9);
					else zoom(1.1);
				}}
			>
				<canvas ref={geometryRef} class="machine__gpu" aria-hidden="true" />
				<canvas ref={overlayRef} class="machine__overlay" aria-hidden="true" />
				{!lidOpen ? (
					<button type="button" class="machine__lid-hint" onClick={props.onToggleLid}>
						Lift the lid
					</button>
				) : null}
			</div>
			<figcaption class="machine__caption">
				<span>Drag to turn · scroll to zoom · tap a key, a rotor or a socket</span>
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
