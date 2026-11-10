/**
 * A stroke font, in a unit box, drawn as geometry.
 *
 * Text on the machine is not painted over the top of it: every letter is emitted
 * as quads in the scene, so it is occluded by the rotor in front of it, foreshortens
 * with the camera, and lands in the right order with every other face. That is the
 * difference between a label and a printed part.
 *
 * Each glyph is a list of polylines in a 0..1 box, y running downwards.
 */
export type Polyline = readonly (readonly [number, number])[];

const A: Polyline[] = [
	[
		[0, 1],
		[0.5, 0],
		[1, 1],
	],
	[
		[0.22, 0.62],
		[0.78, 0.62],
	],
];
const B: Polyline[] = [
	[
		[0, 0],
		[0, 1],
	],
	[
		[0, 0],
		[0.72, 0],
		[0.86, 0.25],
		[0.72, 0.5],
		[0, 0.5],
	],
	[
		[0, 0.5],
		[0.78, 0.5],
		[0.92, 0.75],
		[0.78, 1],
		[0, 1],
	],
];
const C: Polyline[] = [
	[
		[0.95, 0.12],
		[0.6, 0],
		[0.25, 0.15],
		[0.1, 0.5],
		[0.25, 0.85],
		[0.6, 1],
		[0.95, 0.88],
	],
];
const D: Polyline[] = [
	[
		[0, 0],
		[0, 1],
	],
	[
		[0, 0],
		[0.6, 0.05],
		[0.85, 0.35],
		[0.85, 0.65],
		[0.6, 0.95],
		[0, 1],
	],
];
const E: Polyline[] = [
	[
		[0.9, 0],
		[0, 0],
		[0, 1],
		[0.9, 1],
	],
	[
		[0, 0.5],
		[0.7, 0.5],
	],
];
const F: Polyline[] = [
	[
		[0.9, 0],
		[0, 0],
		[0, 1],
	],
	[
		[0, 0.5],
		[0.7, 0.5],
	],
];
const G: Polyline[] = [
	[
		[0.95, 0.14],
		[0.6, 0],
		[0.25, 0.15],
		[0.1, 0.5],
		[0.25, 0.85],
		[0.62, 1],
		[0.95, 0.82],
		[0.95, 0.55],
		[0.6, 0.55],
	],
];
const H: Polyline[] = [
	[
		[0, 0],
		[0, 1],
	],
	[
		[1, 0],
		[1, 1],
	],
	[
		[0, 0.5],
		[1, 0.5],
	],
];
const I: Polyline[] = [
	[
		[0.5, 0],
		[0.5, 1],
	],
	[
		[0.15, 0],
		[0.85, 0],
	],
	[
		[0.15, 1],
		[0.85, 1],
	],
];
const J: Polyline[] = [
	[
		[0.85, 0],
		[0.85, 0.78],
		[0.6, 1],
		[0.25, 0.95],
		[0.12, 0.72],
	],
	[
		[0.45, 0],
		[1, 0],
	],
];
const K: Polyline[] = [
	[
		[0, 0],
		[0, 1],
	],
	[
		[0.95, 0],
		[0.05, 0.62],
	],
	[
		[0.32, 0.44],
		[1, 1],
	],
];
const L: Polyline[] = [
	[
		[0, 0],
		[0, 1],
		[0.9, 1],
	],
];
const M: Polyline[] = [
	[
		[0, 1],
		[0, 0],
		[0.5, 0.62],
		[1, 0],
		[1, 1],
	],
];
const N: Polyline[] = [
	[
		[0, 1],
		[0, 0],
		[1, 1],
		[1, 0],
	],
];
const O: Polyline[] = [
	[
		[0.5, 0],
		[0.85, 0.2],
		[0.95, 0.5],
		[0.85, 0.8],
		[0.5, 1],
		[0.15, 0.8],
		[0.05, 0.5],
		[0.15, 0.2],
		[0.5, 0],
	],
];
const P: Polyline[] = [
	[
		[0, 1],
		[0, 0],
		[0.75, 0],
		[0.9, 0.22],
		[0.75, 0.46],
		[0, 0.46],
	],
];
const Q: Polyline[] = [
	[
		[0.5, 0],
		[0.85, 0.2],
		[0.95, 0.5],
		[0.85, 0.8],
		[0.5, 1],
		[0.15, 0.8],
		[0.05, 0.5],
		[0.15, 0.2],
		[0.5, 0],
	],
	[
		[0.62, 0.7],
		[1, 1.05],
	],
];
const R: Polyline[] = [
	[
		[0, 1],
		[0, 0],
		[0.75, 0],
		[0.9, 0.22],
		[0.75, 0.46],
		[0, 0.46],
	],
	[
		[0.45, 0.46],
		[0.95, 1],
	],
];
const S: Polyline[] = [
	[
		[0.92, 0.14],
		[0.55, 0],
		[0.2, 0.1],
		[0.12, 0.32],
		[0.4, 0.48],
		[0.75, 0.56],
		[0.9, 0.76],
		[0.72, 0.95],
		[0.32, 1],
		[0.05, 0.86],
	],
];
const T: Polyline[] = [
	[
		[0, 0],
		[1, 0],
	],
	[
		[0.5, 0],
		[0.5, 1],
	],
];
const U: Polyline[] = [
	[
		[0, 0],
		[0, 0.72],
		[0.22, 0.95],
		[0.5, 1],
		[0.78, 0.95],
		[1, 0.72],
		[1, 0],
	],
];
const V: Polyline[] = [
	[
		[0, 0],
		[0.5, 1],
		[1, 0],
	],
];
const W: Polyline[] = [
	[
		[0, 0],
		[0.22, 1],
		[0.5, 0.42],
		[0.78, 1],
		[1, 0],
	],
];
const X: Polyline[] = [
	[
		[0, 0],
		[1, 1],
	],
	[
		[1, 0],
		[0, 1],
	],
];
const Y: Polyline[] = [
	[
		[0, 0],
		[0.5, 0.5],
		[1, 0],
	],
	[
		[0.5, 0.5],
		[0.5, 1],
	],
];
const Z: Polyline[] = [
	[
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1],
	],
];

