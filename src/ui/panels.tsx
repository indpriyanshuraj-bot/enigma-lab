import { formatKeyspace, getPreset, keyspace, type KeyspaceBreakdown } from '@enigma-lab/core';
import { useMemo, useState } from 'preact/hooks';
import { CUSTOM_PRESET_ID, defaultCustomMachine, type LabState } from '../state/store.js';

/** The machine builder: rotors you invent, up to a hundred of them. */
export function Builder({ state, onChange }: { state: LabState; onChange: (next: LabState) => void }) {
	const custom = state.custom ?? defaultCustomMachine();
	const [draft, setDraft] = useState(custom);
	const letters = [...draft.alphabet];

	const apply = (next: typeof draft) => {
		setDraft(next);
		const ids = Array.from({ length: next.rotorCount }, (_, index) => `C${index + 1}`);
		onChange({
			...state,
			presetId: CUSTOM_PRESET_ID,
			custom: next,
			rotorOrder: ids,
			rings: 'A'.repeat(ids.length),
			positions: 'A'.repeat(ids.length),
		});
	};

	return (
		<section class="panel" aria-labelledby="builder-heading">
			<h2 id="builder-heading">Build your own</h2>
			<label class="field">
				<span>Rotors: {draft.rotorCount}</span>
				<input
					type="range"
					min={1}
					max={100}
					value={draft.rotorCount}
					onInput={(event) => apply({ ...draft, rotorCount: Number((event.target as HTMLInputElement).value) })}
				/>
				<small>Each rotor gets its own wiring, generated from the seed below.</small>
			</label>
			<label class="field">
				<span>Seed: {draft.seed}</span>
				<input
					type="range"
					min={1}
					max={9999}
					value={draft.seed}
					onInput={(event) => apply({ ...draft, seed: Number((event.target as HTMLInputElement).value) })}
				/>
			</label>
			<label class="field">
				<span>Turnover notches</span>
				<input
					type="text"
					value={draft.notches}
					maxLength={4}
					onInput={(event) => {
						const value = (event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, '');
						apply({ ...draft, notches: value || 'A' });
					}}
				/>
				<small>One letter per notch: `Q` for a service rotor, `ZM` for a naval one.</small>
			</label>
			<label class="field">
				<span>Reflector</span>
				<select value={draft.reflector} onChange={(event) => apply({ ...draft, reflector: (event.target as HTMLSelectElement).value as 'random' | 'B' | 'C' })}>
					<option value="random">Random (an involution)</option>
					<option value="B">UKW-B</option>
					<option value="C">UKW-C</option>
				</select>
			</label>
			<label class="field">
				<span>Alphabet size: {letters.length}</span>
				<input
					type="range"
					min={4}
					max={40}
					step={2}
					value={letters.length}
					onInput={(event) => {
						const size = Number((event.target as HTMLInputElement).value);
						apply({ ...draft, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-*/'.slice(0, size) });
					}}
				/>
				<small>Every machine needs an even number of contacts for the reflector.</small>
			</label>
		</section>
	);
}

/** What-if arithmetic: move the sliders and watch the bits. */
export function KeyspaceExplorer({ state, breakdown: live, total }: { state: LabState; breakdown: KeyspaceBreakdown; total: string }) {
	const preset = state.presetId === CUSTOM_PRESET_ID ? null : getPreset(state.presetId);
	const poolMax = preset ? preset.rotorPool.length : 100;
	const [cables, setCables] = useState(state.plugboard.length);
	const [rotors, setRotors] = useState(state.rotorOrder.length);
	const [alphabetSize, setAlphabetSize] = useState(26);

	const breakdown = useMemo(
		() => keyspace({ rotorPool: poolMax, rotorCount: Math.min(rotors, poolMax), cables, alphabetSize }),
		[poolMax, rotors, cables, alphabetSize],
	);
	const tenCables = useMemo(() => keyspace({ rotorPool: poolMax, rotorCount: Math.min(rotors, poolMax), cables: 10, alphabetSize }), [poolMax, rotors, alphabetSize]);
	const thirteenCables = useMemo(
		() => keyspace({ rotorPool: poolMax, rotorCount: Math.min(rotors, poolMax), cables: 13, alphabetSize }),
		[poolMax, rotors, alphabetSize],
	);

	return (
		<section class="panel" aria-labelledby="keyspace-heading">
			<h2 id="keyspace-heading">Key space</h2>
			<p class="keyspace__total">
				<span>{formatKeyspace(breakdown)}</span>
				<small>keys · {breakdown.bits.toFixed(1)} bits</small>
			</p>
			<p class="keyspace__live">
				This machine, as configured: <strong>{total}</strong> keys · <strong>{live.bits.toFixed(1)} bits</strong>
			</p>
			<label class="field">
				<span>Plugboard cables: {cables}</span>
				<input type="range" min={0} max={13} value={cables} onInput={(event) => setCables(Number((event.target as HTMLInputElement).value))} />
			</label>
			<label class="field">
				<span>Rotors fitted: {Math.min(rotors, poolMax)} of {poolMax}</span>
				<input type="range" min={1} max={poolMax} value={Math.min(rotors, poolMax)} onInput={(event) => setRotors(Number((event.target as HTMLInputElement).value))} />
			</label>
			<label class="field">
				<span>Alphabet: {alphabetSize} symbols</span>
				<input
					type="range"
					min={4}
					max={40}
					step={2}
					value={alphabetSize}
					onInput={(event) => setAlphabetSize(Number((event.target as HTMLInputElement).value))}
				/>
			</label>
			<dl class="keyspace__grid">
				<div>
					<dt>Rotor order</dt>
					<dd>{formatKeyspace(breakdown.rotorOrders)}</dd>
				</div>
				<div>
					<dt>Ring settings</dt>
					<dd>{formatKeyspace(breakdown.ringSettings)}</dd>
				</div>
				<div>
					<dt>Start positions</dt>
					<dd>{formatKeyspace(breakdown.startPositions)}</dd>
				</div>
				<div>
					<dt>Plugboard</dt>
					<dd>{formatKeyspace(breakdown.plugboard)}</dd>
				</div>
			</dl>
			<p class="keyspace__note">
				Ten cables is stronger than thirteen: {tenCables.bits.toFixed(1)} bits against {thirteenCables.bits.toFixed(1)}. The involution count
				peaks at ten or eleven cables and then falls, because each extra cable also removes choices. Enigma's real weakness was never
				arithmetic — 81 bits was beyond any machine of the era — it was procedure.
			</p>
		</section>
	);
}

/** Sends a message the way a signals officer did, indicator first. */
export function SignalPanel({ indicator, body, messageKey }: { indicator: string; body: string; messageKey: string }) {
	return (
		<>
			<p class="signal__line">
				<span class="signal__label">Indicator (message key {messageKey}, sent twice)</span>
				<code>{indicator || '—'}</code>
			</p>
			<p class="signal__line">
				<span class="signal__label">Body, grouped in fives</span>
				<code>{body || '—'}</code>
			</p>
			<p class="keyspace__note">
				The same three letters, encrypted twice with the same start position, six apart: that repetition is what the Polish
				Bureau's sheets and Bletchley Park's bombes attacked.
			</p>
		</>
	);
}
