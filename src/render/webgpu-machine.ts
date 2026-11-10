/**
 * WebGPU painter for the machine view.
 *
 * The library projects the scene on the CPU, so the GPU's job here is honest and
 * small: rasterise the rotor discs, shade them, and nothing else. Letters,
 * captions, focus rings and every control stay in SVG on top, which keeps the
 * page accessible and the fallback path identical.
 *
 * Every failure path returns `null` so the caller can fall back to SVG: no
 * adapter, no device, a lost context, an unparseable colour.
 */
import type { MachineScene, RenderTheme } from '@enigma-lab/core/render';

export interface GpuPalette {
	readonly body: [number, number, number];
	readonly ring: [number, number, number];
	readonly notch: [number, number, number];
}

export interface GpuMachine {
	readonly kind: 'webgpu';
	/** Draws one frame. `width`/`height` are CSS pixels. */
	draw(scene: MachineScene, palette: GpuPalette, width: number, height: number): void;
	dispose(): void;
}

const VERTEX_FLOATS = 10; // x, y, localX, localY, bodyRGB, ringRGB
const SEGMENTS = 64;

const SHADER = /* wgsl */ `
struct VertexOut {
	@builtin(position) position: vec4f,
	@location(0) local: vec2f,
	@location(1) body: vec3f,
	@location(2) ring: vec3f,
};

@vertex
fn vs(
	@location(0) position: vec2f,
	@location(1) local: vec2f,
	@location(2) body: vec3f,
	@location(3) ring: vec3f,
) -> VertexOut {
	var out: VertexOut;
	out.position = vec4f(position, 0.0, 1.0);
	out.local = local;
	out.body = body;
	out.ring = ring;
	return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
	let radius = length(in.local);
	let ring = smoothstep(0.54, 0.58, radius) * (1.0 - smoothstep(0.62, 0.66, radius));
	let shade = 0.82 + 0.18 * clamp(1.0 - (in.local.y * 0.5 + 0.5), 0.0, 1.0);
	let colour = mix(in.body, in.ring, ring) * shade;
	return vec4f(colour, 1.0);
}
`;

/** Parses `#rgb`, `#rrggbb` or `rgb(r, g, b)` into linear-ish 0..1 components. */
export function parseColour(value: string): [number, number, number] | null {
	const text = value.trim();
	const hex = text.startsWith('#') ? text.slice(1) : null;
	if (hex) {
		if (hex.length === 3) {
			const [r, g, b] = [...hex].map((char) => Number.parseInt(char + char, 16) / 255);
			return r !== undefined && g !== undefined && b !== undefined ? [r, g, b] : null;
		}
		if (hex.length === 6) {
			const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
			const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
			const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
			return [r, g, b].every(Number.isFinite) ? [r, g, b] : null;
		}
		return null;
	}
	const match = text.match(/^rgba?\(([^)]+)\)$/i);
	if (!match?.[1]) return null;
	const parts = match[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
	if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
	return parts.map((part) => part / 255) as [number, number, number];
}

/** Reads the palette from CSS custom properties, so the page keeps one source of truth. */
export function paletteFromCss(root: HTMLElement = document.documentElement): GpuPalette {
	const read = (name: string, fallback: string): [number, number, number] =>
		parseColour(getComputedStyle(root).getPropertyValue(name)) ?? (parseColour(fallback) as [number, number, number]);
	return {
		body: read('--rotor', '#22303e'),
		ring: read('--rotor-ring', '#2b3b4c'),
		notch: read('--rotor-notch', '#3d3220'),
	};
}

