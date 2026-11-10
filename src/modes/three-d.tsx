import { useEffect, useRef, useState } from 'preact/hooks';
import { createMachine3D, type Machine3D, type Machine3DState, type Pick } from '../render/machine3d.js';

export interface ThreeDProps extends Machine3DState {
	readonly onToggleLid: () => void;
	readonly onRotor: (index: number) => void;
	readonly onKey: (letter: string) => void;
	readonly onPlug: (letter: string) => void;
	readonly onNote: () => void;
	readonly onBackend: (backend: string) => void;
}

/**
 * The machine, drawn by three.js.
 *
 * The component owns nothing but the canvas and the lifecycle: the scene, the
 * materials, the lights, the orbit controls and the raycasting all live in
 * `machine3d.ts`, so the React tree stays a thin shell over a real 3D object.
 */
export function ThreeD(props: ThreeDProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const machineRef = useRef<Machine3D | null>(null);
	const [fullscreen, setFullscreen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handlers = useRef(props);
	handlers.current = props;

	useEffect(() => {
		let cancelled = false;
		const canvas = canvasRef.current;
		const host = hostRef.current;
		if (!canvas || !host) return;
		createMachine3D(canvas, host, (pick: Pick) => {
			const current = handlers.current;
			if (pick.kind === 'rotor') current.onRotor(pick.index);
			else if (pick.kind === 'key') current.onKey(pick.letter);
			else if (pick.kind === 'plug') current.onPlug(pick.letter);
			else current.onNote();
		})
			.then((machine) => {
				if (cancelled) {
					machine.dispose();
					return;
				}
				machineRef.current = machine;
				props.onBackend(machine.backend);
				machine.update(handlers.current);
			})
			.catch((reason: unknown) => {
				setError(reason instanceof Error ? reason.message : 'this browser cannot start WebGL');
			});
		return () => {
			cancelled = true;
			machineRef.current?.dispose();
			machineRef.current = null;
		};
	}, []);

	useEffect(() => {
		machineRef.current?.update(props);
	}, [props.windows, props.rings, props.ids, props.reflector, props.lit, props.plugged, props.notes, props.alphabet]);

	useEffect(() => {
		const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
		document.addEventListener('fullscreenchange', onChange);
		return () => document.removeEventListener('fullscreenchange', onChange);
	}, []);

	const toggleFullscreen = async () => {
		const host = hostRef.current;
		if (!host) return;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await host.requestFullscreen();
		} catch {
			// The browser declined; the button simply does nothing.
		}
	};

	return (
		<figure class="machine machine--3d">
			<div
				class={fullscreen ? 'machine__stage machine__stage--3d is-fullscreen' : 'machine__stage machine__stage--3d'}
				ref={hostRef}
				tabindex={0}
				role="application"
				aria-label={`Enigma machine in three dimensions, showing ${props.windows.join('')}. Arrow keys turn it, plus and minus zoom.`}
				onKeyDown={(event) => {
					const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'];
					if (!keys.includes(event.key)) return;
					event.preventDefault();
					const machine = machineRef.current;
					if (!machine) return;
					if (event.key === 'ArrowLeft') machine.orbitBy(-0.12, 0);
					else if (event.key === 'ArrowRight') machine.orbitBy(0.12, 0);
					else if (event.key === 'ArrowUp') machine.orbitBy(0, -0.08);
					else if (event.key === 'ArrowDown') machine.orbitBy(0, 0.08);
					else if (event.key === '+' || event.key === '=') machine.zoomBy(1.12);
					else machine.zoomBy(0.9);
				}}
			>
				<canvas ref={canvasRef} class="machine__gpu" aria-hidden="true" />
				{error ? <p class="machine__error">3D needs WebGL, which this browser did not provide: {error}</p> : null}
				{!props.lidOpen ? (
					<button type="button" class="machine__lid-hint" onClick={props.onToggleLid}>
						Lift the lid
					</button>
				) : null}
			</div>
			<figcaption class="machine__caption">
				<span class="machine__camera-actions">
					<button type="button" class="button button--ghost" onClick={() => machineRef.current?.orbitBy(-0.25, 0)} aria-label="Turn left">
						↺
					</button>
					<button type="button" class="button button--ghost" onClick={() => machineRef.current?.orbitBy(0.25, 0)} aria-label="Turn right">
						↻
					</button>
					<button type="button" class="button button--ghost" onClick={() => machineRef.current?.zoomBy(1.15)} aria-label="Zoom in">
						+
					</button>
					<button type="button" class="button button--ghost" onClick={() => machineRef.current?.zoomBy(0.87)} aria-label="Zoom out">
						−
					</button>
					<button type="button" class="button button--ghost" onClick={() => machineRef.current?.focusPlugboard()} aria-label="Open the plugboard">
						Plugs
					</button>
					<button type="button" class="button button--ghost" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Leave full screen' : 'Full screen'}>
						{fullscreen ? '⤢' : '⛶'}
					</button>
					<button type="button" class="button button--ghost" onClick={() => machineRef.current?.resetView()}>
						Reset
					</button>
				</span>
			</figcaption>
		</figure>
	);
}
