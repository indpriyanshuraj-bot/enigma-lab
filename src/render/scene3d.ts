/**
 * The whole machine, as one 3D model.
 *
 * Case, lid, rotor stack, reflector, keyboard, lampboard and plugboard are built
 * here as flat-shaded faces plus labels and hotspots. The renderer only has to
 * turn faces into triangles; the camera, the sorting and the hit testing are the
 * same for every backend, so a tap lands on the same key whether the pixels came
 * from WebGPU, WebGL or a 2D canvas.
 */
import { parseColour } from './colour.js';
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

/** Every colour the model uses, resolved from CSS by the caller. */
export interface Palette {
	readonly case: string;
	readonly caseEdge: string;
	readonly rotor: string;
	readonly rotorRing: string;
	readonly ink: string;
	readonly accent: string;
	readonly key: string;
	readonly keyLit: string;
	readonly panel: string;
	readonly lamp: string;
}

export interface Label {
	readonly at: Vec3;
	readonly text: string;
	readonly colour: string;
	/** Multiplier on the base text size. */
	readonly scale: number;
	readonly bold?: boolean;
}

export type Hotspot =
	| { readonly kind: 'rotor'; readonly index: number; readonly at: Vec3; readonly radius: number }
	| { readonly kind: 'key'; readonly letter: string; readonly at: Vec3; readonly radius: number }
	| { readonly kind: 'plug'; readonly letter: string; readonly at: Vec3; readonly radius: number };

export interface Scene3D {
	readonly faces: readonly Face[];
	readonly labels: readonly Label[];
	readonly hotspots: readonly Hotspot[];
}

export interface Machine3DInput {
	readonly rotorCount: number;
	readonly windows: readonly string[];
	readonly rings: readonly string[];
	readonly ids: readonly string[];
	readonly reflector: string;
	readonly lidOpen: boolean;
	readonly alphabet: string;
	/** The letter currently lit on the lampboard, if any. */
	readonly lit: string | null;
	/** Letters joined to the plugboard. */
	readonly plugged: readonly string[];
}

/** The three rows of a German Enigma keyboard, which was not QWERTY. */
export const KEY_ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'] as const;

const RADIUS = 46;
const LENGTH = 26;
const GAP = 8;
const WALL = 6;
const SEGMENTS = 20;

export interface Face {
	readonly points: readonly Vec3[];
	readonly colour: string;
	readonly shade: number;
}

const LIGHT = normalise({ x: -0.4, y: 0.85, z: 0.35 });

function normalise(v: Vec3): Vec3 {
	const length = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function shadeFor(normal: Vec3): number {
	const dot = normal.x * LIGHT.x + normal.y * LIGHT.y + normal.z * LIGHT.z;
	return 0.44 + 0.56 * Math.max(dot, 0);
}

function quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, colour: string, shade: number): Face {
	return { points: [a, b, c, d], colour, shade };
}

