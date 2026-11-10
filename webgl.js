const TAU = Math.PI * 2;
const STRIDE = 15;
const LIGHTS = 18;

export const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normal = a => {
  const length = Math.hypot(...a) || 1;
  return a.map(x => x / length);
};
const offset = (p, v, n) => p.map((x, i) => x + v[i] * n);

export function rgb(hex) {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export function material(hex, emission = 0, alpha = 1, sheen = .14) {
  return { rgba: [...rgb(hex), alpha], emission, sheen };
}

export function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function model(x, y, z, yaw = 0, pitch = 0, scale = 1) {
  const c = Math.cos(yaw) * scale, s = Math.sin(yaw) * scale;
  const p = Math.cos(pitch), q = Math.sin(pitch);
  return new Float32Array([
    c, 0, -s, 0, s * q, scale * p, c * q, 0, s * p, -scale * q, c * p, 0, x, y, z, 1
  ]);
}

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3];
    }
  }
  return out;
}

export function viewProjection(eye, target, fov, aspect) {
  const f = 1 / Math.tan(fov / 2), near = .12, far = 105;
  const projection = new Float32Array([
    f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0
  ]);
  const z = normal(minus(eye, target));
  const x = normal(cross([0, 1, 0], z));
  const y = cross(z, x);
  const view = new Float32Array([
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
  ]);
  return multiply(projection, view);
}

