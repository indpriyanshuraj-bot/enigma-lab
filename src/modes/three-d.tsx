import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
	buildScene3D,
	hitTest3d,
	MACHINE_COLOURS,
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
	readonly notes: readonly string[];
	readonly motion: boolean;
	readonly preference: 'auto' | 'webgpu' | 'webgl' | 'svg';
	readonly onToggleLid: () => void;
	readonly onRotor: (index: number) => void;
	readonly onKey: (letter: string) => void;
	readonly onPlug: (letter: string) => void;
	readonly onNote: () => void;
	readonly onBackend: (backend: string) => void;
}

const PITCH_MIN = 0.08;
const PITCH_MAX = 1.4;
const START: OrbitCamera = { yaw: -0.5, pitch: 0.5, distance: 420, focal: 640, target: { x: 0, y: -46, z: 0 } };

/**
 * The machine, as an object you can pick up.
 *
 * Geometry goes through the shared triangle pipeline — WebGPU, then WebGL2, then
 * WebGL1, then SVG — and the text is part of that geometry, so nothing is painted
 * over the model and nothing drifts out of register. The camera keeps two numbers
 * apart: the distance that fits the machine to the screen, and the zoom the
 * operator asked for. A rotation of the phone changes the first, never the second.
 */
export function ThreeD(props: ThreeDProps) {
	const { windows, rings, ids, reflector, alphabet, lidOpen, lit, plugged, notes, motion, preference } = props;
	const surfaceRef = useRef<Surface | null>(null);
	const geometryRef = useRef<HTMLCanvasElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const [surfaceReady, setSurfaceReady] = useState(0);
	const [camera, setCamera] = useState<OrbitCamera>(START);
	const [zoom, setZoom] = useState(1);
	const [fullscreen, setFullscreen] = useState(false);
	const fit = useRef(420);
	const target = useRef<OrbitCamera>(START);
	const frame = useRef<number | null>(null);
	const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: number } | null>(null);

	const scene = useMemo(
		() => buildScene3D({ rotorCount: windows.length, windows, rings, ids, reflector, lidOpen, alphabet, lit, plugged, notes }, MACHINE_COLOURS),
		[windows, rings, ids, reflector, lidOpen, alphabet, lit, plugged, notes],
	);

	// Look at the middle of the machine, whatever the machine is.
	useEffect(() => {
		target.current = { ...target.current, target: scene.bounds.centre };
		if (!motion) setCamera(target.current);
	}, [scene, motion]);

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
	}, [preference]);

	const draw = useCallback(
		(active: OrbitCamera) => {
			const host = hostRef.current;
			const surface = surfaceRef.current;
			if (!host || !surface) return;
			const rect = host.getBoundingClientRect();
			const width = Math.max(rect.width, 1);
			const height = Math.max(rect.height, 1);
			surface.resize(width, height, Math.min(globalThis.devicePixelRatio || 1, 2));
			surface.draw(renderTriangles(scene.faces, active, width, height));
		},
		[scene],
	);

	/** The camera that fits the machine to the current stage, times the user's zoom. */
	const applied = useCallback(
		(base: OrbitCamera): OrbitCamera => ({ ...base, distance: fit.current / zoom }),
		[zoom],
	);

	useEffect(() => {
		target.current = applied(target.current);
		setCamera((current) => ({ ...applied(current) }));
	}, [zoom, applied]);

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

	// Fit on first layout and on every rotation: the machine is wide, the screen
	// changes shape, and the camera has to step back — without touching the zoom.
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const measure = () => {
			const rect = host.getBoundingClientRect();
			const shortest = Math.max(Math.min(rect.width, rect.height), 1);
			// Fit the bounding sphere of the machine, not a guessed number: the
			// frame then holds whatever the scene contains, at any window size.
			fit.current = Math.max(320, (scene.bounds.radius * 2.15 * 640) / shortest);
			target.current = { ...target.current, distance: fit.current / zoom };
			if (!motion) setCamera(target.current);
			draw(camera);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(host);
		globalThis.addEventListener('orientationchange', measure);
		return () => {
			observer.disconnect();
			globalThis.removeEventListener('orientationchange', measure);
		};
	}, [draw, camera, motion, zoom, scene]);

	useEffect(() => {
		const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	}, []);

	const orbit = (deltaYaw: number, deltaPitch: number) => {
		target.current = {
			...target.current,
			yaw: target.current.yaw + deltaYaw,
			pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, target.current.pitch + deltaPitch)),
		};
		if (!motion) setCamera(target.current);
	};

	const zoomBy = (factor: number) => setZoom((value) => Math.min(3, Math.max(0.45, value * factor)));

	const resetView = () => {
		setZoom(1);
		target.current = { ...START, distance: fit.current };
		if (!motion) setCamera(target.current);
	};

	const openPlugboard = () => {
		setZoom(1);
		target.current = {
			...target.current,
			target: scene.plugboardFocus.target,
			distance: scene.plugboardFocus.distance,
			pitch: 0.85,
		};
		fit.current = scene.plugboardFocus.distance;
		if (!motion) setCamera(target.current);
	};

	const toggleFullscreen = async () => {
		const host = hostRef.current;
		if (!host) return;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await host.requestFullscreen();
		} catch {
			// Some browsers refuse without a gesture of their own; the button stays put.
		}
	};

	const activate = (hit: Hotspot | null) => {
		if (!hit) return;
		if (hit.kind === 'rotor') props.onRotor(hit.index);
		else if (hit.kind === 'key') props.onKey(hit.letter);
		else if (hit.kind === 'plug') props.onPlug(hit.letter);
		else props.onNote();
	};

	return (
		<figure class="machine machine--3d">
			<div
				class={fullscreen ? 'machine__stage machine__stage--3d is-fullscreen' : 'machine__stage machine__stage--3d'}
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
					zoomBy(event.deltaY > 0 ? 0.92 : 1.08);
				}}
				onKeyDown={(event) => {
					if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(event.key)) return;
					event.preventDefault();
					if (event.key === 'ArrowLeft') orbit(-0.14, 0);
					else if (event.key === 'ArrowRight') orbit(0.14, 0);
					else if (event.key === 'ArrowUp') orbit(0, -0.1);
					else if (event.key === 'ArrowDown') orbit(0, 0.1);
					else if (event.key === '+' || event.key === '=') zoomBy(1.1);
					else zoomBy(0.9);
				}}
			>
				<canvas ref={geometryRef} class="machine__gpu" aria-hidden="true" />
				{!lidOpen ? (
					<button type="button" class="machine__lid-hint" onClick={props.onToggleLid}>
						Lift the lid
					</button>
				) : null}
			</div>
			<figcaption class="machine__caption">
				<span class="machine__camera-actions">
					<button type="button" class="button button--ghost" onClick={() => orbit(-0.3, 0)} aria-label="Turn left">
						↺
					</button>
					<button type="button" class="button button--ghost" onClick={() => orbit(0.3, 0)} aria-label="Turn right">
						↻
					</button>
					<button type="button" class="button button--ghost" onClick={() => zoomBy(0.85)} aria-label="Zoom in">
						+
					</button>
					<button type="button" class="button button--ghost" onClick={() => zoomBy(1.18)} aria-label="Zoom out">
						−
					</button>
					<button type="button" class="button button--ghost" onClick={openPlugboard} aria-label="Open the plugboard">
						Plugs
					</button>
					<button type="button" class="button button--ghost" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Leave full screen' : 'Full screen'}>
						{fullscreen ? '⤢' : '⛶'}
					</button>
					<button type="button" class="button button--ghost" onClick={resetView}>
						Reset
					</button>
				</span>
			</figcaption>
		</figure>
	);
}
