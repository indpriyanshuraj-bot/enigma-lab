/**
 * A small, dependency-free 3D renderer for the machine.
 *
 * The point is not photorealism; it is that the thing in front of you is a real
 * object you can turn over. Every rotor is a cylinder, the case is a box, the
 * camera orbits, and a painter's algorithm sorts the faces back to front. It
 * runs on a 2D canvas, so it works on every device that can run the rest of the
 * page — including the ones with no WebGPU adapter.
 */
import { parseColour } from './webgpu-machine.js';

export interface Vec3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

export interface OrbitCamera {
	/** Rotation around the vertical axis, radians. */
	readonly yaw: number;
	/** Tilt above the horizon, radians. Clamped by the caller. */
	readonly pitch: number;
	/** Distance from the target, in world units. */
	readonly distance: number;
	/** Focal length in pixels. */
	readonly focal: number;
	readonly target: Vec3;
}

export interface Face {
	readonly points: readonly Vec3[];
	/** Base colour, as `#rrggbb`, resolved from the theme by the caller. */
	readonly colour: string;
	/** Shade multiplier, `0..1`, from the face normal. */
	readonly shade: number;
	readonly stroke?: string | undefined;
	readonly label?: { readonly text: string; readonly colour: string; readonly scale: number } | undefined;
}

export interface Machine3DOptions {
	/** Rotor count. */
	readonly rotorCount: number;
	/** Radius of a rotor. */
	readonly radius: number;
	/** Length of a rotor along its axis. */
	readonly length: number;
	/** Gap between rotors. */
	readonly gap: number;
	/** Thickness of the reflector wheel. */
	readonly reflectorThickness: number;
	/** Gap between the reflector and the first rotor. */
	readonly reflectorGap: number;
	/** Wall thickness of the case. */
	readonly case: number;
	readonly lidOpen: boolean;
}

export interface Machine3DLabels {
	readonly windows: readonly string[];
	readonly rings: readonly string[];
	readonly ids: readonly string[];
	readonly reflector: string;
}

const LIGHT: Vec3 = { x: -0.35, y: 0.86, z: 0.37 };

function normalise(v: Vec3): Vec3 {
	const length = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / length, y: v.y / length, z: v.z / length };
}

const LIGHT_UNIT = normalise(LIGHT);

/** Camera space: the world rotated so the camera looks down −Z. */
function toCamera(point: Vec3, camera: OrbitCamera): Vec3 {
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
	return { x: x1, y: y2, z: z2 - camera.distance };
}

export interface Projected {
	readonly x: number;
	readonly y: number;
	/** Distance in front of the camera. Larger is further away. */
	readonly depth: number;
	/** Pixels per world unit at this depth. */
	readonly scale: number;
}

/** Perspective projection into a viewport of `width` × `height` CSS pixels. */
export function project3d(point: Vec3, camera: OrbitCamera, width: number, height: number): Projected {
	const view = toCamera(point, camera);
	const depth = Math.max(-view.z, 0.001);
	const scale = camera.focal / depth;
	return { x: width / 2 + view.x * scale, y: height / 2 - view.y * scale, depth, scale };
}

/** Centres of the rotors, left to right, so a caller can hit-test against them. */
export function rotorCentres(options: Machine3DOptions): Vec3[] {
	const step = options.length + options.gap;
	const span = step * Math.max(options.rotorCount - 1, 0);
	return Array.from({ length: options.rotorCount }, (_, index) => ({
		x: index * step - span / 2,
		y: 0,
		z: 0,
	}));
}

/** Centre of the reflector wheel, to the left of the first rotor. */
export function reflectorCentre(options: Machine3DOptions): Vec3 {
	const centres = rotorCentres(options);
	const first = centres[0]?.x ?? 0;
	return { x: first - options.reflectorGap - options.reflectorThickness / 2, y: 0, z: 0 };
}

function shadeFor(normal: Vec3): number {
	const dot = normal.x * LIGHT_UNIT.x + normal.y * LIGHT_UNIT.y + normal.z * LIGHT_UNIT.z;
	return 0.42 + 0.58 * Math.max(dot, 0);
}