export function project(matrix, [x, y, z]) {
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  return [
    .5 + .5 * (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    .5 - .5 * (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    w
  ];
}

const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

export class Mesh {
  constructor(texture = null) {
    this.texture = texture;
    this.data = [];
    this.frame = identity;
    this.caseSlot = 0;
  }
  inFrame(x, y, z, yaw, build) {
    const before = this.frame;
    this.frame = multiply(before, model(x, y, z, yaw));
    build(this);
    this.frame = before;
  }
  vert(point, n, mat, uv) {
    const [x, y, z] = point, [nx, ny, nz] = n;
    const m = this.frame;
    this.data.push(
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
      m[0] * nx + m[4] * ny + m[8] * nz,
      m[1] * nx + m[5] * ny + m[9] * nz,
      m[2] * nx + m[6] * ny + m[10] * nz,
      ...mat.rgba, ...uv, mat.emission, mat.sheen, this.caseSlot
    );
  }
  triangle(a, b, c, mat, uv = UV, normals) {
    const n = normal(cross(minus(b, a), minus(c, a)));
    this.vert(a, normals?.[0] || n, mat, uv[0]);
    this.vert(b, normals?.[1] || n, mat, uv[1]);
    this.vert(c, normals?.[2] || n, mat, uv[2]);
  }
  quad(a, b, c, d, mat, uv = UV) {
    const n = normal(cross(minus(b, a), minus(c, a)));
    this.vert(a, n, mat, uv[0]);
    this.vert(b, n, mat, uv[1]);
    this.vert(c, n, mat, uv[2]);
    this.vert(a, n, mat, uv[0]);
    this.vert(c, n, mat, uv[2]);
    this.vert(d, n, mat, uv[3]);
  }
  front(x, y, z, w, h, mat, uv) {
    this.quad([x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z],
      [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z], mat, uv);
  }
  ground(x, y, z, w, d, mat, uv) {
    this.quad([x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2],
      [x + w / 2, y, z - d / 2], [x - w / 2, y, z - d / 2], mat, uv);
  }
  box(x, y, z, w, h, d, mat) {
    const a = x - w / 2, b = x + w / 2, l = y - h / 2, u = y + h / 2;
    const f = z + d / 2, r = z - d / 2;
    this.quad([a,l,f], [b,l,f], [b,u,f], [a,u,f], mat);
    this.quad([b,l,r], [a,l,r], [a,u,r], [b,u,r], mat);
    this.quad([a,l,r], [a,l,f], [a,u,f], [a,u,r], mat);
    this.quad([b,l,f], [b,l,r], [b,u,r], [b,u,f], mat);
    this.quad([a,u,f], [b,u,f], [b,u,r], [a,u,r], mat);
    this.quad([a,l,r], [b,l,r], [b,l,f], [a,l,f], mat);
  }
  layers(levels, mat) {
    const rings = levels.map(([x, y, z, w, d, bevel]) => {
      const a = x - w / 2, b = x + w / 2, r = z - d / 2, f = z + d / 2;
      return [[a+bevel,y,r],[a,y,r+bevel],[a,y,f-bevel],[a+bevel,y,f],[b-bevel,y,f],[b,y,f-bevel],[b,y,r+bevel],[b-bevel,y,r]];
    });
    for (let j = 1; j < rings.length; j++) {
      const a = rings[j - 1], b = rings[j];
      for (let i = 0; i < 8; i++) {
        const k = (i + 1) % 8;
        this.quad(a[i], a[k], b[k], b[i], mat);
      }
    }
    const bottom = rings[0], top = rings.at(-1);
    for (let i = 1; i < 7; i++) {
      this.triangle(top[0], top[i], top[i + 1], mat);
      this.triangle(bottom[0], bottom[i + 1], bottom[i], mat);
    }
  }
  block(x, y, z, w, h, d, bevel, mat) {
    const b = Math.min(bevel, w * .22, h * .22, d * .22);
    this.layers([
      [x, y - h / 2, z, w - b, d - b, b * .55],
      [x, y - h / 2 + b, z, w, d, b],
      [x, y + h / 2 - b, z, w, d, b],
      [x, y + h / 2, z, w - b, d - b, b * .55]
    ], mat);
  }
  polygonXZ(points, y, mat, bottom = null) {
    const top = points.map(([x, z]) => [x, y, z]);
    for (let i = 1; i < top.length - 1; i++) this.triangle(top[0], top[i], top[i + 1], mat);
    if (bottom === null) return;
    const base = points.map(([x, z]) => [x, bottom, z]);
    for (let i = 0; i < top.length; i++) {
      const j = (i + 1) % top.length;
      this.quad(base[i], base[j], top[j], top[i], mat);
    }
  }
  rod(a, b, r1, r2, sides, mat) {
    const axis = normal(minus(b, a));
    const u = normal(cross(Math.abs(axis[1]) > .9 ? [1,0,0] : [0,1,0], axis));
    const v = cross(axis, u);
    let prevA = offset(a, u, r1), prevB = offset(b, u, r2);
    for (let i = 1; i <= sides; i++) {
      const t = TAU * i / sides;
      const q = u.map((x, j) => x * Math.cos(t) + v[j] * Math.sin(t));
      const nextA = offset(a, q, r1), nextB = offset(b, q, r2);
      this.quad(prevA, nextA, nextB, prevB, mat);
      if (r1 > 0) this.triangle(a, nextA, prevA, mat);
      if (r2 > 0) this.triangle(b, prevB, nextB, mat);
      prevA = nextA;
      prevB = nextB;
    }
  }
  ellipsoid(x, y, z, rx, ry, rz, sides, bands, mat, faceted = false) {
    const coords = (i, j) => {
      const t = TAU * i / sides, p = Math.PI * j / bands;
      const q = [Math.cos(t) * Math.sin(p), Math.cos(p), Math.sin(t) * Math.sin(p)];
      return [[x + rx * q[0], y + ry * q[1], z + rz * q[2]], normal([q[0] / rx, q[1] / ry, q[2] / rz])];
    };
    for (let j = 0; j < bands; j++) {
      for (let i = 0; i < sides; i++) {
        const a = coords(i, j), b = coords(i + 1, j), c = coords(i + 1, j + 1), d = coords(i, j + 1);
        if (j) this.triangle(a[0], b[0], c[0], mat, UV, faceted ? undefined : [a[1], b[1], c[1]]);
        if (j < bands - 1) this.triangle(a[0], c[0], d[0], mat, UV, faceted ? undefined : [a[1], c[1], d[1]]);
      }
    }
  }
}

const sceneVertex = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aColor;
layout(location=3) in vec2 aUV;
layout(location=4) in vec2 aSurface;
layout(location=5) in float aCaseSlot;
uniform mat4 uView, uModel;
uniform sampler2D uHiddenSlots;
out vec3 vWorld, vNormal;
out vec4 vColor;
out vec2 vUV, vSurface;
flat out int vCaseSlot;
invariant gl_Position;
void main() {
  vCaseSlot = int(aCaseSlot);
  if (vCaseSlot > 0 && texelFetch(uHiddenSlots,ivec2(vCaseSlot,0),0).r > .5) {
    gl_Position = vec4(2.,0.,0.,1.);
    return;
  }
  vec4 world = uModel * vec4(aPos,1.);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vColor = aColor;
  vUV = aUV;
  vSurface = aSurface;
  gl_Position = uView * world;
}`;

const sceneFragment = `#version 300 es
precision highp float;
in vec3 vWorld, vNormal;
in vec4 vColor;
in vec2 vUV, vSurface;
uniform vec3 uEye;
uniform vec4 uLightPos[${LIGHTS}], uLightColor[${LIGHTS}];
uniform sampler2D uTex;
out vec4 pixel;
void main() {
  vec4 texel = texture(uTex, vUV) * vColor;
  if (texel.a < .012) discard;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vWorld);
  float outside = smoothstep(-.38,.67,vWorld.z);
  vec3 key = normalize(mix(vec3(-.35,.86,.55),vec3(-.79,.35,.34),outside));
  float diffuse = max(0.,dot(N,key));
  vec3 base = texel.rgb;
  vec3 ambient = mix(vec3(.67,.70,.69),vec3(.35,.40,.59),outside);
  vec3 direct = mix(vec3(.36,.32,.27),vec3(.29,.20,.16),outside);
  vec3 c = base * (ambient + diffuse * direct);
  float reflectance = pow(max(0.,dot(N,normalize(key+V))),18.);
  c += vec3(.40,.43,.41) * reflectance * vSurface.y * .33;
  for (int i=0; i<${LIGHTS}; i++) {
    vec3 ray = uLightPos[i].xyz - vWorld;
    float squaredDistance = dot(ray,ray);
    float reach = uLightPos[i].w;
    if (squaredDistance >= reach * reach) continue;
    float d = sqrt(max(.000001,squaredDistance));
    float falloff = 1. - d / reach;
    float amp = falloff * falloff * uLightColor[i].w;
    vec3 L = ray / d;
    float angle = max(0.,dot(N,L));
    float spec = pow(max(0.,dot(N,normalize(L+V))),22.) * vSurface.y;
    c += uLightColor[i].rgb * amp * (base * (.23 + .78 * angle) + .15 * angle + .43 * spec);
  }
  c = mix(c, base * (1. + max(0.,vSurface.x - 1.) * .25), min(vSurface.x,1.));
  float haze = smoothstep(28.,79.,distance(uEye,vWorld));
  c = mix(c,vec3(.27,.28,.37),haze*.60);
  pixel = vec4(c,texel.a);
}`;

const screenVertex = `#version 300 es
out vec2 uv;
void main(){
  uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(uv * 2. - 1.,0.,1.);
}`;

const skyFragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform mat4 uView;
out vec4 pixel;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void main(){
  vec3 right = vec3(uView[0][0],uView[1][0],uView[2][0]);
  vec3 up = vec3(uView[0][1],uView[1][1],uView[2][1]);
  vec3 forward = vec3(uView[0][3],uView[1][3],uView[2][3]);
  vec2 ndc = uv * 2. - 1.;
  vec3 ray = normalize(forward + ndc.x * right / dot(right,right) + ndc.y * up / dot(up,up));

  float west = pow(max(0.,dot(ray,vec3(-.43,0.,-.90))),12.);
  float band = (ray.y + .017) * 14.;
  vec3 horizon = mix(vec3(.45,.31,.53),vec3(.95,.46,.37),west);
  vec3 c = mix(vec3(.115,.161,.27),horizon,.86 * exp(-band * band));
  c = mix(c,vec3(.082,.128,.235),smoothstep(.035,.155,ray.y));
  c = mix(vec3(.105,.137,.202),c,smoothstep(-.29,-.075,ray.y));

  float cloud = (ray.y - .039 - sin(ray.x * 8. + ray.z * 3.) * .009) * 132.;
  float wisps = exp(-cloud * cloud) * (.46 + .46 * sin(ray.x * 12. - ray.z));
  vec3 cloudColor = mix(vec3(.48,.40,.55),vec3(.83,.57,.48),west);
  c = mix(c,cloudColor,wisps * .33);
  vec2 starGrid = vec2(atan(ray.x,-ray.z),ray.y) * vec2(205.,215.);
  float star = step(.989,hash(floor(starGrid))) * (1. - smoothstep(.04,.26,length(fract(starGrid)-.5)));
  c += vec3(.58,.68,.94) * star * smoothstep(.09,.26,ray.y);
  float noise = hash(floor(gl_FragCoord.xy)) - .5;
  pixel = vec4(c + noise*.011,1.);
}`;

const blurFragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D uTex;
uniform vec2 uStep;
uniform bool uExtract;
out vec4 pixel;
vec3 sampleAt(vec2 p){
  vec3 c=texture(uTex,p).rgb;
  if (!uExtract) return c;
  float brightest=max(c.r,max(c.g,c.b));
  return c * smoothstep(.82,1.,brightest);
}
void main(){
  vec3 c=sampleAt(uv)*.227027;
  c+=(sampleAt(uv + uStep*1.3846)+sampleAt(uv - uStep*1.3846))*.316216;
  c+=(sampleAt(uv + uStep*3.2308)+sampleAt(uv - uStep*3.2308))*.070270;
  pixel=vec4(c,1.);
}`;

const finalFragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D uTex, uGlow;
out vec4 pixel;
void main(){
  vec3 c = texture(uTex,uv).rgb;
  vec3 glow = texture(uGlow,uv).rgb;
  c += glow * .14 * (1. - c * .66);
  vec2 q = (uv-.5)*vec2(1.12,.93);
  c *= 1. - .18 * dot(q,q);
  pixel = vec4(c,1.);
}`;

const caseFragment = `#version 300 es
precision highp float;
precision highp int;
flat in int vCaseSlot;
out vec4 pixel;
void main() {
  pixel = vec4(float(vCaseSlot & 255),float(vCaseSlot >> 8),0.,255.) / 255.;
}`;

function program(gl, vertex, fragment, uniforms) {
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const p = gl.createProgram();
  const vert = compile(gl.VERTEX_SHADER, vertex), frag = compile(gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(p, vert);
  gl.attachShader(p, frag);
  gl.linkProgram(p);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return { p, u: Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(p, name)])) };
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL 2 is unavailable');
    this.canvas = canvas;
    this.gl = gl;
    this.scene = program(gl, sceneVertex, sceneFragment, ['uView','uModel','uEye','uLightPos[0]','uLightColor[0]','uTex','uHiddenSlots']);
    this.sky = program(gl, screenVertex, skyFragment, ['uView']);
    this.blur = program(gl, screenVertex, blurFragment, ['uTex','uStep','uExtract']);
    this.final = program(gl, screenVertex, finalFragment, ['uTex','uGlow']);
    this.casePicker = program(gl, sceneVertex, caseFragment, ['uView','uModel','uHiddenSlots']);
    this.casePixel = new Uint8Array(4);
    this.screen = gl.createVertexArray();
    this.white = this.texture(null);
    this.hiddenSlotsTexture = gl.createTexture();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  texture(source) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (source) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  setHiddenSlots(slots) {
    const { gl } = this;
    if (gl.isContextLost()) return;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.hiddenSlotsTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, slots.length, 1, 0, gl.RED, gl.UNSIGNED_BYTE, slots);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
  }
  upload(mesh) {
    const gl = this.gl;
    mesh.vao = gl.createVertexArray();
    gl.bindVertexArray(mesh.vao);
    mesh.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.data), gl.STATIC_DRAW);
    let index = 0;
    [3,3,4,2,2,1].forEach((size, attribute) => {
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, STRIDE * 4, index * 4);
      index += size;
    });
    mesh.count = mesh.data.length / STRIDE;
    mesh.data = null;
    gl.bindVertexArray(null);
    return mesh;
  }
  release(mesh) {
    this.gl.deleteVertexArray(mesh.vao);
    this.gl.deleteBuffer(mesh.buffer);
    if (mesh.texture) this.gl.deleteTexture(mesh.texture);
  }
  target(width, height, withDepth) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const param of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, param, gl.LINEAR);
    for (const param of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, param, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let depth;
    if (withDepth) {
      depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete WebGL framebuffer');
    return { fbo, tex, width, height, depth };
  }
  resize() {
    const { canvas, gl } = this;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const scale = Math.min(devicePixelRatio || 1, 1.65, Math.sqrt(2400000 / Math.max(1, w * h)));
    const width = Math.max(1, Math.round(w * scale)), height = Math.max(1, Math.round(h * scale));
    if (this.main?.width === width && this.main.height === height) return;
    for (const target of [this.main, this.bloomX, this.bloomY]) {
      if (!target) continue;
      gl.deleteFramebuffer(target.fbo);
      gl.deleteTexture(target.tex);
      if (target.depth) gl.deleteRenderbuffer(target.depth);
    }
    canvas.width = width;
    canvas.height = height;
    this.main = this.target(width, height, true);
    this.bloomX = this.target(Math.max(1, width >> 2), Math.max(1, height >> 2), false);
    this.bloomY = this.target(this.bloomX.width, this.bloomX.height, false);
  }
  lights(lights) {
    this.lightPos = new Float32Array(LIGHTS * 4);
    this.lightColor = new Float32Array(LIGHTS * 4);
    for (let i = 0; i < LIGHTS; i++) {
      const [position, color, radius, strength] = lights[i] || [[0,0,0], '#ffffff', 1, 0];
      this.lightPos.set([...position, radius], i * 4);
      this.lightColor.set([...rgb(color), strength], i * 4);
    }
  }
  begin(view, eye) {
    const { gl, main, sky, scene } = this;
    this.lastView = view;
    gl.bindFramebuffer(gl.FRAMEBUFFER, main.fbo);
    gl.viewport(0, 0, main.width, main.height);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(sky.p);
    gl.bindVertexArray(this.screen);
    gl.uniformMatrix4fv(sky.u.uView, false, view);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(scene.p);
    gl.uniformMatrix4fv(scene.u.uView, false, view);
    gl.uniform3fv(scene.u.uEye, eye);
    gl.uniform4fv(scene.u['uLightPos[0]'], this.lightPos);
    gl.uniform4fv(scene.u['uLightColor[0]'], this.lightColor);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(scene.u.uTex, 0);
    gl.uniform1i(scene.u.uHiddenSlots, 2);
  }
  blend(on) {
    const { gl } = this;
    if (on) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.depthMask(!on);
  }
  draw(mesh, matrix = identity) {
    const { gl, scene } = this;
    gl.uniformMatrix4fv(scene.u.uModel, false, matrix);
    gl.bindVertexArray(mesh.vao);
    gl.bindTexture(gl.TEXTURE_2D, mesh.texture || this.white);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
  end() {
    const { gl, main, bloomX, bloomY, blur, final } = this;
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.screen);
    gl.useProgram(blur.p);
    gl.uniform1i(blur.u.uTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomX.fbo);
    gl.viewport(0, 0, bloomX.width, bloomX.height);
    gl.bindTexture(gl.TEXTURE_2D, main.tex);
    gl.uniform1i(blur.u.uExtract, 1);
    gl.uniform2f(blur.u.uStep, 1 / bloomX.width, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomY.fbo);
    gl.bindTexture(gl.TEXTURE_2D, bloomX.tex);
    gl.uniform1i(blur.u.uExtract, 0);
    gl.uniform2f(blur.u.uStep, 0, 1 / bloomY.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, main.width, main.height);
    gl.useProgram(final.p);
    gl.bindTexture(gl.TEXTURE_2D, main.tex);
    gl.uniform1i(final.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomY.tex);
    gl.uniform1i(final.u.uGlow, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
  pickCase(cases, x, y) {
    const { gl, main, casePicker, casePixel, lastView } = this;
    if (!lastView || gl.isContextLost() || x < 0 || x >= 1 || y < 0 || y >= 1) return 0;
    const px = Math.floor(x * main.width), py = main.height - 1 - Math.floor(y * main.height);
    // Reuse the scene depth to select only visible cover surfaces.
    gl.bindFramebuffer(gl.FRAMEBUFFER,main.fbo);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(px,py,1,1);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.DITHER);
    gl.useProgram(casePicker.p);
    gl.uniformMatrix4fv(casePicker.u.uView,false,lastView);
    gl.uniformMatrix4fv(casePicker.u.uModel,false,identity);
    gl.uniform1i(casePicker.u.uHiddenSlots,2);
    for (const mesh of cases) {
      gl.bindVertexArray(mesh.vao);
      gl.drawArrays(gl.TRIANGLES,0,mesh.count);
    }
    casePixel.fill(0);
    gl.readPixels(px,py,1,1,gl.RGBA,gl.UNSIGNED_BYTE,casePixel);
    gl.enable(gl.DITHER);
    gl.depthMask(true);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return casePixel[0] | (casePixel[1] << 8);
  }
}
