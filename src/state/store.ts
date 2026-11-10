import {
	customModel,
	DEFAULT_PRESET_ID,
	generateKey,
	getModel,
	getPreset,
	modelKeyspace,
	modelToConfig,
	EnigmaMachine,
	type MachineModel,
} from '@enigma-lab/core';

/** Everything the operator can change. Serialisable, and small enough for a URL. */
export interface LabState {
	readonly presetId: string;
	/** Rotor order, left to right, exactly as a key sheet writes it. */
	readonly rotorOrder: readonly string[];
	/** Ring settings, left to right. */
	readonly rings: string;
	/** Window start positions, left to right. */
	readonly positions: string;
	/** Plugboard cables as symbol pairs. */
	readonly plugboard: readonly (readonly [string, string])[];
	/** What the operator has typed. */
	readonly input: string;
	/** Present when the machine is one the operator invented. */
	readonly custom?: CustomMachine | undefined;
}

/**
 * A machine that never existed: any rotor count up to a hundred, wiring derived
 * from a seed so it can be shared, and the same constraints the real rotors
 * obeyed (a derangement, no contact wired to itself).
 */
export interface CustomMachine {
	readonly rotorCount: number;
	readonly seed: number;
	/** Notch letters, e.g. `'Q'` or `'ZM'`. */
	readonly notches: string;
	readonly reflector: 'random' | 'B' | 'C';
	readonly alphabet: string;
}

export const CUSTOM_PRESET_ID = 'custom';

/** Defaults for a home-made machine: three rotors, one notch each. */
export function defaultCustomMachine(): CustomMachine {
	return { rotorCount: 3, seed: 1932, notches: 'Q', reflector: 'random', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' };
}

/**
 * The model a state describes.
 *
 * Historical machines are catalogue entries; a custom one is generated from its
 * seed by the library, so the same seed always produces the same wheels — which
 * is what makes a shared link mean something.
 */
export function modelFor(state: LabState): MachineModel {
	if (state.presetId === CUSTOM_PRESET_ID && state.custom) {
		const custom = state.custom;
		return customModel({
			rotorCount: custom.rotorCount,
			seed: custom.seed,
			notches: custom.notches,
			reflector: custom.reflector,
			alphabet: custom.alphabet,
		});
	}
	return getModel(state.presetId);
}

const STORAGE_KEY = 'enigma-lab:v1';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** A fresh state for a preset: rotor order and all settings at A. */
export function stateForPreset(presetId: string = DEFAULT_PRESET_ID): LabState {
	if (presetId === CUSTOM_PRESET_ID) {
		const custom = defaultCustomMachine();
		const ids = Array.from({ length: custom.rotorCount }, (_, index) => `C${index + 1}`);
		return {
			presetId: CUSTOM_PRESET_ID,
			rotorOrder: ids,
			rings: 'A'.repeat(ids.length),
			positions: 'A'.repeat(ids.length),
			plugboard: [],
			input: '',
			custom,
		};
	}
	const preset = getPreset(presetId);
	return {
		presetId: preset.id,
		rotorOrder: [...preset.defaultRotorOrder],
		rings: 'A'.repeat(preset.defaultRotorOrder.length),
		positions: 'A'.repeat(preset.defaultRotorOrder.length),
		plugboard: [],
		input: '',
	};
}

/** Parses a plugboard string such as `AM FI NV` into cables, ignoring junk. */
export function parsePlugboard(value: string): [string, string][] {
	const seen = new Set<string>();
	const cables: [string, string][] = [];
	for (const pair of value.toUpperCase().match(/[A-Z]{2}/g) ?? []) {
		const [a, b] = [pair[0] as string, pair[1] as string];
		if (a === b || seen.has(a) || seen.has(b)) continue;
		seen.add(a);
		seen.add(b);
		cables.push([a, b]);
	}
	return cables;
}

/** Formats cables back into the string the operator types. */
export function formatPlugboard(cables: readonly (readonly [string, string])[]): string {
	return cables.map(([a, b]) => `${a}${b}`).join(' ');
}

/** Builds the live machine for a state. Throws only for genuinely invalid input. */
export function machineFor(state: LabState): EnigmaMachine {
	const model = modelFor(state);
	const config = modelToConfig(model, {
		rotorOrder: [...state.rotorOrder],
		rings: state.rings,
		positions: state.positions,
		plugboard: state.plugboard.map(([a, b]) => [a, b] as const),
	});
	return new EnigmaMachine(config);
}

/** Key space for the machine the operator has actually configured. */
export function keyspaceFor(state: LabState) {
	return modelKeyspace(modelFor(state), { rotorCount: state.rotorOrder.length, cables: state.plugboard.length });
}

/** Rolls a fresh daily key for the current preset, seeded so it can be shared. */
export function rollKey(state: LabState, seed: number): LabState {
	const key = generateKey(state.presetId === CUSTOM_PRESET_ID ? 'enigma-1' : state.presetId, { seed });
	if (state.presetId === CUSTOM_PRESET_ID) {
		const ids = state.rotorOrder;
		return { ...state, rings: key.rings.slice(0, ids.length), positions: key.positions.slice(0, ids.length), plugboard: key.plugboard };
	}
	return {
		...state,
		rotorOrder: [...key.rotorOrder],
		rings: key.rings,
		positions: key.positions,
		plugboard: key.plugboard,
	};
}

/** Reads a saved state, falling back to the default preset. */
export function loadState(): LabState {
	const fromHash = readHash();
	if (fromHash) return fromHash;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return normalise(JSON.parse(raw) as Partial<LabState>);
	} catch {
		// Private mode, or a corrupt entry: start clean.
	}
	return stateForPreset();
}

