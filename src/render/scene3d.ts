/**
 * The whole machine, as one 3D model.
 *
 * Case, lid, rotor stack, reflector, keyboard, lampboard, plugboard and the
 * operator's note are built here as flat-shaded faces. Text is *geometry* too:
 * every letter is a set of quads in the scene, so it foreshortens, sorts and is
 * occluded exactly like the part it is printed on. There is no overlay layer and
 * therefore nothing that can drift out of register with the machine.
 */
import { glyphFor, GLYPH_ADVANCE } from './glyphs.js';
import type { Point, Rgb, Triangle } from './surface.js';

export interface Vec3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

export interface OrbitCamera {
	readonly yaw: number;
	readonly pitch: number;
	readonly distance: number;
	readonly focal: number;
	readonly target: Vec3;
}

/** Every colour the model uses. These are the object's materials, not the page's. */
export interface Palette {
	readonly caseSide: string;
	readonly caseTop: string;
	readonly deck: string;
	readonly rotor: string;
	readonly rotors: readonly string[];
	readonly rotorRing: string;
	readonly reflector: string;
	readonly ink: string;
	readonly accent: string;
	readonly key: string;
	readonly keyInk: string;
	readonly keyLit: string;
	readonly panel: string;
	readonly lamp: string;
	readonly lampLit: string;
	readonly socket: string;
	readonly socketPlugged: string;
	readonly paper: string;
	readonly paperInk: string;
}

export const MACHINE_COLOURS: Palette = {
	caseSide: '#22343f',
	caseTop: '#2c4a5a',
	deck: '#1b2b34',
	rotor: '#3f6f8f',
	rotors: ['#3f6f8f', '#4f8a5f', '#b07a2a', '#7a5b9a', '#3f8a8a', '#a05a5a'],
	rotorRing: '#132029',
	reflector: '#c9a227',
	ink: '#f6f1e6',
	accent: '#f5b942',
	key: '#f0e7d3',
	keyInk: '#241d15',
	keyLit: '#f5b942',
	panel: '#1b2b34',
	lamp: '#4a3d29',
	lampLit: '#ffd166',
	socket: '#b08d3a',
	socketPlugged: '#f5b942',
	paper: '#f4ecd8',
	paperInk: '#3a3327',
};

export interface Face {
	readonly points: readonly Vec3[];
	readonly colour: string;
	readonly shade: number;
}

export type Hotspot =
	| { readonly kind: 'rotor'; readonly index: number; readonly at: Vec3; readonly radius: number }
	| { readonly kind: 'key'; readonly letter: string; readonly at: Vec3; readonly radius: number }
	| { readonly kind: 'plug'; readonly letter: string; readonly at: Vec3; readonly radius: number }
	| { readonly kind: 'note'; readonly at: Vec3; readonly radius: number };

export interface Scene3D {
	readonly faces: readonly Face[];
	readonly hotspots: readonly Hotspot[];
	/** Centre and radius of everything in the scene, so the camera can fit it. */
	readonly bounds: { readonly centre: Vec3; readonly radius: number };
	/** Where the camera should look when the operator opens the plugboard. */
	readonly plugboardFocus: { readonly target: Vec3; readonly distance: number };
}

export interface Machine3DInput {
	readonly rotorCount: number;
	readonly windows: readonly string[];
	readonly rings: readonly string[];
	readonly ids: readonly string[];
	readonly reflector: string;
	readonly lidOpen: boolean;
	readonly alphabet: string;
	readonly lit: string | null;
	readonly plugged: readonly string[];
	/** Lines written on the operator's note. */
	readonly notes: readonly string[];
}

/** The three rows of a German Enigma keyboard, which was not QWERTY. */
export const KEY_ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'] as const;

const RADIUS = 46;
const LENGTH = 26;
const GAP = 8;
const SEGMENTS = 20;

const LIGHT = normalise({ x: -0.4, y: 0.85, z: 0.35 });

