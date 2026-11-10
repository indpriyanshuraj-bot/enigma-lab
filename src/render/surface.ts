/**
 * One triangle pipeline, three backends.
 *
 * Everything the machine draws ends up here as flat-shaded triangles in screen
 * space. WebGPU rasterises them if the device has an adapter, WebGL2 if it has
 * that, and a 2D canvas if it has neither — the same geometry, the same colours,
 * the same order. Text is not drawn here: it goes on a 2D overlay canvas, which
 * keeps labels crisp on every backend and keeps the fallback honest.
 */
export type Backend = 'webgpu' | 'webgl2' | 'webgl' | 'svg';

export interface Point {
	readonly x: number;
	readonly y: number;
}

export type Rgb = readonly [number, number, number];

export interface Triangle {
	readonly a: Point;
	readonly b: Point;
	readonly c: Point;
	readonly colour: Rgb;
}

export interface Surface {
	readonly backend: Backend;
	/** Why this backend, in words a footer can print. */
	readonly reason: string;
	resize(width: number, height: number, ratio: number): void;
	draw(triangles: readonly Triangle[]): void;
	dispose(): void;
}

const FLOATS_PER_VERTEX = 5; // x, y, r, g, b

function toNdc(point: Point, width: number, height: number): [number, number] {
	return [(point.x / width) * 2 - 1, 1 - (point.y / height) * 2];
}

/** Packs triangles into an interleaved buffer of NDC positions and colours. */
function pack(triangles: readonly Triangle[], width: number, height: number): Float32Array {
	const data = new Float32Array(triangles.length * 3 * FLOATS_PER_VERTEX);
	let offset = 0;
	for (const triangle of triangles) {
		for (const point of [triangle.a, triangle.b, triangle.c]) {
			const [x, y] = toNdc(point, width, height);
			data[offset] = x;
			data[offset + 1] = y;
			data[offset + 2] = triangle.colour[0];
			data[offset + 3] = triangle.colour[1];
			data[offset + 4] = triangle.colour[2];
			offset += FLOATS_PER_VERTEX;
		}
	}
	return data;
}

const WGSL = /* wgsl */ `
struct VertexOut {
	@builtin(position) position: vec4f,
	@location(0) colour: vec3f,
};

@vertex
fn vs(@location(0) position: vec2f, @location(1) colour: vec3f) -> VertexOut {
	var out: VertexOut;
	out.position = vec4f(position, 0.0, 1.0);
	out.colour = colour;
	return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
	return vec4f(in.colour, 1.0);
}
`;

