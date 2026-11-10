import { formatKeyspace, type KeyspaceBreakdown } from '@enigma-lab/core';

export interface KeyspaceProps {
	readonly breakdown: KeyspaceBreakdown;
	readonly cables: number;
}

/** Shows where the key space comes from, term by term, plus its strength in bits. */
export function Keyspace({ breakdown, cables }: KeyspaceProps) {
	const rows = [
		['Rotor order', formatKeyspace(breakdown.rotorOrders)],
		['Ring settings', formatKeyspace(breakdown.ringSettings)],
		['Start positions', formatKeyspace(breakdown.startPositions)],
		[`Plugboard (${cables} ${cables === 1 ? 'cable' : 'cables'})`, formatKeyspace(breakdown.plugboard)],
	];
	return (
		<section class="panel" aria-labelledby="keyspace-heading">
			<h2 id="keyspace-heading">Key space</h2>
			<p class="keyspace__total">
				<span>{formatKeyspace(breakdown)}</span>
				<small>keys · {breakdown.bits.toFixed(1)} bits</small>
			</p>
			<dl class="keyspace__grid">
				{rows.map(([term, value]) => (
					<div key={term}>
						<dt>{term}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>
			<p class="keyspace__note">
				Enigma's weakness was never arithmetic: 81 bits was beyond any machine of the era. It was procedure — a
				repeated message key, a letter that could never encode to itself, and operators who chose predictable
				settings.
			</p>
		</section>
	);
}