function normalise(v: Vec3): Vec3 {
	const length = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function cross(a: Vec3, b: Vec3): Vec3 {
	return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function add(a: Vec3, b: Vec3, scale = 1): Vec3 {
	return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

function shadeFor(normal: Vec3): number {
	const dot = normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z;
	return 0.44 + 0.56 * Math.max(dot, 0);
}

function quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, colour: string, shade: number): Face {
	return { points: [a, b, c, d], colour, shade };
}

/**
 * Prints a line of text into the scene.
 *
 * `origin` is the bottom-left corner of the line, `right` and `up` are the axes of
 * the surface it is printed on, and `height` is in world units.
 */
function addText(
	faces: Face[],
	text: string,
	origin: Vec3,
	right: Vec3,
	up: Vec3,
	height: number,
	colour: string,
	shade: number,
	options: { weight?: number; spacing?: number } = {},
): void {
	const normal = normalise(cross(right, up));
	const weight = height * (options.weight ?? 0.13);
	const spacing = options.spacing ?? GLYPH_ADVANCE;
	let cursor = 0;
	for (const character of text) {
		const glyph = glyphFor(character);
		for (const line of glyph) {
			for (let index = 1; index < line.length; index += 1) {
				const from = line[index - 1];
				const to = line[index];
				if (!from || !to) continue;
				const p0 = add(add(origin, right, (cursor + from[0] * 0.62) * height), up, (1 - from[1]) * height);
				const p1 = add(add(origin, right, (cursor + to[0] * 0.62) * height), up, (1 - to[1]) * height);
				const direction = normalise({ x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z });
				const across = normalise(cross(normal, direction));
				const half = weight / 2;
				faces.push(
					quad(
						add(p0, across, -half),
						add(p0, across, half),
						add(p1, across, half),
						add(p1, across, -half),
						colour,
						shade,
					),
				);
			}
		}
		cursor += spacing;
	}
}

/** A cylinder around the X axis: side quads plus two caps. */
function cylinder(centre: Vec3, radius: number, length: number, colour: string, capColour: string, segments = SEGMENTS): Face[] {
	const faces: Face[] = [];
	const x0 = centre.x - length / 2;
	const x1 = centre.x + length / 2;
	for (let index = 0; index < segments; index += 1) {
		const a = (index / segments) * Math.PI * 2;
		const b = ((index + 1) / segments) * Math.PI * 2;
		const mid = (a + b) / 2;
		faces.push(
			quad(
				{ x: x0, y: centre.y + Math.cos(a) * radius, z: centre.z + Math.sin(a) * radius },
				{ x: x1, y: centre.y + Math.cos(a) * radius, z: centre.z + Math.sin(a) * radius },
				{ x: x1, y: centre.y + Math.cos(b) * radius, z: centre.z + Math.sin(b) * radius },
				{ x: x0, y: centre.y + Math.cos(b) * radius, z: centre.z + Math.sin(b) * radius },
				colour,
				shadeFor(normalise({ x: 0, y: Math.cos(mid), z: Math.sin(mid) })),
			),
		);
	}
	for (const [x, shade] of [
		[x0, 0.6],
		[x1, 0.95],
	] as const) {
		const points: Vec3[] = [];
		for (let index = 0; index < segments; index += 1) {
			const angle = (index / segments) * Math.PI * 2;
			points.push({ x, y: centre.y + Math.cos(angle) * radius, z: centre.z + Math.sin(angle) * radius });
		}
		faces.push({ points, colour: capColour, shade });
	}
	return faces;
}

interface Layout {
	centres: Vec3[];
	reflector: Vec3;
	minX: number;
	maxX: number;
	zFront: number;
	zBack: number;
	top: number;
	bottom: number;
	deckTop: { y: number; z: number };
	deckBottom: { y: number; z: number };
}

function layout(input: Machine3DInput): Layout {
	const count = Math.max(input.rotorCount, 1);
	const step = LENGTH + GAP;
	const span = step * (count - 1);
	const centres = Array.from({ length: count }, (_, index) => ({ x: index * step - span / 2, y: 0, z: 0 }));
	const reflector = { x: (centres[0]?.x ?? 0) - RADIUS * 0.72 - 14, y: 0, z: 0 };
	const minX = reflector.x - RADIUS * 0.72 - 18;
	const maxX = (centres[centres.length - 1]?.x ?? 0) + RADIUS + 18;
	const zFront = (RADIUS * 2 + 24) / 2;
	const zBack = -zFront;
	const top = RADIUS * 0.34;
	const bottom = -RADIUS - 104;
	return {
		centres,
		reflector,
		minX,
		maxX,
		zFront,
		zBack,
		top,
		bottom,
		deckTop: { y: -RADIUS * 0.18, z: zFront },
		deckBottom: { y: bottom + 52, z: zFront + 52 },
	};
}

/** Splits the sloped deck into a grid, so depth sorting stays local. */
function deckTiles(
	minX: number,
	maxX: number,
	top: { y: number; z: number },
	bottom: { y: number; z: number },
	colour: string,
	columns = 6,
	rows = 5,
): Face[] {
	const faces: Face[] = [];
	const point = (x: number, t: number): Vec3 => ({
		x,
		y: top.y + (bottom.y - top.y) * t,
		z: top.z + (bottom.z - top.z) * t,
	});
	for (let column = 0; column < columns; column += 1) {
		const x0 = minX + ((maxX - minX) * column) / columns;
		const x1 = minX + ((maxX - minX) * (column + 1)) / columns;
		for (let row = 0; row < rows; row += 1) {
			const t0 = row / rows;
			const t1 = (row + 1) / rows;
			faces.push(quad(point(x0, t0), point(x1, t0), point(x1, t1), point(x0, t1), colour, 0.96 - row * 0.02));
		}
	}
	return faces;
}

/** Builds the machine: every part, in one scene. */
export function buildScene3D(input: Machine3DInput, palette: Palette): Scene3D {
	const faces: Face[] = [];
	const hotspots: Hotspot[] = [];
	const L = layout(input);
	const { centres, reflector, minX, maxX, zFront, zBack, top, bottom, deckTop, deckBottom } = L;

	/** A point on the sloped deck: `t` runs from the top of the slope to the front edge. */
	const deckPoint = (x: number, t: number, lift = 0): Vec3 => ({
		x,
		y: deckTop.y + (deckBottom.y - deckTop.y) * t,
		z: deckTop.z + (deckBottom.z - deckTop.z) * t + lift,
	});

	const deckPlate = (x: number, t: number, width: number, depth: number, colour: string, shade: number): Face => {
		const halfW = width / 2;
		const halfD = depth / 2;
		return quad(
			deckPoint(x - halfW, t - halfD, 0.6),
			deckPoint(x + halfW, t - halfD, 0.6),
			deckPoint(x + halfW, t + halfD, 0.6),
			deckPoint(x - halfW, t + halfD, 0.6),
			colour,
			shade,
		);
	};

	// Case: floor, back wall, two side walls, the sloped deck and its front skirt.
	faces.push(
		quad({ x: minX, y: bottom, z: zBack }, { x: maxX, y: bottom, z: zBack }, { x: maxX, y: bottom, z: deckBottom.z }, { x: minX, y: bottom, z: deckBottom.z }, palette.caseSide, 0.55),
		quad({ x: minX, y: bottom, z: zBack }, { x: maxX, y: bottom, z: zBack }, { x: maxX, y: top, z: zBack }, { x: minX, y: top, z: zBack }, palette.caseSide, 0.6),
		quad({ x: minX, y: bottom, z: zBack }, { x: minX, y: bottom, z: deckBottom.z }, { x: minX, y: deckTop.y, z: deckTop.z }, { x: minX, y: top, z: zBack }, palette.caseTop, 0.8),
		quad({ x: maxX, y: bottom, z: zBack }, { x: maxX, y: bottom, z: deckBottom.z }, { x: maxX, y: deckTop.y, z: deckTop.z }, { x: maxX, y: top, z: zBack }, palette.caseTop, 0.8),
		// The deck is tiled, not one quad. A painter's algorithm sorts by a face's
		// average depth, and one enormous quad averages to the middle of the
		// machine — so it would paint over the keys printed on its far half.
		...deckTiles(minX, maxX, deckTop, deckBottom, palette.deck),
		quad({ x: minX, y: bottom, z: deckBottom.z }, { x: maxX, y: bottom, z: deckBottom.z }, { x: maxX, y: deckBottom.y, z: deckBottom.z }, { x: minX, y: deckBottom.y, z: deckBottom.z }, palette.caseSide, 0.66),
	);

	if (!input.lidOpen) {
		faces.push(
			quad(
				{ x: minX, y: RADIUS * 1.16, z: zBack },
				{ x: maxX, y: RADIUS * 1.16, z: zBack },
				{ x: maxX, y: RADIUS * 1.16, z: zFront },
				{ x: minX, y: RADIUS * 1.16, z: zFront },
				palette.caseTop,
				1,
			),
		);
	}

	// Reflector, then the rotors.
	faces.push(...cylinder(reflector, RADIUS * 0.72, 10, palette.reflector, palette.reflector));
	addText(faces, input.reflector.replace('UKW-', ''), { x: reflector.x - 12, y: RADIUS * 0.8, z: 12 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 9, palette.ink, 1);

	centres.forEach((centre, index) => {
		const band = RADIUS * 1.04;
		const body = palette.rotors[index % Math.max(palette.rotors.length, 1)] ?? palette.rotor;
		faces.push(...cylinder(centre, RADIUS, LENGTH, body, palette.rotorRing));
		faces.push(...cylinder(centre, band, Math.min(LENGTH * 0.55, 18), palette.rotorRing, palette.rotorRing));
		// The window: printed on the crown of the wheel, facing up and forward.
		const window = input.windows[index] ?? '';
		addText(
			faces,
			window,
			{ x: centre.x - 6, y: band + 1, z: 6 },
			{ x: 1, y: 0, z: 0 },
			{ x: 0, y: 0, z: -1 },
			16,
			palette.key,
			1,
			{ weight: 0.16 },
		);
		const caption = `${input.ids[index] ?? ''}·${input.rings[index] ?? ''}`;
		addText(faces, caption, { x: centre.x - caption.length * 3, y: RADIUS * 0.1, z: zFront + 1 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 6.5, palette.accent, 1, {
			weight: 0.18,
		});
		hotspots.push({ kind: 'rotor', index, at: { x: centre.x, y: 0, z: 0 }, radius: RADIUS });
	});

	// Controls, on the deck: lamps at the top, keys below them, sockets at the foot.
	const letters = [...input.alphabet];
	const centreX = (minX + maxX) / 2;
	const columnStep = Math.min(19, (maxX - minX - 30) / 9.5);
	const rowsOf = KEY_ROWS.map((row) => [...row].filter((letter) => letters.includes(letter)));

	rowsOf.forEach((row, rowIndex) => {
		row.forEach((letter, columnIndex) => {
			const offset = (columnIndex - (row.length - 1) / 2) * columnStep;
			const x = centreX + offset;
			const t = 0.36 + rowIndex * 0.12;
			const lit = input.lit === letter;
			if (lit) faces.push(deckPlate(x, t, columnStep * 0.98, 0.1, palette.keyLit, 1));
			faces.push(deckPlate(x, t, columnStep * 0.78, 0.075, lit ? palette.keyLit : palette.key, 1));
			const keyText = columnStep * 0.38;
			const centre = deckPoint(x, t, 9);
			addText(
				faces,
				letter,
				{ x: centre.x - keyText * 0.31, y: centre.y - keyText * 0.5, z: centre.z },
				{ x: 1, y: 0, z: 0 },
				{ x: 0, y: 1, z: 0 },
				keyText,
				palette.keyInk,
				1,
				{ weight: 0.17 },
			);
			hotspots.push({ kind: 'key', letter, at: deckPoint(x, t, 0.6), radius: columnStep * 0.5 });
		});
	});

	rowsOf.forEach((row, rowIndex) => {
		row.forEach((letter, columnIndex) => {
			const offset = (columnIndex - (row.length - 1) / 2) * columnStep;
			const x = centreX + offset;
			const t = 0.07 + rowIndex * 0.065;
			const lit = input.lit === letter;
			if (lit) faces.push(deckPlate(x, t, columnStep * 0.8, 0.08, palette.lampLit, 1));
			faces.push(deckPlate(x, t, columnStep * 0.42, 0.04, lit ? palette.lampLit : palette.lamp, 1));
		});
	});

	letters.forEach((letter, index) => {
		const columns = Math.ceil(letters.length / 2);
		const column = index % columns;
		const row = Math.floor(index / columns);
		const x = centreX + (column - (columns - 1) / 2) * columnStep * 0.92;
		const t = 0.78 + row * 0.1;
		const plugged = input.plugged.includes(letter);
		faces.push(deckPlate(x, t, columnStep * 0.4, 0.055, plugged ? palette.socketPlugged : palette.socket, 1));
		const plugText = columnStep * 0.22;
		const socket = deckPoint(x, t, 3.5);
		addText(
			faces,
			letter,
			{ x: socket.x - plugText * 0.31, y: socket.y - plugText * 0.5, z: socket.z },
			{ x: 1, y: 0, z: 0 },
			{ x: 0, y: 1, z: 0 },
			plugText,
			palette.keyInk,
			1,
			{ weight: 0.24 },
		);
		hotspots.push({ kind: 'plug', letter, at: deckPoint(x, t, 0.6), radius: columnStep * 0.38 });
	});

	// The operator's note, on a card beside the machine, written on by hand.
	const noteX = maxX + 12;
	const noteY = bottom + 66;
	const noteZ = 26;
	const noteW = 56;
	const noteH = 36;
	faces.push(quad({ x: noteX, y: noteY, z: noteZ }, { x: noteX + noteW, y: noteY, z: noteZ }, { x: noteX + noteW, y: noteY + noteH, z: noteZ }, { x: noteX, y: noteY + noteH, z: noteZ }, palette.paper, 0.98));
	input.notes.slice(0, 4).forEach((line, index) => {
		addText(
			faces,
			line.slice(0, 12),
			{ x: noteX + 3, y: noteY + noteH - 8 - index * 8.5, z: noteZ + 0.5 },
			{ x: 1, y: 0, z: 0 },
			{ x: 0, y: 1, z: 0 },
			5,
			palette.paperInk,
			1,
			{ weight: 0.2 },
		);
	});
	hotspots.push({ kind: 'note', at: { x: noteX + noteW / 2, y: noteY + noteH / 2, z: noteZ }, radius: 30 });

	return {
		faces,
		hotspots,
		bounds: boundsOf(faces),
		plugboardFocus: { target: { x: centreX, y: deckBottom.y + 6, z: deckBottom.z - 20 }, distance: 190 },
	};
}

/** Centre and radius of every point in the scene. */
function boundsOf(faces: readonly Face[]): { centre: Vec3; radius: number } {
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;
	for (const face of faces) {
		for (const point of face.points) {
			minX = Math.min(minX, point.x);
			minY = Math.min(minY, point.y);
			minZ = Math.min(minZ, point.z);
			maxX = Math.max(maxX, point.x);
			maxY = Math.max(maxY, point.y);
			maxZ = Math.max(maxZ, point.z);
		}
	}
	if (!Number.isFinite(minX)) return { centre: { x: 0, y: 0, z: 0 }, radius: 100 };
	const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
	const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2;
	return { centre, radius };
}

/** Projects one point. Larger `depth` is further from the camera. */
export function project3d(point: Vec3, camera: OrbitCamera, width: number, height: number) {
	const x0 = point.x - camera.target.x;
	const y0 = point.y - camera.target.y;
	const z0 = point.z - camera.target.z;
	const cosYaw = Math.cos(camera.yaw);
	const sinYaw = Math.sin(camera.yaw);
	const x1 = x0 * cosYaw - z0 * sinYaw;
	const z1 = x0 * sinYaw + z0 * cosYaw;
	const cosPitch = Math.cos(camera.pitch);
	const sinPitch = Math.sin(camera.pitch);
	const y2 = y0 * cosPitch - z1 * sinPitch;
	const z2 = y0 * sinPitch + z1 * cosPitch;
	const depth = Math.max(-(z2 - camera.distance), 0.001);
	const scale = camera.focal / depth;
	return { x: width / 2 + x1 * scale, y: height / 2 - y2 * scale, depth, scale };
}

/**
 * Projects the faces into triangles, sorted back to front.
 *
 * Sorting on the CPU is deliberate: it makes the painter's algorithm identical on
 * every backend, and a machine this size has no performance problem to solve.
 */
export function renderTriangles(faces: readonly Face[], camera: OrbitCamera, width: number, height: number): Triangle[] {
	const prepared = faces.map((face) => {
		const projected = face.points.map((point) => project3d(point, camera, width, height));
		let depth = 0;
		for (const point of projected) depth += point.depth;
		depth /= Math.max(projected.length, 1);
		const rgb = hexToRgb(face.colour);
		const colour: Rgb = [rgb[0] * face.shade, rgb[1] * face.shade, rgb[2] * face.shade];
		return { projected, depth, colour };
	});
	prepared.sort((a, b) => b.depth - a.depth);

	const triangles: Triangle[] = [];
	for (const { projected, colour } of prepared) {
		const points: Point[] = projected.map((point) => ({ x: point.x, y: point.y }));
		for (let index = 1; index + 1 < points.length; index += 1) {
			triangles.push({ a: points[0] as Point, b: points[index] as Point, c: points[index + 1] as Point, colour });
		}
	}
	return triangles;
}

/** What the pointer landed on, if anything. Nearest wins. */
export function hitTest3d(point: Point, scene: Scene3D, camera: OrbitCamera, width: number, height: number): Hotspot | null {
	let best: { hotspot: Hotspot; depth: number } | null = null;
	for (const hotspot of scene.hotspots) {
		const projected = project3d(hotspot.at, camera, width, height);
		const radius = Math.max(hotspot.radius * projected.scale, 7);
		if (Math.hypot(point.x - projected.x, point.y - projected.y) > radius) continue;
		if (!best || projected.depth < best.depth) best = { hotspot, depth: projected.depth };
	}
	return best ? best.hotspot : null;
}

function hexToRgb(value: string): Rgb {
	const text = value.trim();
	const hex = text.startsWith('#') ? text.slice(1) : text;
	if (hex.length === 3) {
		const [r, g, b] = [...hex].map((char) => Number.parseInt(char + char, 16) / 255);
		return [r ?? 0.5, g ?? 0.5, b ?? 0.5];
	}
	if (hex.length === 6) {
		return [
			Number.parseInt(hex.slice(0, 2), 16) / 255,
			Number.parseInt(hex.slice(2, 4), 16) / 255,
			Number.parseInt(hex.slice(4, 6), 16) / 255,
		];
	}
	return [0.5, 0.5, 0.5];
}