const ZERO: Polyline[] = [
	[
		[0.5, 0],
		[0.85, 0.2],
		[0.95, 0.5],
		[0.85, 0.8],
		[0.5, 1],
		[0.15, 0.8],
		[0.05, 0.5],
		[0.15, 0.2],
		[0.5, 0],
	],
];
const ONE: Polyline[] = [
	[
		[0.2, 0.22],
		[0.55, 0],
		[0.55, 1],
	],
];
const TWO: Polyline[] = [
	[
		[0.1, 0.2],
		[0.5, 0],
		[0.88, 0.2],
		[0.8, 0.5],
		[0.1, 1],
		[0.95, 1],
	],
];
const THREE: Polyline[] = [
	[
		[0.12, 0.1],
		[0.55, 0],
		[0.9, 0.22],
		[0.55, 0.48],
		[0.9, 0.72],
		[0.55, 1],
		[0.1, 0.9],
	],
];
const FOUR: Polyline[] = [
	[
		[0.72, 0],
		[0.05, 0.68],
		[1, 0.68],
	],
	[
		[0.72, 0],
		[0.72, 1],
	],
];
const FIVE: Polyline[] = [
	[
		[0.9, 0],
		[0.2, 0],
		[0.12, 0.42],
		[0.55, 0.38],
		[0.9, 0.62],
		[0.72, 0.95],
		[0.2, 1],
		[0.05, 0.88],
	],
];
const SIX: Polyline[] = [
	[
		[0.85, 0.08],
		[0.45, 0],
		[0.15, 0.3],
		[0.08, 0.72],
		[0.4, 1],
		[0.75, 0.92],
		[0.88, 0.68],
		[0.6, 0.5],
		[0.2, 0.6],
	],
];
const SEVEN: Polyline[] = [
	[
		[0.05, 0],
		[0.95, 0],
		[0.42, 1],
	],
];
const EIGHT: Polyline[] = [
	[
		[0.5, 0.48],
		[0.15, 0.28],
		[0.35, 0],
		[0.7, 0.06],
		[0.8, 0.3],
		[0.5, 0.48],
		[0.12, 0.7],
		[0.3, 1],
		[0.7, 0.98],
		[0.88, 0.72],
		[0.5, 0.48],
	],
];
const NINE: Polyline[] = [
	[
		[0.9, 0.4],
		[0.5, 0.52],
		[0.15, 0.35],
		[0.3, 0.02],
		[0.72, 0.02],
		[0.9, 0.3],
		[0.82, 0.72],
		[0.5, 1],
		[0.15, 0.92],
	],
];

const DOT: Polyline[] = [
	[
		[0.45, 0.9],
		[0.55, 0.9],
	],
];
const DASH: Polyline[] = [
	[
		[0.15, 0.5],
		[0.85, 0.5],
	],
];
const SLASH: Polyline[] = [
	[
		[0.85, 0],
		[0.15, 1],
	],
];
const PLUS: Polyline[] = [
	[
		[0.5, 0.2],
		[0.5, 0.8],
	],
	[
		[0.15, 0.5],
		[0.85, 0.5],
	],
];

/** Every glyph the machine can print. Unknown characters fall back to a dot. */
export const GLYPHS: Readonly<Record<string, readonly Polyline[]>> = {
	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
	'0': ZERO,
	'1': ONE,
	'2': TWO,
	'3': THREE,
	'4': FOUR,
	'5': FIVE,
	'6': SIX,
	'7': SEVEN,
	'8': EIGHT,
	'9': NINE,
	'.': DOT,
	'-': DASH,
	'/': SLASH,
	'+': PLUS,
	'·': DOT,
	' ': [],
};

/** Width of one character cell, relative to its height. */
export const GLYPH_ADVANCE = 0.78;

export function glyphFor(character: string): readonly Polyline[] {
	return GLYPHS[character.toUpperCase()] ?? DOT;
}

/** How wide a string will be, in units of its height. */
export function textWidth(text: string, letterSpacing = GLYPH_ADVANCE): number {
	return Math.max(0, text.length * letterSpacing - (letterSpacing - 0.62));
}