const GLSL_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec3 aColour;
out vec3 vColour;
void main() {
	vColour = aColour;
	gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const GLSL1_VERTEX = `attribute vec2 aPosition;
attribute vec3 aColour;
varying vec3 vColour;
void main() {
	vColour = aColour;
	gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const GLSL1_FRAGMENT = `precision mediump float;
varying vec3 vColour;
void main() {
	gl_FragColor = vec4(vColour, 1.0);
}`;

const GLSL_FRAGMENT = `#version 300 es
precision mediump float;
in vec3 vColour;
out vec4 outColour;
void main() {
	outColour = vec4(vColour, 1.0);
}`;

async function webgpuSurface(canvas: HTMLCanvasElement): Promise<Surface | null> {
	if (!('gpu' in navigator) || !navigator.gpu) return null;
	try {
		const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
		if (!adapter) return null;
		const device = await adapter.requestDevice();
		const context = canvas.getContext('webgpu');
		if (!context) return null;
		const format = navigator.gpu.getPreferredCanvasFormat();
		context.configure({ device, format, alphaMode: 'premultiplied' });

		const module = device.createShaderModule({ code: WGSL });
		const pipeline = device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module,
				entryPoint: 'vs',
				buffers: [
					{
						arrayStride: FLOATS_PER_VERTEX * 4,
						attributes: [
							{ shaderLocation: 0, offset: 0, format: 'float32x2' },
							{ shaderLocation: 1, offset: 8, format: 'float32x3' },
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
		let width = 1;
		let height = 1;
		let disposed = false;

		return {
			backend: 'webgpu',
			reason: 'WebGPU adapter acquired',
			resize(nextWidth, nextHeight, ratio) {
				width = nextWidth;
				height = nextHeight;
				canvas.width = Math.max(1, Math.round(nextWidth * ratio));
				canvas.height = Math.max(1, Math.round(nextHeight * ratio));
			},
			draw(triangles) {
				if (disposed || triangles.length === 0) return;
				try {
					const data = pack(triangles, width, height);
					if (!buffer || capacity < data.byteLength) {
						buffer?.destroy();
						capacity = Math.max(data.byteLength * 2, 8192);
						buffer = device.createBuffer({ size: capacity, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
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
					pass.draw(data.length / FLOATS_PER_VERTEX);
					pass.end();
					device.queue.submit([encoder.finish()]);
				} catch {
					// A lost device must not take the page down; the caller keeps drawing.
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

function webglSurface(canvas: HTMLCanvasElement, version: 2 | 1): Surface | null {
	try {
		const gl =
			version === 2
				? canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true })
				: canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
		if (!gl) return null;

		const compile = (type: number, source: string): WebGLShader | null => {
			const shader = gl.createShader(type);
			if (!shader) return null;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
		};
		const vertex = compile(gl.VERTEX_SHADER, version === 2 ? GLSL_VERTEX : GLSL1_VERTEX);
		const fragment = compile(gl.FRAGMENT_SHADER, version === 2 ? GLSL_FRAGMENT : GLSL1_FRAGMENT);
		const program = gl.createProgram();
		if (!vertex || !fragment || !program) return null;
		gl.attachShader(program, vertex);
		gl.attachShader(program, fragment);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
		gl.useProgram(program);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		const buffer = gl.createBuffer();
		let width = 1;
		let height = 1;
		let disposed = false;

		return {
			backend: version === 2 ? 'webgl2' : 'webgl',
			reason: version === 2 ? 'WebGL2 context acquired' : 'WebGL1 context acquired (WebGL2 unavailable)',
			resize(nextWidth, nextHeight, ratio) {
				width = nextWidth;
				height = nextHeight;
				canvas.width = Math.max(1, Math.round(nextWidth * ratio));
				canvas.height = Math.max(1, Math.round(nextHeight * ratio));
				gl.viewport(0, 0, canvas.width, canvas.height);
			},
			draw(triangles) {
				if (disposed || triangles.length === 0) return;
				const data = pack(triangles, width, height);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
				gl.enableVertexAttribArray(0);
				gl.vertexAttribPointer(0, 2, gl.FLOAT, false, FLOATS_PER_VERTEX * 4, 0);
				gl.enableVertexAttribArray(1);
				gl.vertexAttribPointer(1, 3, gl.FLOAT, false, FLOATS_PER_VERTEX * 4, 8);
				gl.drawArrays(gl.TRIANGLES, 0, data.length / FLOATS_PER_VERTEX);
			},
			dispose() {
				disposed = true;
				gl.deleteBuffer(buffer);
				gl.deleteProgram(program);
			},
		};
	} catch {
		return null;
	}
}

/**
 * The last resort: real SVG polygons in a real SVG element.
 *
 * Slower than a GPU, but it is the one backend that works everywhere — no WebGL
 * at all, no canvas rasterising, and the polygons stay vector-sharp when the page
 * is zoomed. Triangles are grouped by colour so the DOM stays small.
 */
function svgSurface(canvas: HTMLCanvasElement): Surface | null {
	const parent = canvas.parentElement;
	if (!parent) return null;
	canvas.style.display = 'none';
	let svg = parent.querySelector<SVGSVGElement>('svg.rt-svg');
	if (!svg) {
		svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'rt-svg');
		svg.setAttribute('aria-hidden', 'true');
		svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible';
		parent.append(svg);
	}
	let width = 1;
	let height = 1;

	return {
		backend: 'svg',
		reason: 'no GPU context available, drawing vector polygons',
		resize(nextWidth, nextHeight) {
			width = nextWidth;
			height = nextHeight;
			svg?.setAttribute('viewBox', `0 0 ${width} ${height}`);
		},
		draw(triangles) {
			if (!svg) return;
			const groups = new Map<string, string>();
			for (const triangle of triangles) {
				const key = `${Math.round(triangle.colour[0] * 255)},${Math.round(triangle.colour[1] * 255)},${Math.round(triangle.colour[2] * 255)}`;
				const path = groups.get(key) ?? '';
				groups.set(
					key,
					`${path}M${triangle.a.x.toFixed(1)} ${triangle.a.y.toFixed(1)}L${triangle.b.x.toFixed(1)} ${triangle.b.y.toFixed(1)}L${triangle.c.x.toFixed(1)} ${triangle.c.y.toFixed(1)}Z`,
				);
			}
			const nodes: string[] = [];
			for (const [key, path] of groups) {
				nodes.push(`<path d="${path}" fill="rgb(${key})" shape-rendering="crispEdges"/>`);
			}
			svg.innerHTML = nodes.join('');
		},
		dispose() {
			svg?.remove();
		},
	};
}

/**
 * Resolves the best backend this device will give us.
 *
 * Order matters: WebGPU, then WebGL2, then the 2D canvas. A preference can pin
 * it lower — a device with a broken driver is a real thing.
 */
export async function createSurface(
	canvas: HTMLCanvasElement,
	preference: 'auto' | 'webgpu' | 'webgl' | 'svg' = 'auto',
): Promise<Surface> {
	// One ladder, one try/except per rung: every backend receives exactly the same
	// triangle list, so nothing can be missing from one and present in another.
	const order: ('webgpu' | 'webgl2' | 'webgl' | 'svg')[] =
		preference === 'svg'
			? ['svg']
			: preference === 'webgl'
				? ['webgl2', 'webgl', 'svg']
				: preference === 'webgpu'
					? ['webgpu', 'webgl2', 'webgl', 'svg']
					: ['webgpu', 'webgl2', 'webgl', 'svg'];

	for (const backend of order) {
		try {
			if (backend === 'webgpu') {
				const surface = await webgpuSurface(canvas);
				if (surface) return surface;
			} else if (backend === 'webgl2') {
				const surface = webglSurface(canvas, 2);
				if (surface) return surface;
			} else if (backend === 'webgl') {
				const surface = webglSurface(canvas, 1);
				if (surface) return surface;
			} else {
				const surface = svgSurface(canvas);
				if (surface) return surface;
			}
		} catch {
			// Try the next rung.
		}
	}
	throw new Error('no rendering context available');
}
