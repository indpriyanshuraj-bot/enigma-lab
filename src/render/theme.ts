import type { RenderTheme } from '@enigma-lab/core/render';

/**
 * The library deliberately ships no theme, so the site owns its look. These are
 * the only colours the machine drawing uses; everything else comes from CSS.
 */
export const labTheme: RenderTheme = {
	background: 'transparent',
	stroke: 'var(--edge)',
	rotorBody: 'var(--rotor)',
	rotorRing: 'var(--rotor-ring)',
	rotorLetter: 'var(--ink)',
	rotorAtNotch: 'var(--rotor-notch)',
	caseBody: 'var(--case)',
	wiring: 'var(--wire)',
	fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
	fontSize: 13,
};

/** Machine dimensions in user units, tuned for a phone held in one hand. */
export const machineGeometry = {
	radius: 46,
	thickness: 26,
	gap: 8,
	casePadding: 22,
} as const;