/** A flat plate lying on a plane of constant z, facing the viewer. */
function plate(centre: Vec3, width: number, height: number, colour: string, shade: number): Face {
	const hw = width / 2;
	const hh = height / 2;
	return quad(
		{ x: centre.x - hw, y: centre.y - hh, z: centre.z },
		{ x: centre.x + hw, y: centre.y - hh, z: centre.z },
		{ x: centre.x + hw, y: centre.y + hh, z: centre.z },
		{ x: centre.x - hw, y: centre.y + hh, z: centre.z },
		colour,
		shade,
	);
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

/** Rotor centres, left to right, and the extent of the machine. */
function layout(input: Machine3DInput) {
	const count = Math.max(input.rotorCount, 1);
	const step = LENGTH + GAP;
	const span = step * (count - 1);
	const centres = Array.from({ length: count }, (_, index) => ({ x: index * step - span / 2, y: 0, z: 0 }));
	const reflector = { x: (centres[0]?.x ?? 0) - RADIUS * 0.72 - 14, y: 0, z: 0 };
	const minX = reflector.x - RADIUS * 0.72 - 18;
	const maxX = (centres[centres.length - 1]?.x ?? 0) + RADIUS + 18;
	const depth = RADIUS * 2 + 24;
	const zFront = depth / 2;
	const zBack = -depth / 2;
	const top = RADIUS * 0.34;
	const bottom = -RADIUS - 104;
	// The keyboard deck slopes towards the operator, the way the real case did.
	const deckTop = { y: -RADIUS * 0.18, z: zFront };
	const deckBottom = { y: bottom + 52, z: zFront + 52 };
	return { centres, reflector, minX, maxX, zFront, zBack, top, bottom, deckTop, deckBottom };
}

/** A point on the sloped keyboard deck: `t` runs from the top of the slope to the front edge. */
function deckPoint(x: number, t: number, lift = 0): Vec3 {
	const { deckTop, deckBottom } = LAYOUT_REF;
	return {
		x,
		y: deckTop.y + (deckBottom.y - deckTop.y) * t,
		z: deckTop.z + (deckBottom.z - deckTop.z) * t + lift,
	};
}

/** A plate lying on the deck, given its centre in deck coordinates. */
function deckPlate(x: number, t: number, width: number, depth: number, colour: string, shade: number): Face {
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
}

/** Set by {@link buildScene3D} so {@link deckPoint} can place controls on the slope. */
const LAYOUT_REF = {
	deckTop: { y: 0, z: 0 },
	deckBottom: { y: 0, z: 0 },
};

/** Builds the machine: every part, in one scene. */
export function buildScene3D(input: Machine3DInput, palette: Palette): Scene3D {
	const faces: Face[] = [];
	const labels: Label[] = [];
	const hotspots: Hotspot[] = [];
	const { centres, reflector, minX, maxX, zFront, zBack, top, bottom, deckTop, deckBottom } = layout(input);
	LAYOUT_REF.deckTop = deckTop;
	LAYOUT_REF.deckBottom = deckBottom;

	// Case: floor, back wall, two side walls, the sloped deck and its front skirt.
	faces.push(
		quad(
			{ x: minX, y: bottom, z: zBack },
			{ x: maxX, y: bottom, z: zBack },
			{ x: maxX, y: bottom, z: deckBottom.z },
			{ x: minX, y: bottom, z: deckBottom.z },
			palette.case,
			0.5,
		),
		quad(
			{ x: minX, y: bottom, z: zBack },
			{ x: maxX, y: bottom, z: zBack },
			{ x: maxX, y: top, z: zBack },
			{ x: minX, y: top, z: zBack },
			palette.case,
			0.52,
		),
		quad(
			{ x: minX, y: bottom, z: zBack },
			{ x: minX, y: bottom, z: deckBottom.z },
			{ x: minX, y: deckTop.y, z: deckTop.z },
			{ x: minX, y: top, z: zBack },
			palette.case,
			0.6,
		),
		quad(
			{ x: maxX, y: bottom, z: zBack },
			{ x: maxX, y: bottom, z: deckBottom.z },
			{ x: maxX, y: deckTop.y, z: deckTop.z },
			{ x: maxX, y: top, z: zBack },
			palette.case,
			0.6,
		),
		// The deck itself, catching the light.
		quad(
			{ x: minX, y: deckTop.y, z: deckTop.z },
			{ x: maxX, y: deckTop.y, z: deckTop.z },
			{ x: maxX, y: deckBottom.y, z: deckBottom.z },
			{ x: minX, y: deckBottom.y, z: deckBottom.z },
			palette.panel,
			0.94,
		),
		// Front skirt below the deck edge.
		quad(
			{ x: minX, y: bottom, z: deckBottom.z },
			{ x: maxX, y: bottom, z: deckBottom.z },
			{ x: maxX, y: deckBottom.y, z: deckBottom.z },
			{ x: minX, y: deckBottom.y, z: deckBottom.z },
			palette.case,
			0.72,
		),
	);

	if (!input.lidOpen) {
		faces.push(
			quad(
				{ x: minX, y: RADIUS * 1.16, z: zBack },
				{ x: maxX, y: RADIUS * 1.16, z: zBack },
				{ x: maxX, y: RADIUS * 1.16, z: zFront },
				{ x: minX, y: RADIUS * 1.16, z: zFront },
				palette.case,
				0.98,
			),
		);
	}

	// Reflector, then the rotors standing proud of the case.
	faces.push(...cylinder(reflector, RADIUS * 0.72, 10, palette.rotorRing, palette.rotorRing));
	labels.push({ at: { x: reflector.x, y: RADIUS * 0.86, z: 0 }, text: input.reflector, colour: palette.ink, scale: 0.7 });

	centres.forEach((centre, index) => {
		const band = RADIUS * 1.04;
		faces.push(...cylinder(centre, RADIUS, LENGTH, palette.rotor, palette.rotorRing));
		faces.push(...cylinder(centre, band, Math.min(LENGTH * 0.55, 18), palette.rotorRing, palette.rotorRing));
		labels.push({
			at: { x: centre.x, y: band * 0.94, z: 0 },
			text: input.windows[index] ?? '',
			colour: palette.ink,
			scale: 1.5,
			bold: true,
		});
		labels.push({
			at: { x: centre.x, y: -RADIUS * 0.1, z: zFront + 0.6 },
			text: `${input.ids[index] ?? ''}·${input.rings[index] ?? ''}`,
			colour: palette.accent,
			scale: 0.72,
		});
		hotspots.push({ kind: 'rotor', index, at: { x: centre.x, y: 0, z: 0 }, radius: RADIUS });
	});

	// Controls, on the deck: lamps at the top, keys below them, sockets at the foot.
	const letters = [...input.alphabet];
	const centreX = (minX + maxX) / 2;
	const columnStep = Math.min(19, (maxX - minX - 30) / 9.5);
	const rowsOf = (rows: readonly string[]) => rows.map((row) => [...row].filter((letter) => letters.includes(letter)));

	rowsOf(KEY_ROWS).forEach((row, rowIndex) => {
		row.forEach((letter, columnIndex) => {
			const offset = (columnIndex - (row.length - 1) / 2) * columnStep;
			const x = centreX + offset;
			const t = 0.36 + rowIndex * 0.12;
			const lit = input.lit === letter;
			faces.push(deckPlate(x, t, columnStep * 0.78, 0.075, lit ? palette.keyLit : palette.key, 1));
			const at = deckPoint(x, t, 0.9);
			labels.push({ at, text: letter, colour: lit ? palette.case : palette.ink, scale: 0.82, bold: true });
			hotspots.push({ kind: 'key', letter, at: deckPoint(x, t, 0.6), radius: columnStep * 0.5 });
		});
	});

	rowsOf(KEY_ROWS).forEach((row, rowIndex) => {
		row.forEach((letter, columnIndex) => {
			const offset = (columnIndex - (row.length - 1) / 2) * columnStep;
			const x = centreX + offset;
			const t = 0.07 + rowIndex * 0.065;
			const lit = input.lit === letter;
			faces.push(deckPlate(x, t, columnStep * 0.42, 0.04, lit ? palette.accent : palette.lamp, 1));
			if (lit) labels.push({ at: deckPoint(x, t, 0.9), text: letter, colour: palette.case, scale: 0.55, bold: true });
		});
	});

	letters.forEach((letter, index) => {
		const columns = Math.ceil(letters.length / 2);
		const column = index % columns;
		const row = Math.floor(index / columns);
		const x = centreX + (column - (columns - 1) / 2) * columnStep * 0.92;
		const t = 0.78 + row * 0.11;
		const plugged = input.plugged.includes(letter);
		faces.push(deckPlate(x, t, columnStep * 0.4, 0.055, plugged ? palette.accent : palette.lamp, 1));
		labels.push({ at: deckPoint(x, t, 0.9), text: letter, colour: plugged ? palette.case : palette.ink, scale: 0.48, bold: plugged });
		hotspots.push({ kind: 'plug', letter, at: deckPoint(x, t, 0.6), radius: columnStep * 0.38 });
	});

	return { faces, labels, hotspots };
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
		const depth = projected.reduce((sum, point) => sum + point.depth, 0) / Math.max(projected.length, 1);
		const rgb = parseColour(face.colour) ?? ([0.5, 0.5, 0.5] as Rgb);
		const colour: Rgb = [rgb[0] * face.shade, rgb[1] * face.shade, rgb[2] * face.shade];
		return { projected, depth, colour };
	});
	prepared.sort((a, b) => b.depth - a.depth);

	const triangles: Triangle[] = [];
	for (const { projected, colour } of prepared) {
		const points: Point[] = projected.map((point) => ({ x: point.x, y: point.y }));
		for (let index = 1; index + 1 < points.length; index += 1) {
			triangles.push({
				a: points[0] as Point,
				b: points[index] as Point,
				c: points[index + 1] as Point,
				colour,
			});
		}
	}
	return triangles;
}