/** Builds the vertex buffer for one frame: one ellipse per rotor, back to front. */
function buildVertices(scene: MachineScene, palette: GpuPalette, width: number, height: number): Float32Array {
	const spanX = Math.max(scene.bounds.maxX - scene.bounds.minX, 1);
	const spanY = Math.max(scene.bounds.maxY - scene.bounds.minY, 1);
	const toNdcX = (x: number): number => ((x - scene.bounds.minX) / spanX) * 2 - 1;
	const toNdcY = (y: number): number => 1 - ((y - scene.bounds.minY) / spanY) * 2;
	const squash = Math.abs(Math.sin(scene.camera.pitch)) || 0.35;

	const discs = [...scene.rotors].reverse().map((rotor) => ({
		x: rotor.center.x,
		y: rotor.center.y,
		rx: rotor.slot.radius,
		ry: rotor.slot.radius * squash,
		body: rotor.atNotch ? palette.notch : palette.body,
		ring: palette.ring,
	}));
	discs.push({
		x: scene.reflector.center.x,
		y: scene.reflector.center.y,
		rx: scene.reflector.radius,
		ry: scene.reflector.radius * squash,
		body: palette.ring,
		ring: palette.body,
	});

	const data = new Float32Array(discs.length * SEGMENTS * 3 * VERTEX_FLOATS);
	let offset = 0;
	const push = (
		point: { x: number; y: number },
		local: { x: number; y: number },
		body: [number, number, number],
		ring: [number, number, number],
	): void => {
		data[offset] = toNdcX(point.x);
		data[offset + 1] = toNdcY(point.y);
		data[offset + 2] = local.x;
		data[offset + 3] = local.y;
		data[offset + 4] = body[0];
		data[offset + 5] = body[1];
		data[offset + 6] = body[2];
		data[offset + 7] = ring[0];
		data[offset + 8] = ring[1];
		data[offset + 9] = ring[2];
		offset += VERTEX_FLOATS;
	};

	for (const disc of discs) {
		for (let segment = 0; segment < SEGMENTS; segment += 1) {
			const a = (segment / SEGMENTS) * Math.PI * 2;
			const b = ((segment + 1) / SEGMENTS) * Math.PI * 2;
			push({ x: disc.x, y: disc.y }, { x: 0, y: 0 }, disc.body, disc.ring);
			push(
				{ x: disc.x + Math.cos(a) * disc.rx, y: disc.y - Math.sin(a) * disc.ry },
				{ x: Math.cos(a), y: Math.sin(a) },
				disc.body,
				disc.ring,
			);
			push(
				{ x: disc.x + Math.cos(b) * disc.rx, y: disc.y - Math.sin(b) * disc.ry },
				{ x: Math.cos(b), y: Math.sin(b) },
				disc.body,
				disc.ring,
			);
		}
	}
	void width;
	void height;
	return data;
}

/** Creates the painter, or resolves `null` when this device cannot run it. */
export async function createGpuMachine(canvas: HTMLCanvasElement): Promise<GpuMachine | null> {
	if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) return null;
	try {
		const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
		if (!adapter) return null;
		const device = await adapter.requestDevice();
		const context = canvas.getContext('webgpu');
		if (!context) return null;

		const format = navigator.gpu.getPreferredCanvasFormat();
		context.configure({ device, format, alphaMode: 'premultiplied' });

		const module = device.createShaderModule({ code: SHADER });
		const pipeline = device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module,
				entryPoint: 'vs',
				buffers: [
					{
						arrayStride: VERTEX_FLOATS * 4,
						attributes: [
							{ shaderLocation: 0, offset: 0, format: 'float32x2' },
							{ shaderLocation: 1, offset: 8, format: 'float32x2' },
							{ shaderLocation: 2, offset: 16, format: 'float32x3' },
							{ shaderLocation: 3, offset: 28, format: 'float32x3' },
						],
					},
				],
			},
			fragment: {
				module,
				entryPoint: 'fs',
				targets: [
					{
						format,
						blend: {
							color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
							alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
						},
					},
				],
			},
			primitive: { topology: 'triangle-list' },
		});

		let buffer: GPUBuffer | null = null;
		let capacity = 0;
		let disposed = false;

		return {
			kind: 'webgpu',
			draw(scene, palette, width, height) {
				if (disposed) return;
				try {
					const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
					const pixelWidth = Math.max(1, Math.round(width * ratio));
					const pixelHeight = Math.max(1, Math.round(height * ratio));
					if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
					if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

					const data = buildVertices(scene, palette, pixelWidth, pixelHeight);
					if (data.length === 0) return;
					if (!buffer || capacity < data.byteLength) {
						buffer?.destroy();
						capacity = Math.max(data.byteLength, capacity * 2, 4096);
						buffer = device.createBuffer({
							size: capacity,
							usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
						});
					}
					device.queue.writeBuffer(buffer, 0, data);

					const encoder = device.createCommandEncoder();
					const pass = encoder.beginRenderPass({
						colorAttachments: [
							{
								view: context.getCurrentTexture().createView(),
								clearValue: { r: 0, g: 0, b: 0, a: 0 },
								loadOp: 'clear',
								storeOp: 'store',
							},
						],
					});
					pass.setPipeline(pipeline);
					pass.setVertexBuffer(0, buffer);
					pass.draw(data.length / VERTEX_FLOATS);
					pass.end();
					device.queue.submit([encoder.finish()]);
				} catch {
					// A lost device or a driver hiccup must not take the page down.
				}
			},
			dispose() {
				disposed = true;
				buffer?.destroy();
				buffer = null;
				device.destroy();
			},
		};
	} catch {
		return null;
	}
}

/** Theme helper for callers that only have a {@link RenderTheme}. */
export function paletteFromTheme(theme: RenderTheme): GpuPalette | null {
	const body = parseColour(theme.rotorBody);
	const ring = parseColour(theme.rotorRing);
	const notch = parseColour(theme.rotorAtNotch);
	return body && ring && notch ? { body, ring, notch } : null;
}