/** Persists the state; failures are non-fatal (private browsing). */
export function saveState(state: LabState): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Ignore quota and private-mode failures.
	}
}

function normalise(candidate: Partial<LabState>): LabState {
	const fallback = stateForPreset(candidate.presetId ?? DEFAULT_PRESET_ID);
	try {
		const merged: LabState = {
			presetId: candidate.presetId ?? fallback.presetId,
			rotorOrder: candidate.rotorOrder?.length ? candidate.rotorOrder : fallback.rotorOrder,
			rings: candidate.rings ?? fallback.rings,
			positions: candidate.positions ?? fallback.positions,
			plugboard: candidate.plugboard ?? [],
			input: candidate.input ?? '',
		};
		machineFor(merged);
		return merged;
	} catch {
		return fallback;
	}
}

/** Encodes a state into a short URL hash, so a setup can be shared. */
export function encodeHash(state: LabState): string {
	const compact = [state.presetId, state.rotorOrder.join('-'), state.rings, state.positions, formatPlugboard(state.plugboard)];
	return `#${compact.map(encodeURIComponent).join('~')}`;
}

/** Reads a shared setup from the URL hash, if there is one. */
export function readHash(hash: string = location.hash): LabState | null {
	if (!hash || hash.length < 4) return null;
	const parts = hash.slice(1).split('~').map(decodeURIComponent);
	const [presetId, rotorOrder, rings, positions, plugboard] = parts;
	if (!presetId) return null;
	try {
		const preset = getPreset(presetId);
		const order = (rotorOrder ?? '').split('-').filter(Boolean);
		return normalise({
			presetId,
			rotorOrder: order.length ? order : preset.defaultRotorOrder,
			rings: rings ?? 'A'.repeat(preset.defaultRotorOrder.length),
			positions: positions ?? 'A'.repeat(preset.defaultRotorOrder.length),
			plugboard: parsePlugboard(plugboard ?? ''),
		});
	} catch {
		return null;
	}
}

/** Advances one letter, wrapping at Z. */
export function nextLetter(letter: string, delta = 1): string {
	const index = LETTERS.indexOf(letter);
	if (index === -1) return 'A';
	return LETTERS[(index + delta + 26) % 26] as string;
}