/** One cylinder around the X axis, as quads plus two end caps. */
function cylinder(
	centre: Vec3,
	radius: number,
	length: number,
	colour: string,
	segments: number,
	capColour: string,
): Face[] {
	const faces: Face[] = [];
	const x0 = centre.x - length / 2;
	const x1 = centre.x + length / 2;
	for (let index = 0; index < segments; index += 1) {
		const a = (index / segments) * Math.PI * 2;
		const b = ((index + 1) / segments) * Math.PI * 2;
		const mid = (a + b) / 2;
		const normal = normalise({ x: 0, y: Math.cos(mid), z: Math.sin(mid) });
		faces.push({
			points: [
				{ x: x0, y: Math.cos(a) * radius, z: Math.sin(a) * radius },
				{ x: x1, y: Math.cos(a) * radius, z: Math.sin(a) * radius },
				{ x: x1, y: Math.cos(b) * radius, z: Math.sin(b) * radius },
				{ x: x0, y: Math.cos(b) * radius, z: Math.sin(b) * radius },
			],
			colour,
			shade: shadeFor(normal),
		});
	}
	for (const [x, sign] of [
		[x0, -1],
		[x1, 1],
	] as const) {
		const points: Vec3[] = [];
		for (let index = 0; index < segments; index += 1) {
			const angle = (index / segments) * Math.PI * 2;
			points.push({ x, y: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
		}
		faces.push({ points, colour: capColour, shade: sign > 0 ? 0.94 : 0.62 });
	}
	return faces;
}

/** The case: four walls and a floor, plus a lid when it is shut. */
function case_(options: Machine3DOptions, colour: string, extent: { minX: number; maxX: number }): Face[] {
	const r = options.radius;
	const w = options.case;
	const yBottom = -r - w;
	// With the lid open the walls sit low, so the rotors stand proud of the case
	// the way they do on the real machine. Shut, the box is a box.
	const yTop = options.lidOpen ? r * 0.34 : r * 1.14;
	const zFront = r + w;
	const zBack = -r - w;
	const xMin = extent.minX - w;
	const xMax = extent.maxX + w;
	const wall = (points: Vec3[], shade: number): Face => ({ points, colour, shade });

	const faces: Face[] = [
		wall(
			[
				{ x: xMin, y: yBottom, z: zBack },
				{ x: xMax, y: yBottom, z: zBack },
				{ x: xMax, y: yBottom, z: zFront },
				{ x: xMin, y: yBottom, z: zFront },
			],
			0.55,
		),
		wall(
			[
				{ x: xMin, y: yBottom, z: zFront },
				{ x: xMax, y: yBottom, z: zFront },
				{ x: xMax, y: yTop, z: zFront },
				{ x: xMin, y: yTop, z: zFront },
			],
			0.86,
		),
		wall(
			[
				{ x: xMin, y: yBottom, z: zBack },
				{ x: xMax, y: yBottom, z: zBack },
				{ x: xMax, y: yTop, z: zBack },
				{ x: xMin, y: yTop, z: zBack },
			],
			0.48,
		),
		wall(
			[
				{ x: xMin, y: yBottom, z: zBack },
				{ x: xMin, y: yBottom, z: zFront },
				{ x: xMin, y: yTop, z: zFront },
				{ x: xMin, y: yTop, z: zBack },
			],
			0.7,
		),
		wall(
			[
				{ x: xMax, y: yBottom, z: zBack },
				{ x: xMax, y: yBottom, z: zFront },
				{ x: xMax, y: yTop, z: zFront },
				{ x: xMax, y: yTop, z: zBack },
			],
			0.7,
		),
	];

	if (!options.lidOpen) {
		faces.push(
			wall(
				[
					{ x: xMin, y: yTop, z: zBack },
					{ x: xMax, y: yTop, z: zBack },
					{ x: xMax, y: yTop, z: zFront },
					{ x: xMin, y: yTop, z: zFront },
				],
				0.98,
			),
		);
	}
	return faces;
}

/** Builds the whole machine as faces, with the window letters as labels. */
export function buildMachine3d(
	options: Machine3DOptions,
	labels: Machine3DLabels,
	colours: { rotor: string; rotorRing: string; case: string; ink: string; accent: string },
): Face[] {
	const faces: Face[] = [];
	const centres = rotorCentres(options);
	const reflector = reflectorCentre(options);
	const minX = Math.min(reflector.x - options.reflectorThickness / 2, centres[0]?.x ?? 0);
	const maxX = centres[centres.length - 1]?.x ?? 0;
	const segments = options.rotorCount > 24 ? 12 : 24;

	faces.push(...case_(options, colours.case, { minX, maxX }));

	// Reflector first: it is the furthest wheel.
	faces.push(
		...cylinder(reflector, options.radius * 0.72, options.reflectorThickness, colours.rotorRing, segments, colours.rotorRing),
	);

	centres.forEach((centre, index) => {
		faces.push(...cylinder(centre, options.radius, options.length, colours.rotor, segments, colours.rotorRing));
		// A ring band where the alphabet sits, and the window letter on top of it.
		const bandRadius = options.radius * 1.02;
		const bandWidth = Math.min(options.length * 0.5, options.radius * 0.5);
		faces.push(...cylinder({ ...centre, y: 0 }, bandRadius, bandWidth, colours.rotorRing, segments, colours.rotorRing));
		// The window letter sits on the very top of the ring band, clear of the
		// cylinder wall, so it is readable from any angle above the machine.
		const top = bandRadius * 1.035;
		faces.push({
			points: [
				{ x: centre.x - bandWidth / 2, y: top, z: -bandRadius * 0.22 },
				{ x: centre.x + bandWidth / 2, y: top, z: -bandRadius * 0.22 },
				{ x: centre.x + bandWidth / 2, y: top, z: bandRadius * 0.22 },
				{ x: centre.x - bandWidth / 2, y: top, z: bandRadius * 0.22 },
			],
			colour: colours.rotorRing,
			shade: 1,
			label: { text: labels.windows[index] ?? '', colour: colours.ink, scale: 1.15 },
		});
		// A small plate on the near face of the band, carrying the rotor id and ring.
		faces.push({
			points: [
				{ x: centre.x - bandWidth / 2, y: bandRadius * 0.42, z: bandRadius * 1.01 },
				{ x: centre.x + bandWidth / 2, y: bandRadius * 0.42, z: bandRadius * 1.01 },
				{ x: centre.x + bandWidth / 2, y: bandRadius * 0.06, z: bandRadius * 1.01 },
				{ x: centre.x - bandWidth / 2, y: bandRadius * 0.06, z: bandRadius * 1.01 },
			],
			colour: colours.rotorRing,
			shade: 0.92,
			label: { text: `${labels.ids[index] ?? ''}·${labels.rings[index] ?? ''}`, colour: colours.accent, scale: 0.36 },
		});
	});

	return faces;
}

/** Paints faces, furthest first, with flat shading and optional labels. */
export function paint3d(
	context: CanvasRenderingContext2D,
	faces: readonly Face[],
	camera: OrbitCamera,
	width: number,
	height: number,
): void {
	context.clearRect(0, 0, width, height);

	const prepared = faces
		.map((face) => {
			const projected = face.points.map((point) => project3d(point, camera, width, height));
			const depth = projected.reduce((sum, point) => sum + point.depth, 0) / Math.max(projected.length, 1);
			return { face, projected, depth };
		})
		.sort((a, b) => b.depth - a.depth);

	for (const { face, projected } of prepared) {
		const rgb = parseColour(face.colour);
		if (!rgb) continue;
		const [r, g, b] = rgb.map((channel) => Math.round(Math.min(1, channel * face.shade) * 255));
		context.beginPath();
		projected.forEach((point, index) => {
			if (index === 0) context.moveTo(point.x, point.y);
			else context.lineTo(point.x, point.y);
		});
		context.closePath();
		context.fillStyle = `rgb(${r} ${g} ${b})`;
		context.fill();
		if (face.stroke) {
			context.strokeStyle = face.stroke;
			context.lineWidth = 1;
			context.stroke();
		}

		if (face.label && face.label.text) {
			const centre = projected.reduce(
				(acc, point) => ({ x: acc.x + point.x / projected.length, y: acc.y + point.y / projected.length, scale: acc.scale + point.scale / projected.length }),
				{ x: 0, y: 0, scale: 0 },
			);
			const size = Math.max(6, Math.min(64, centre.scale * 0.5 * face.label.scale));
			context.font = `600 ${size}px ui-monospace, "SF Mono", Menlo, monospace`;
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			const ink = parseColour(face.label.colour);
			if (ink) {
				context.fillStyle = `rgb(${ink.map((channel) => Math.round(channel * 255)).join(' ')})`;
				context.fillText(face.label.text, centre.x, centre.y);
			}
		}
	}
}

/** Which rotor, if any, a screen point lands on. Front-most wins. */
export function hitTest3d(
	point: { x: number; y: number },
	options: Machine3DOptions,
	camera: OrbitCamera,
	width: number,
	height: number,
): number | null {
	let bestIndex: number | null = null;
	let bestDepth = Number.POSITIVE_INFINITY;
	rotorCentres(options).forEach((centre, index) => {
		const projected = project3d(centre, camera, width, height);
		const radius = options.radius * projected.scale;
		const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
		if (distance > radius) return;
		if (projected.depth < bestDepth) {
			bestDepth = projected.depth;
			bestIndex = index;
		}
	});
	return bestIndex;
}
