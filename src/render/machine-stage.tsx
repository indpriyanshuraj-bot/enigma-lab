import { buildMachineScene, hitTestScene, type Camera, type MachineGeometry, type SceneRotor } from '@enigma-lab/core/render';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createSurface, type Point, type Surface, type Triangle } from './surface.js';
import { parseColour } from './colour.js';

export interface MachineStageProps {
	readonly rotors: readonly SceneRotor[];
	readonly reflectorLabel: string;
	readonly geometry: MachineGeometry;
	readonly onSelectRotor: (index: number) => void;
	readonly selected: number | null;
	readonly lidOpen: boolean;
	readonly onToggleLid: () => void;
	readonly onBackend: (backend: string) => void;
	readonly preference: 'auto' | 'webgpu' | 'webgl' | 'canvas';
}

const VIEWPORT = { width: 360, height: 200 };
const DEFAULT_CAMERA: Camera = { yaw: 0.14, pitch: 0.95, zoom: 1, origin: { x: 180, y: 100 } };

function colours(): { body: string; notch: string; ring: string; edge: string } {
	const style = getComputedStyle(document.documentElement);
	const read = (name: string, fallback: string): string => {
		const value = style.getPropertyValue(name).trim();
		return parseColour(value) ? value : fallback;
	};
	return {
		body: read('--rotor', '#22303e'),
		notch: read('--rotor-notch', '#3d3220'),
		ring: read('--rotor-ring', '#2b3b4c'),
		edge: read('--edge-strong', '#35455a'),
	};
}

/**
 * The top-down machine.
 *
 * The discs are rasterised by the shared surface — WebGPU, WebGL2 or a 2D canvas
 * — and everything that must be read, focused or announced stays in SVG on top:
 * window letters, ring captions, the notch marker, the lid, and one focusable
 * button per rotor.
 */
