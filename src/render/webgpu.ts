/**
 * Renderer capability detection.
 *
 * The plan is a WebGPU path with an SVG fallback. Detection lives here so the UI
 * can report honestly which backend is drawing, and so the fallback is a
 * deliberate choice rather than a silent one.
 */
export type RendererKind = 'webgpu' | 'svg';

export interface RendererReport {
	readonly kind: RendererKind;
	readonly reason: string;
	readonly adapter?: string;
}

/** Resolves the renderer to use, preferring WebGPU when the device offers it. */
export async function detectRenderer(): Promise<RendererReport> {
	if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
		return { kind: 'svg', reason: 'this browser has no navigator.gpu' };
	}
	try {
		const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
		if (!adapter) {
			return { kind: 'svg', reason: 'no WebGPU adapter on this device' };
		}
		const vendor = adapter.info?.vendor;
		return { kind: 'webgpu', reason: 'WebGPU adapter acquired', ...(vendor ? { adapter: vendor } : {}) };
	} catch (error) {
		return { kind: 'svg', reason: `WebGPU init failed: ${(error as Error).message}` };
	}
}
