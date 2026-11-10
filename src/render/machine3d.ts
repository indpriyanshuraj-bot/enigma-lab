/**
 * The machine, built with three.js.
 *
 * Real geometry, real materials, real lights: a lathed brass reflector, machined
 * rotor drums, ivory key caps with printed legends, amber lamps, a sloped deck and
 * a walnut-dark case, sitting on a bench that catches its shadow. Text is a canvas
 * texture on the part it belongs to, so a legend is legible from any angle because
 * it is printed on the object, not floating over it.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface Machine3DState {
	readonly windows: readonly string[];
	readonly rings: readonly string[];
	readonly ids: readonly string[];
	readonly reflector: string;
	readonly lidOpen: boolean;
	readonly lit: string | null;
	readonly plugged: readonly string[];
	readonly notes: readonly string[];
	readonly alphabet: string;
}

export type Pick =
	| { readonly kind: 'rotor'; readonly index: number }
	| { readonly kind: 'key'; readonly letter: string }
	| { readonly kind: 'plug'; readonly letter: string }
	| { readonly kind: 'note' };

export interface Machine3D {
	update(state: Machine3DState): void;
	focusPlugboard(): void;
	resetView(): void;
	zoomBy(factor: number): void;
	orbitBy(yaw: number, pitch: number): void;
	dispose(): void;
	readonly backend: string;
}

const RADIUS = 46;
const LENGTH = 26;
const GAP = 8;
const WALL = 6;
const ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'];

/** A canvas-backed label, so text is printed on the part rather than floating. */
function labelTexture(text: string, options: { background: string; ink: string; width?: number; height?: number; font?: string } ): THREE.CanvasTexture {
	const width = options.width ?? 256;
	const height = options.height ?? 256;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (context) {
		context.fillStyle = options.background;
		context.fillRect(0, 0, width, height);
		context.fillStyle = options.ink;
		context.font = options.font ?? `700 ${Math.round(height * 0.62)}px ui-monospace, Menlo, monospace`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(text, width / 2, height * 0.54);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}

/** A paper note, ruled and written on. */
function noteTexture(lines: readonly string[]): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 320;
	const context = canvas.getContext('2d');
	if (context) {
		context.fillStyle = '#f4ecd8';
		context.fillRect(0, 0, 512, 320);
		context.strokeStyle = 'rgba(120,100,60,0.25)';
		context.lineWidth = 2;
		for (let index = 1; index < 6; index += 1) {
			context.beginPath();
			context.moveTo(24, index * 52);
			context.lineTo(488, index * 52);
			context.stroke();
		}
		context.fillStyle = '#3a3327';
		context.font = '600 34px ui-monospace, Menlo, monospace';
		lines.slice(0, 5).forEach((line, index) => {
			context.fillText(line.slice(0, 16), 32, 46 + index * 52);
		});
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

export async function createMachine3D(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	onPick: (pick: Pick) => void,
): Promise<Machine3D> {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.75));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	const scene = new THREE.Scene();
	scene.background = null;

	const camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;
	controls.minPolarAngle = 0.15;
	controls.maxPolarAngle = 1.42;
	controls.enablePan = false;
	controls.minDistance = 120;
	controls.maxDistance = 1400;

	// Lighting: a soft sky, a key light with a shadow, and a warm fill from the front.
	scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x1a2129, 1.15));
	const key = new THREE.DirectionalLight(0xfff3e0, 2.1);
	key.position.set(-160, 320, 220);
	key.castShadow = true;
	key.shadow.mapSize.set(1024, 1024);
	key.shadow.camera.near = 50;
	key.shadow.camera.far = 900;
	key.shadow.camera.left = -260;
	key.shadow.camera.right = 260;
	key.shadow.camera.top = 260;
	key.shadow.camera.bottom = -260;
	scene.add(key);
	const fill = new THREE.PointLight(0xffd9a0, 0.5, 900);
	fill.position.set(120, 40, 260);
	scene.add(fill);

	// The bench.
	const bench = new THREE.Mesh(new THREE.CircleGeometry(520, 64), new THREE.ShadowMaterial({ opacity: 0.28 }));
	bench.rotation.x = -Math.PI / 2;
	bench.position.y = -160;
	bench.receiveShadow = true;
	scene.add(bench);

	const machine = new THREE.Group();
	scene.add(machine);

	const materials = {
		case: new THREE.MeshStandardMaterial({ color: 0x243844, metalness: 0.35, roughness: 0.62 }),
		caseTop: new THREE.MeshStandardMaterial({ color: 0x2f4d5e, metalness: 0.3, roughness: 0.55 }),
		deck: new THREE.MeshStandardMaterial({ color: 0x18262e, metalness: 0.25, roughness: 0.75 }),
		brass: new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.85, roughness: 0.28 }),
		ring: new THREE.MeshStandardMaterial({ color: 0x101a21, metalness: 0.5, roughness: 0.6 }),
		key: new THREE.MeshStandardMaterial({ color: 0xf0e7d3, metalness: 0.05, roughness: 0.55 }),
		lamp: new THREE.MeshStandardMaterial({ color: 0x3a3020, metalness: 0.2, roughness: 0.7, emissive: 0x000000 }),
		lampLit: new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb347, emissiveIntensity: 1.6, roughness: 0.4 }),
		paper: new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.9 }),
		rotors: [0x3f6f8f, 0x4f8a5f, 0xb07a2a, 0x7a5b9a, 0x3f8a8a, 0xa05a5a].map(
			(color) => new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.38 }),
		),
	};

	const pickable: THREE.Object3D[] = [];
	const dynamic = new THREE.Group();
	machine.add(dynamic);

	// --- static case -------------------------------------------------------
	const layout = { minX: -132, maxX: 98, zFront: 58, zBack: -58, top: 15.6, bottom: -150, deckTopY: -8.28, deckTopZ: 58, deckBottomY: -98, deckBottomZ: 110 };
	const width = layout.maxX - layout.minX;
	const depth = layout.zFront - layout.zBack;
	const centreX = (layout.minX + layout.maxX) / 2;

	const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material): THREE.Mesh => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
		mesh.position.set(x, y, z);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		machine.add(mesh);
		return mesh;
	};

	addBox(width + WALL * 2, WALL, depth + WALL * 2, centreX, layout.bottom, (layout.zFront + layout.zBack) / 2, materials.case);
	addBox(width + WALL * 2, layout.top - layout.bottom, WALL, centreX, (layout.top + layout.bottom) / 2, layout.zBack, materials.case);
	addBox(WALL, layout.top - layout.bottom, depth + WALL * 2, layout.minX - WALL / 2, (layout.top + layout.bottom) / 2, (layout.zFront + layout.zBack) / 2, materials.caseTop);
	addBox(WALL, layout.top - layout.bottom, depth + WALL * 2, layout.maxX + WALL / 2, (layout.top + layout.bottom) / 2, (layout.zFront + layout.zBack) / 2, materials.caseTop);

	// The sloped deck, as a solid slab.
	const deckLength = Math.hypot(layout.deckBottomY - layout.deckTopY, layout.deckBottomZ - layout.deckTopZ);
	const deckNormal = new THREE.Vector3(0, layout.deckBottomZ - layout.deckTopZ, -(layout.deckBottomY - layout.deckTopY)).normalize();
	const deck = addBox(width + WALL * 2, 8, deckLength, centreX, (layout.deckTopY + layout.deckBottomY) / 2, (layout.deckTopZ + layout.deckBottomZ) / 2, materials.deck);
	deck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), deckNormal);

	/** Set when something needs a redraw. Declared before `resize` uses it. */
	let dirty = true;
	let running = true;
	const invalidate = () => {
		dirty = true;
	};

	/** A point on the deck surface, with the deck's orientation. */
	const onDeck = (x: number, t: number, lift = 0): THREE.Vector3 => {
		const y = layout.deckTopY + (layout.deckBottomY - layout.deckTopY) * t;
		const z = layout.deckTopZ + (layout.deckBottomZ - layout.deckTopZ) * t;
		return new THREE.Vector3(x, y, z).addScaledVector(deckNormal, lift);
	};

	// --- rotors ------------------------------------------------------------
	const step = LENGTH + GAP;
	const span = step * 2;
	const rotorGroup = new THREE.Group();
	machine.add(rotorGroup);
	const rotorMeshes: THREE.Mesh[] = [];

	for (let index = 0; index < 3; index += 1) {
		const drum = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, LENGTH, 56, 1), materials.rotors[index % materials.rotors.length] as THREE.Material);
		drum.rotation.z = Math.PI / 2;
		drum.position.set(index * step - span / 2, 0, 0);
		drum.castShadow = true;
		drum.receiveShadow = true;
		drum.userData.pick = { kind: 'rotor', index };
		rotorGroup.add(drum);
		rotorMeshes.push(drum);
		pickable.push(drum);

		const band = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 1.05, RADIUS * 1.05, LENGTH * 0.55, 56, 1, true), materials.ring);
		band.rotation.z = Math.PI / 2;
		band.position.copy(drum.position);
		band.castShadow = true;
		rotorGroup.add(band);
	}

	const reflector = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 0.72, RADIUS * 0.72, 10, 48), materials.brass);
	reflector.rotation.z = Math.PI / 2;
	reflector.position.set(-span / 2 - RADIUS * 0.72 - 14, 0, 0);
	reflector.castShadow = true;
	reflector.receiveShadow = true;
	machine.add(reflector);

	// --- deck furniture ----------------------------------------------------
	const columnStep = Math.min(19, (width - 30) / 9.5);
	const keyMeshes = new Map<string, THREE.Mesh>();
	const lampMeshes = new Map<string, THREE.Mesh>();
	const socketMeshes = new Map<string, THREE.Mesh>();
	const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

	ROWS.forEach((row, rowIndex) => {
		[...row].forEach((letter, columnIndex) => {
			const x = centreX + (columnIndex - (row.length - 1) / 2) * columnStep;
			const t = 0.36 + rowIndex * 0.12;
			const cap = new THREE.Mesh(
				new THREE.BoxGeometry(columnStep * 0.78, 5, columnStep * 0.7),
				[materials.key, materials.key, new THREE.MeshStandardMaterial({ map: labelTexture(letter, { background: '#f0e7d3', ink: '#241d15' }), roughness: 0.55 }), materials.key, materials.key, materials.key],
			);
			cap.position.copy(onDeck(x, t, 2.5));
			cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), deckNormal);
			cap.castShadow = true;
			cap.receiveShadow = true;
			cap.userData.pick = { kind: 'key', letter };
			dynamic.add(cap);
			keyMeshes.set(letter, cap);
			pickable.push(cap);

			const lamp = new THREE.Mesh(new THREE.CylinderGeometry(columnStep * 0.18, columnStep * 0.18, 2, 20), materials.lamp);
			lamp.position.copy(onDeck(x, 0.07 + rowIndex * 0.065, 1.5));
			lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), deckNormal);
			dynamic.add(lamp);
			lampMeshes.set(letter, lamp);
		});
	});

	letters.forEach((letter, index) => {
		const columns = Math.ceil(letters.length / 2);
		const column = index % columns;
		const row = Math.floor(index / columns);
		const x = centreX + (column - (columns - 1) / 2) * columnStep * 0.92;
		const socket = new THREE.Mesh(new THREE.CylinderGeometry(columnStep * 0.17, columnStep * 0.17, 2.4, 18), materials.brass);
		socket.position.copy(onDeck(x, 0.78 + row * 0.1, 1.2));
		socket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), deckNormal);
		socket.userData.pick = { kind: 'plug', letter };
		dynamic.add(socket);
		socketMeshes.set(letter, socket);
		pickable.push(socket);
	});

	// --- the operator's note ----------------------------------------------
	const note = new THREE.Mesh(new THREE.PlaneGeometry(96, 60), materials.paper);
	note.position.set(layout.maxX + 62, layout.bottom + 96, 40);
	note.rotation.y = -0.35;
	note.castShadow = true;
	note.userData.pick = { kind: 'note' };
	machine.add(note);
	pickable.push(note);
	const noteFace = new THREE.Mesh(new THREE.PlaneGeometry(92, 56), new THREE.MeshStandardMaterial({ map: noteTexture([]), roughness: 0.92 }));
	noteFace.position.copy(note.position).add(new THREE.Vector3(0, 0, 0.4));
	noteFace.rotation.copy(note.rotation);
	machine.add(noteFace);

	// --- text that always reads: sprites for window letters and captions ---
	const windowSprites: THREE.Sprite[] = [];
	const captionSprites: THREE.Sprite[] = [];
	for (let index = 0; index < 3; index += 1) {
		// A window letter is a printed plate, not a floating label: it gets a backing
		// and it ignores the depth buffer, so it reads on any drum colour and is
		// never swallowed by the drum in front of it.
		const sprite = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: labelTexture('A', { background: '#0d1418', ink: '#ffffff', width: 128, height: 128 }),
				transparent: true,
				depthTest: false,
				depthWrite: false,
			}),
		);
		sprite.scale.set(30, 30, 1);
		sprite.position.set(index * step - span / 2, RADIUS * 1.16, 14);
		sprite.renderOrder = 12;
		machine.add(sprite);
		windowSprites.push(sprite);

		const caption = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: labelTexture('I', { background: 'rgba(6,10,14,0.86)', ink: '#ffd166', width: 192, height: 96 }),
				transparent: true,
				depthTest: false,
				depthWrite: false,
			}),
		);
		caption.scale.set(40, 20, 1);
		caption.position.set(index * step - span / 2, RADIUS * 0.55, layout.zFront + 12);
		caption.renderOrder = 11;
		machine.add(caption);
		captionSprites.push(caption);
	}

	// The reflector gets a plate too, so its label is not a ghost.
	const reflectorLabel = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: labelTexture('B', { background: 'rgba(6,10,14,0.86)', ink: '#ffd166', width: 128, height: 128 }),
			transparent: true,
			depthTest: false,
			depthWrite: false,
		}),
	);
	reflectorLabel.scale.set(26, 26, 1);
	reflectorLabel.position.set(reflector.position.x, RADIUS * 0.9, 10);
	reflectorLabel.renderOrder = 11;
	machine.add(reflectorLabel);

	// --- camera fitting ----------------------------------------------------
	const sphere = new THREE.Box3().setFromObject(machine).getBoundingSphere(new THREE.Sphere());
	const home = { target: sphere.center.clone(), distance: sphere.radius * 1.85 };
	controls.target.copy(home.target);
	camera.position.copy(home.target).add(new THREE.Vector3(-home.distance * 0.55, home.distance * 0.42, home.distance * 0.72));
	controls.update();

	/**
	 * Fits the machine to the frame.
	 *
	 * The vertical field of view is fixed, so a narrow screen crops horizontally:
	 * the distance has to grow as the aspect ratio falls. This is why zoom used to
	 * stop working on some window shapes — the fit ignored the width entirely.
	 */
	const fitDistance = (): number => {
		const rect = host.getBoundingClientRect();
		const aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
		const vertical = (camera.fov * Math.PI) / 180;
		const byHeight = sphere.radius / Math.sin(vertical / 2);
		const byWidth = byHeight / Math.min(aspect, 1);
		return Math.max(byHeight, byWidth) * 1.08;
	};

	const resize = () => {
		const rect = host.getBoundingClientRect();
		const width2 = Math.max(rect.width, 1);
		const height2 = Math.max(rect.height, 1);
		renderer.setSize(width2, height2, false);
		camera.aspect = width2 / height2;
		camera.updateProjectionMatrix();
		home.distance = fitDistance();
		invalidate();
	};
	resize();
	camera.position.copy(home.target).add(new THREE.Vector3(-home.distance * 0.55, home.distance * 0.42, home.distance * 0.72));
	controls.update();
	const observer = new ResizeObserver(() => {
		const before = home.distance;
		resize();
		// Keep the operator's zoom: scale the camera with the new fit.
		if (before > 0 && Math.abs(home.distance - before) > 1) {
			const offset = camera.position.clone().sub(controls.target);
			offset.multiplyScalar(home.distance / before);
			camera.position.copy(controls.target).add(offset);
			controls.update();
		}
	});
	observer.observe(host);

	// --- picking -----------------------------------------------------------
	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	let down: { x: number; y: number } | null = null;

	const onPointerDown = (event: PointerEvent) => {
		down = { x: event.clientX, y: event.clientY };
	};
	const onPointerUp = (event: PointerEvent) => {
		const start = down;
		down = null;
		if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
		const rect = canvas.getBoundingClientRect();
		pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);
		const hit = raycaster.intersectObjects(pickable, false)[0];
		if (hit?.object.userData.pick) onPick(hit.object.userData.pick as Pick);
	};
	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointerup', onPointerUp);

	// Render on demand, not at 60fps forever: a static machine should cost nothing,
	// and a phone should stay responsive while you drag it.
	controls.addEventListener('change', invalidate);
	const tick = () => {
		if (!running) return;
		const moved = controls.update();
		if (moved || dirty) {
			renderer.render(scene, camera);
			// A small, honest observable: the view, as the DOM can see it. It costs
			// nothing and it lets a test (or a person) confirm the camera moved.
			const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
			host.dataset.view = `${spherical.theta.toFixed(3)},${spherical.phi.toFixed(3)},${spherical.radius.toFixed(0)}`;
			dirty = false;
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);

	let state: Machine3DState | null = null;

	return {
		backend: `three.js r${THREE.REVISION} on WebGL`,
		update(next) {
			state = next;
			windowSprites.forEach((sprite, index) => {
				const text = next.windows[index] ?? '';
				if (sprite.userData.text !== text) {
					sprite.userData.text = text;
					sprite.material.map?.dispose();
					sprite.material.map = labelTexture(text, { background: '#0d1418', ink: '#ffffff', width: 128, height: 128 });
					sprite.material.needsUpdate = true;
				}
			});
			captionSprites.forEach((sprite, index) => {
				const text = `${next.ids[index] ?? ''}·${next.rings[index] ?? ''}`;
				if (sprite.userData.text !== text) {
					sprite.userData.text = text;
					sprite.material.map?.dispose();
					sprite.material.map = labelTexture(text, { background: 'rgba(6,10,14,0.86)', ink: '#ffd166', width: 192, height: 96 });
					sprite.material.needsUpdate = true;
				}
			});
			for (const [letter, lamp] of lampMeshes) {
				lamp.material = next.lit === letter ? materials.lampLit : materials.lamp;
			}
			for (const [letter, keyMesh] of keyMeshes) {
				const top = (keyMesh.material as THREE.Material[])[2] as THREE.MeshStandardMaterial;
				if (!top) continue;
				const pressed = next.lit === letter;
				top.emissive.setHex(pressed ? 0xffb347 : 0x000000);
				top.emissiveIntensity = pressed ? 0.55 : 0;
			}
			for (const [letter, socket] of socketMeshes) {
				socket.material = next.plugged.includes(letter) ? materials.brass : materials.caseTop;
			}
			invalidate();
			const paper = noteFace.material as THREE.MeshStandardMaterial;
			paper.map?.dispose();
			paper.map = noteTexture(next.notes);
			paper.needsUpdate = true;
			machine.visible = true;
			void state;
		},
		focusPlugboard() {
			controls.target.set(centreX, layout.deckBottomY + 10, layout.deckBottomZ - 10);
			camera.position.copy(controls.target).add(new THREE.Vector3(0, 150, 210));
			controls.update();
			invalidate();
		},
		resetView() {
			controls.target.copy(home.target);
			camera.position.copy(home.target).add(new THREE.Vector3(-home.distance * 0.55, home.distance * 0.42, home.distance * 0.72));
			controls.update();
			invalidate();
		},
		zoomBy(factor) {
			const offset = camera.position.clone().sub(controls.target);
			offset.multiplyScalar(1 / factor);
			camera.position.copy(controls.target).add(offset);
			controls.update();
			invalidate();
		},
		orbitBy(yaw, pitch) {
			const offset = camera.position.clone().sub(controls.target);
			const spherical = new THREE.Spherical().setFromVector3(offset);
			spherical.theta += yaw;
			spherical.phi = Math.min(1.42, Math.max(0.15, spherical.phi + pitch));
			camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
			controls.update();
			invalidate();
		},
		dispose() {
			running = false;
			observer.disconnect();
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointerup', onPointerUp);
			controls.dispose();
			renderer.dispose();
			scene.traverse((object) => {
				const mesh = object as THREE.Mesh;
				mesh.geometry?.dispose?.();
			});
			void state;
		},
	};
}
