// The dither field as a WebGL2 fragment shader: the same value noise, ordered-dither threshold,
// cursor pull and rings as the 2D loop in dither-canvas.tsx, but on the GPU, so the banner costs
// the main thread one uniform upload per frame instead of a pass over every cell.

export const MAX_RINGS = 6

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 size;
uniform float scale;
uniform vec2 rotation;
uniform float z;
uniform float density;
uniform float contrast;
uniform float detail;
uniform vec3 color;
uniform int matrixBits;
uniform vec4 hover;      // x, y, strength, displacement / radius
uniform vec2 hoverShape; // radius, boost
uniform float printFront; // print-in front in cells along x; large once printed
uniform float printSpan;  // cells over which a cell steps 0 -> 50% -> 100%
uniform int ringCount;
uniform vec4 rings[${MAX_RINGS}];      // x, y, radius, fade
uniform vec3 ringShape[${MAX_RINGS}];  // width, strength, boost

out vec4 outColor;

float hash(int x, int y, int zi) {
  uint h = uint(x) * 374761393u ^ uint(y) * 668265263u ^ uint(zi) * 2147483647u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float(h ^ (h >> 16u)) / 4294967296.0;
}

float smoothT(float t) { return t * t * (3.0 - 2.0 * t); }

float plane(ivec3 i, vec2 f, int dz) {
  return mix(
    mix(hash(i.x, i.y, i.z + dz), hash(i.x + 1, i.y, i.z + dz), f.x),
    mix(hash(i.x, i.y + 1, i.z + dz), hash(i.x + 1, i.y + 1, i.z + dz), f.x),
    f.y);
}

float noise(vec3 p) {
  vec3 fl = floor(p);
  ivec3 i = ivec3(fl);
  vec3 f = vec3(smoothT(p.x - fl.x), smoothT(p.y - fl.y), smoothT(p.z - fl.z));
  return mix(plane(i, f.xy, 0), plane(i, f.xy, 1), f.z);
}

// Same recursive Bayer matrix as the 2D path: the lowest bit of x and y carries the most weight.
float bayer(ivec2 cell) {
  int value = 0;
  int side = 1 << matrixBits;
  for (int k = 0; k < 3; k++) {
    if (k >= matrixBits) break;
    int xb = (cell.x >> k) & 1;
    int yb = (cell.y >> k) & 1;
    int q = yb * 2 + xb;
    int m = q == 0 ? 0 : q == 1 ? 2 : q == 2 ? 3 : 1;
    value += m << (2 * (matrixBits - 1 - k));
  }
  return (float(value) + 0.5) / float(side * side);
}

void main() {
  // Canvas rows run top to bottom, like the ImageData in the 2D path.
  vec2 cell = vec2(floor(gl_FragCoord.x), size.y - 1.0 - floor(gl_FragCoord.y));
  vec2 s = cell;
  float boost = 0.0;

  if (hover.z > 0.003) {
    vec2 d = cell - hover.xy;
    float d2 = dot(d, d);
    float r = hoverShape.x;
    if (d2 < r * r * 4.0) {
      float falloff = exp(-d2 / (r * r)) * hover.z;
      s -= d * falloff * hover.w;
      boost += falloff * hoverShape.y;
    }
  }

  for (int i = 0; i < ${MAX_RINGS}; i++) {
    if (i >= ringCount) break;
    vec2 d = cell - rings[i].xy;
    float dist = length(d);
    float offset = (dist - rings[i].z) / ringShape[i].x;
    if (offset > -3.0 && offset < 3.0 && dist > 0.0) {
      float strength = exp(-offset * offset) * rings[i].w;
      s -= (d / dist) * strength * ringShape[i].y;
      boost += strength * ringShape[i].z;
    }
  }

  float u = (s.x * rotation.x - s.y * rotation.y) * scale;
  float v = (s.x * rotation.y + s.y * rotation.x) * scale;
  float n = noise(vec3(u, v, z)) * (1.0 - detail) + noise(vec3(u * 2.1 + 31.4, v * 2.1, z * 1.6)) * detail;
  float value = (n - 0.5) * contrast + density + boost;
  float threshold = bayer(ivec2(cell));
  if (value <= threshold) discard;
  // Printing in: behind the front a cell shows in full, just behind it only half the dots (the
  // lower Bayer thresholds), and ahead of it nothing, so the field prints in three steps.
  float printed = clamp((printFront - cell.x) / printSpan, 0.0, 1.0);
  if (printed < 1.0 / 3.0) discard;
  if (printed < 2.0 / 3.0 && threshold > 0.5) discard;
  outColor = vec4(color, 1.0);
}`

export type DitherFrame = {
  width: number
  height: number
  scale: number
  cos: number
  sin: number
  z: number
  density: number
  contrast: number
  detail: number
  rgb: [number, number, number]
  /** Print-in front in cells along x; anything past the canvas width means fully printed. */
  printFront: number
  printSpan: number
  matrixSize: 2 | 4 | 8
  hover: { x: number; y: number; strength: number; displacement: number; radius: number; boost: number }
  rings: { x: number; y: number; radius: number; fade: number; width: number; strength: number; boost: number }[]
}

export type DitherRenderer = { draw: (frame: DitherFrame) => void; dispose: () => void }

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** A GPU renderer for the canvas, or null when WebGL2 is unavailable, so the caller keeps the 2D path. */
export function createDitherRenderer(canvas: HTMLCanvasElement): DitherRenderer | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
  if (!gl) return null
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const at = (name: string) => gl.getUniformLocation(program, name)
  const u = {
    size: at('size'), scale: at('scale'), rotation: at('rotation'), z: at('z'), density: at('density'),
    contrast: at('contrast'), detail: at('detail'), color: at('color'), matrixBits: at('matrixBits'),
    hover: at('hover'), hoverShape: at('hoverShape'), ringCount: at('ringCount'), rings: at('rings'), ringShape: at('ringShape'),
    printFront: at('printFront'), printSpan: at('printSpan'),
  }
  const rings = new Float32Array(MAX_RINGS * 4)
  const ringShape = new Float32Array(MAX_RINGS * 3)

  return {
    draw(frame) {
      gl.viewport(0, 0, frame.width, frame.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(u.size, frame.width, frame.height)
      gl.uniform1f(u.scale, frame.scale)
      gl.uniform2f(u.rotation, frame.cos, frame.sin)
      gl.uniform1f(u.z, frame.z)
      gl.uniform1f(u.density, frame.density)
      gl.uniform1f(u.contrast, frame.contrast)
      gl.uniform1f(u.detail, frame.detail)
      gl.uniform3f(u.color, frame.rgb[0] / 255, frame.rgb[1] / 255, frame.rgb[2] / 255)
      gl.uniform1i(u.matrixBits, Math.log2(frame.matrixSize))
      gl.uniform1f(u.printFront, frame.printFront)
      gl.uniform1f(u.printSpan, Math.max(1, frame.printSpan))
      const { hover } = frame
      gl.uniform4f(u.hover, hover.x, hover.y, hover.strength, hover.displacement / hover.radius)
      gl.uniform2f(u.hoverShape, hover.radius, hover.boost)
      const count = Math.min(frame.rings.length, MAX_RINGS)
      for (let i = 0; i < count; i++) {
        const ring = frame.rings[i]
        rings.set([ring.x, ring.y, ring.radius, ring.fade], i * 4)
        ringShape.set([ring.width, ring.strength, ring.boost], i * 3)
      }
      gl.uniform1i(u.ringCount, count)
      gl.uniform4fv(u.rings, rings)
      gl.uniform3fv(u.ringShape, ringShape)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    },
  }
}