/** Draws the labels on a 2D overlay, so text stays crisp on every backend. */
export function paintLabels(
	context: CanvasRenderingContext2D,
	scene: Scene3D,
	camera: OrbitCamera,
	width: number,
	height: number,
	ratio: number,
): void {
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.clearRect(0, 0, width, height);
	context.textAlign = 'center';
	context.textBaseline = 'middle';

	const items = scene.labels
		.map((label) => {
			const projected = project3d(label.at, camera, width, height);
			return { label, projected };
		})
		.sort((a, b) => b.projected.depth - a.projected.depth);

	for (const { label, projected } of items) {
		const size = Math.max(6, Math.min(64, projected.scale * 6 * label.scale));
		if (size < 7) continue;
		const colour = parseColour(label.colour);
		if (!colour) continue;
		context.font = `${label.bold ? 700 : 500} ${size}px ui-monospace, "SF Mono", Menlo, monospace`;
		context.fillStyle = `rgb(${colour.map((channel) => Math.round(channel * 255)).join(' ')})`;
		context.fillText(label.text, projected.x, projected.y);
	}
}

/** What the pointer landed on, if anything. Nearest wins. */
export function hitTest3d(
	point: Point,
	scene: Scene3D,
	camera: OrbitCamera,
	width: number,
	height: number,
): Hotspot | null {
	let best: { hotspot: Hotspot; depth: number } | null = null;
	for (const hotspot of scene.hotspots) {
		const projected = project3d(hotspot.at, camera, width, height);
		const radius = Math.max(hotspot.radius * projected.scale, 6);
		if (Math.hypot(point.x - projected.x, point.y - projected.y) > radius) continue;
		if (!best || projected.depth < best.depth) best = { hotspot, depth: projected.depth };
	}
	return best ? best.hotspot : null;
}