export function MachineStage(props: MachineStageProps) {
	const { rotors, reflectorLabel, geometry, selected, lidOpen, onSelectRotor, onToggleLid, preference } = props;
	const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
	const geometryRef = useRef<HTMLCanvasElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const surfaceRef = useRef<Surface | null>(null);
	// Bumped when the surface finishes initialising, so the first frame is drawn.
	const [surfaceReady, setSurfaceReady] = useState(0);
	const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: number } | null>(null);

	const scene = useMemo(
		() => buildMachineScene({ rotors, reflectorLabel }, { geometry, camera, viewport: VIEWPORT }),
		[rotors, reflectorLabel, geometry, camera],
	);

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

	useEffect(() => {
		const surface = surfaceRef.current;
		const host = hostRef.current;
		if (!surface || !host) return;
		const rect = host.getBoundingClientRect();
		const width = Math.max(rect.width, 1);
		const height = Math.max(rect.height, 1);
		surface.resize(width, height, Math.min(globalThis.devicePixelRatio || 1, 2));

		const spanX = Math.max(scene.bounds.maxX - scene.bounds.minX, 1);
		const spanY = Math.max(scene.bounds.maxY - scene.bounds.minY, 1);
		const toScreen = (x: number, y: number): Point => ({
			x: ((x - scene.bounds.minX) / spanX) * width,
			y: ((y - scene.bounds.minY) / spanY) * height,
		});

		const palette = colours();
		const squash = Math.abs(Math.sin(camera.pitch)) || 0.6;
		const triangles: Triangle[] = [];

		const disc = (cx: number, cy: number, radius: number, colour: string, segments = 40): void => {
			const rgb = parseColour(colour) ?? [0.5, 0.5, 0.5];
			const centre = toScreen(cx, cy);
			for (let index = 0; index < segments; index += 1) {
				const a = (index / segments) * Math.PI * 2;
				const b = ((index + 1) / segments) * Math.PI * 2;
				triangles.push({
					a: centre,
					b: toScreen(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * squash),
					c: toScreen(cx + Math.cos(b) * radius, cy + Math.sin(b) * radius * squash),
					colour: [rgb[0], rgb[1], rgb[2]],
				});
			}
		};

		for (let index = scene.rotors.length - 1; index >= 0; index -= 1) {
			const rotor = scene.rotors[index];
			if (!rotor) continue;
			// A rim first, then the body: a flat fill alone reads as a smudge.
			disc(rotor.center.x, rotor.center.y, rotor.slot.radius, palette.edge);
			disc(rotor.center.x, rotor.center.y, rotor.slot.radius - 1.6, rotor.atNotch ? palette.notch : palette.body);
			disc(rotor.center.x, rotor.center.y, rotor.slot.radius * 0.62, palette.ring, 32);
			disc(rotor.center.x, rotor.center.y, rotor.slot.radius * 0.62 - 1.2, rotor.atNotch ? palette.notch : palette.body, 32);
		}
		disc(scene.reflector.center.x, scene.reflector.center.y, scene.reflector.radius, palette.edge, 28);
		disc(scene.reflector.center.x, scene.reflector.center.y, scene.reflector.radius - 1.6, palette.ring, 28);

		surface.draw(triangles);
	}, [scene, camera, preference, surfaceReady]);

	const onPointerDown = (event: PointerEvent) => {
		(event.currentTarget as Element).setPointerCapture?.(event.pointerId);
		dragRef.current = { x: event.clientX, y: event.clientY, yaw: camera.yaw, pitch: camera.pitch, moved: 0 };
	};

	const onPointerMove = (event: PointerEvent) => {
		const drag = dragRef.current;
		if (!drag) return;
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
		if (drag.moved < 6) return;
		setCamera({
			...camera,
			yaw: drag.yaw - dx * 0.006,
			pitch: Math.min(1.45, Math.max(0.35, drag.pitch + dy * 0.004)),
		});
	};

	const onPointerUp = (event: PointerEvent) => {
		const drag = dragRef.current;
		dragRef.current = null;
		if (!drag || drag.moved >= 6) return;
		const host = hostRef.current;
		if (!host) return;
		const rect = host.getBoundingClientRect();
		const point = {
			x: scene.bounds.minX + ((event.clientX - rect.left) / rect.width) * (scene.bounds.maxX - scene.bounds.minX),
			y: scene.bounds.minY + ((event.clientY - rect.top) / rect.height) * (scene.bounds.maxY - scene.bounds.minY),
		};
		const hit = hitTestScene(scene, point);
		if (hit.kind === 'rotor') onSelectRotor(hit.index);
	};

	return (
		<figure class="machine">
			<div
				class="machine__stage"
				ref={hostRef}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onWheel={(event) => {
					event.preventDefault();
					setCamera({ ...camera, zoom: Math.min(2.2, Math.max(0.6, camera.zoom - event.deltaY * 0.001)) });
				}}
			>
				<canvas ref={geometryRef} class="machine__gpu" aria-hidden="true" />
				<svg
					class="machine__overlay"
					viewBox={`${scene.bounds.minX} ${scene.bounds.minY} ${Math.max(scene.bounds.maxX - scene.bounds.minX, 1)} ${Math.max(
						scene.bounds.maxY - scene.bounds.minY,
						1,
					)}`}
					preserveAspectRatio="xMidYMid meet"
					role="group"
					aria-label={`Enigma machine, ${rotors.length} rotors, showing ${rotors.map((rotor) => rotor.window).join('')}`}
				>
					<rect class="machine__case" x={scene.case.x} y={scene.case.y} width={scene.case.width} height={scene.case.height} rx={scene.case.radius} />
					<text class="machine__case-label" x={scene.case.x + 10} y={scene.case.y + 18}>
						{scene.reflector.label}
					</text>

					{scene.rotors.map((rotor) => (
						<g
							key={`${rotor.id}-${rotor.index}`}
							class={selected === rotor.index ? 'rotor rotor--selected' : 'rotor'}
							role="button"
							tabindex={0}
							aria-label={`Rotor ${rotor.index + 1}, ${rotor.id}, window ${rotor.window}, ring ${rotor.ring}${rotor.atNotch ? ', on its turnover notch' : ''}`}
							onClick={() => onSelectRotor(rotor.index)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									onSelectRotor(rotor.index);
								}
							}}
						>
							<circle class="rotor__hit" cx={rotor.center.x} cy={rotor.center.y} r={rotor.slot.radius} />
							<circle class="rotor__notch" cx={rotor.notch.x} cy={rotor.notch.y} r={3} />
							<text class="rotor__letter" x={rotor.center.x} y={rotor.center.y + 1}>
								{rotor.window}
							</text>
							<text class="rotor__meta" x={rotor.caption.x} y={rotor.caption.y}>
								{rotor.id} · {rotor.ring}
							</text>
						</g>
					))}

					{lidOpen ? null : (
						<g
							class="lid"
							role="button"
							tabindex={0}
							aria-label="Lift the lid"
							onClick={onToggleLid}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									onToggleLid();
								}
							}}
						>
							<rect class="lid__panel" x={scene.case.x + 4} y={scene.case.y + 4} width={scene.case.width - 8} height={scene.case.height - 8} rx={scene.case.radius} />
							<text class="lid__label" x={scene.case.x + scene.case.width / 2} y={scene.case.y + scene.case.height / 2}>
								Lift the lid
							</text>
						</g>
					)}
				</svg>
			</div>
			<figcaption>
				<button type="button" class="button button--ghost" onClick={onToggleLid}>
					{lidOpen ? 'Close the lid' : 'Lift the lid'}
				</button>
				<span>Drag to turn the machine, scroll to zoom, tap a rotor to work it.</span>
			</figcaption>
		</figure>
	);
}
