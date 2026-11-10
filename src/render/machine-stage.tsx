import { buildMachineScene, hitTestScene, type Camera, type MachineGeometry, type SceneRotor } from '@enigma-lab/core/render';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createGpuMachine, paletteFromCss, type GpuMachine } from './webgpu-machine.js';

export interface MachineStageProps {
	readonly rotors: readonly SceneRotor[];
	readonly reflectorLabel: string;
	readonly geometry: MachineGeometry;
	readonly onSelectRotor: (index: number) => void;
	readonly selected: number | null;
	readonly lidOpen: boolean;
	readonly onToggleLid: () => void;
	readonly rendererKind: 'webgpu' | 'svg';
	readonly onRendererChange: (kind: 'webgpu' | 'svg') => void;
}

const VIEWPORT = { width: 360, height: 200 };
const DEFAULT_CAMERA: Camera = { yaw: 0.14, pitch: 0.95, zoom: 1, origin: { x: 180, y: 100 } };

/**
 * The machine, drawn from the library's scene.
 *
 * WebGPU rasterises the rotor discs when the device allows it; SVG draws the
 * letters, captions, focus rings and the lid, and it takes the pointer events.
 * That split is deliberate: the interactive surface is ordinary DOM, so it stays
 * keyboard-reachable and works with a screen reader whichever backend painted
 * the discs.
 */
export function MachineStage(props: MachineStageProps) {
	const { rotors, reflectorLabel, geometry, selected, lidOpen, onSelectRotor, onToggleLid, rendererKind, onRendererChange } = props;
	const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const gpuRef = useRef<GpuMachine | null>(null);
	const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: number } | null>(null);

	const scene = useMemo(
		() => buildMachineScene({ rotors, reflectorLabel }, { geometry, camera, viewport: VIEWPORT }),
		[rotors, reflectorLabel, geometry, camera],
	);

	// One GPU context for the lifetime of the stage.
	useEffect(() => {
		let cancelled = false;
		const canvas = canvasRef.current;
		if (!canvas) return;
		void createGpuMachine(canvas).then((machine) => {
			if (cancelled) {
				machine?.dispose();
				return;
			}
			gpuRef.current = machine;
			onRendererChange(machine ? 'webgpu' : 'svg');
		});
		return () => {
			cancelled = true;
			gpuRef.current?.dispose();
			gpuRef.current = null;
		};
	}, [onRendererChange]);

	// Draw whenever the scene or the theme changes.
	useEffect(() => {
		const machine = gpuRef.current;
		const host = hostRef.current;
		if (!machine || !host) return;
		const rect = host.getBoundingClientRect();
		machine.draw(scene, paletteFromCss(), rect.width || VIEWPORT.width, rect.height || VIEWPORT.height);
	}, [scene, rendererKind]);

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
				<canvas ref={canvasRef} class="machine__gpu" aria-hidden="true" />
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

					{rendererKind === 'svg'
						? [...scene.rotors].reverse().map((rotor) => (
								<ellipse
									key={`disc-${rotor.index}`}
									class={rotor.atNotch ? 'disc disc--notch' : 'disc'}
									cx={rotor.center.x}
									cy={rotor.center.y}
									rx={rotor.slot.radius}
									ry={rotor.slot.radius * Math.abs(Math.sin(camera.pitch))}
								/>
							))
						: null}

					{lidOpen ? scene.rotors.map((rotor) => (
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
							<circle class="rotor__ring" cx={rotor.center.x} cy={rotor.center.y} r={rotor.slot.radius * 0.62} />
							<circle class="rotor__notch" cx={rotor.notch.x} cy={rotor.notch.y} r={3} />
							<text class="rotor__letter" x={rotor.center.x} y={rotor.center.y + 1}>
								{rotor.window}
							</text>
							<text class="rotor__meta" x={rotor.caption.x} y={rotor.caption.y}>
								{rotor.id} · {rotor.ring}
							</text>
						</g>
					)) : null}

					{lidOpen ? null : (
						<g class="lid" role="button" tabindex={0} aria-label="Lift the lid" onClick={onToggleLid} onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								onToggleLid();
							}
						}}>
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
