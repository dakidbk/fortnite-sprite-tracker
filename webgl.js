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

// Surface IDs: 0 plain/printed, 1 wood, 2 stone, 3 plaster, 4 fabric, 5 metal, 6 lawn.
export function material(hex, emission = 0, alpha = 1, sheen = .14, surface = 0) {
  return { rgba: [...rgb(hex), alpha], emission, sheen: surface + clamp(sheen,0,.99) };
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
  layers(levels, mat, smoothSides = false) {
    const rings = levels.map(([x, y, z, w, d, bevel]) => {
      const a = x - w / 2, b = x + w / 2, r = z - d / 2, f = z + d / 2;
      const corners = [[a+bevel,y,r],[a,y,r+bevel],[a,y,f-bevel],[a+bevel,y,f],
        [b-bevel,y,f],[b,y,f-bevel],[b,y,r+bevel],[b-bevel,y,r]];
      if (!smoothSides) return corners;
      return corners.flatMap((point,i) => {
        const next = corners[(i+1)%corners.length];
        return [.18,.82].map(t => point.map((value,axis) => mix(value,next[axis],t)));
      });
    });
    const sides = rings[0].length;
    const normals = smoothSides ? rings.map((ring,j) => ring.map((point,i) => {
      const around = minus(ring[(i+1)%sides],ring[(i+sides-1)%sides]);
      const up = minus(rings[Math.min(j+1,rings.length-1)][i],rings[Math.max(j-1,0)][i]);
      return normal(cross(around,up));
    })) : null;
    for (let j = 1; j < rings.length; j++) {
      const a = rings[j - 1], b = rings[j];
      for (let i = 0; i < sides; i++) {
        const k = (i + 1) % sides;
        if (normals) {
          const lower = normals[j-1], upper = normals[j];
          this.triangle(a[i],a[k],b[k],mat,UV,[lower[i],lower[k],upper[k]]);
          this.triangle(a[i],b[k],b[i],mat,UV,[lower[i],upper[k],upper[i]]);
        } else this.quad(a[i], a[k], b[k], b[i], mat);
      }
    }
    const bottom = rings[0], top = rings.at(-1);
    for (let i = 1; i < sides-1; i++) {
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
uniform float uProperty;
uniform vec4 uLightPos[${LIGHTS}], uLightColor[${LIGHTS}];
uniform sampler2D uTex;
out vec4 pixel;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main() {
  vec4 texel = texture(uTex, vUV) * vColor;
  if (texel.a < .012) discard;
  vec3 N = normalize(vNormal), V = normalize(uEye-vWorld);
  float kind=floor(vSurface.y), sheen=fract(vSurface.y);
  vec3 base=texel.rgb;
  // World-sized detail stays consistent across large walls and small furniture.
  vec2 p=abs(N.y)>.65 ? vWorld.xz : abs(N.x)>.65 ? vWorld.zy : vWorld.xy;
  if (kind>.5) {
    float variation=1.;
    if (kind<1.5) {
      float grain=sin(p.x*48.+noise(p*vec2(2.,.65))*9.+sin(p.y*3.1)*1.6);
      float fine=1.-smoothstep(.012,.065,length(fwidth(p)));
      variation=.95+.055*noise(p*vec2(4.,.7))+.043*grain*fine;
    } else if (kind<2.5) {
      variation=.93+.10*noise(p*15.)+.025*noise(p*67.);
    } else if (kind<3.5) {
      variation=.97+.045*noise(p*23.);
    } else if (kind<4.5) {
      float weave=sin(p.x*210.)*sin(p.y*210.);
      variation=.97+.025*noise(p*38.)+.024*weave*(1.-smoothstep(.005,.018,length(fwidth(p))));
    } else if (kind<5.5) {
      variation=.98+.025*noise(p*vec2(2.,90.));
    } else {
      variation=.86+.21*noise(p*3.)+.07*noise(p*23.);
    }
    base*=variation;
  }
  float outside=max(uProperty,smoothstep(-.38,.67,vWorld.z));
  vec3 key=normalize(mix(vec3(-.35,.86,.55),vec3(-.65,.31,.69),outside));
  float diffuse=max(0.,dot(N,key)), skyExposure=N.y*.5+.5;
  vec3 ambient=mix(mix(vec3(.34,.36,.39),vec3(.64,.69,.72),skyExposure),
    mix(vec3(.25,.28,.34),vec3(.48,.57,.72),skyExposure),outside);
  vec3 direct=mix(vec3(.37,.33,.26),vec3(.47,.29,.17),outside);
  vec3 c=base*(ambient+diffuse*direct);
  float fresnel=pow(1.-max(0.,dot(N,V)),4.);
  float reflectance=pow(max(0.,dot(N,normalize(key+V))),mix(12.,68.,sheen));
  c+=mix(vec3(.34,.43,.50),vec3(.80,.64,.45),diffuse)*reflectance*sheen*.35;
  c+=vec3(.16,.23,.29)*fresnel*sheen*.16;
  for(int i=0;i<${LIGHTS};i++) {
    vec3 ray=uLightPos[i].xyz-vWorld;
    float squaredDistance=dot(ray,ray), reach=uLightPos[i].w;
    if(squaredDistance>=reach*reach) continue;
    float d=sqrt(max(.000001,squaredDistance));
    float falloff=1.-d/reach, amp=falloff*falloff*uLightColor[i].w;
    vec3 L=ray/d;
    float angle=max(0.,dot(N,L));
    float spec=pow(max(0.,dot(N,normalize(L+V))),mix(14.,72.,sheen))*sheen;
    c+=uLightColor[i].rgb*amp*(base*(.095+.78*angle)+.035*angle+.36*spec*angle);
  }
  c=mix(c,base*(1.+max(0.,vSurface.x-1.)*.25),min(vSurface.x,1.));
  // A gentle shoulder keeps ivory lights and pale surfaces from washing out.
  c=c/(1.+max(c-.72,0.)*.23);
  float haze=smoothstep(32.,98.,distance(uEye,vWorld));
  c=mix(c,vec3(.38,.37,.44),haze*.59);
  pixel=vec4(c,texel.a);
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
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float cloud(vec2 p){return noise(p)*.54+noise(p*2.07)*.28+noise(p*4.11)*.13+noise(p*8.13)*.05;}
void main(){
  vec3 right=vec3(uView[0][0],uView[1][0],uView[2][0]);
  vec3 up=vec3(uView[0][1],uView[1][1],uView[2][1]);
  vec3 forward=vec3(uView[0][3],uView[1][3],uView[2][3]);
  vec2 ndc=uv*2.-1.;
  vec3 ray=normalize(forward+ndc.x*right/dot(right,right)+ndc.y*up/dot(up,up));
  float west=pow(max(0.,dot(ray,normalize(vec3(-.43,.035,-.90)))),3.);
  float horizon=exp(-pow((ray.y+.035)*5.5,2.));
  vec3 c=mix(vec3(.12,.21,.34),vec3(.055,.11,.23),smoothstep(.08,.80,ray.y));
  c=mix(c,mix(vec3(.55,.43,.50),vec3(.95,.57,.36),west),horizon*.91);
  c=mix(vec3(.18,.22,.29),c,smoothstep(-.28,-.07,ray.y));
  float angle=atan(ray.x,-ray.z);
  vec2 p=ray.xz*4.8+vec2(ray.y*2.3,ray.y*12.);
  float density=cloud(p+vec2(1.6,-.7));
  float mask=smoothstep(.49,.72,density)*smoothstep(.01,.09,ray.y)*(1.-smoothstep(.35,.65,ray.y));
  vec3 cloudColor=mix(vec3(.29,.34,.45),vec3(.83,.56,.46),west*exp(-ray.y*3.));
  c=mix(c,cloudColor,mask*.67);
  vec3 moon=normalize(vec3(.52,.40,.72));
  float disc=1.-smoothstep(.000075,.00011,1.-dot(ray,moon));
  float cut=1.-smoothstep(.000075,.00011,1.-dot(ray,normalize(moon+vec3(.008,.002,-.004))));
  c+=vec3(.88,.89,.80)*disc*(1.-cut)*.64;
  vec2 grid=vec2(angle,ray.y)*vec2(190.,210.);
  float star=step(.995,hash(floor(grid)))*(1.-smoothstep(.035,.20,length(fract(grid)-.5)));
  c+=vec3(.48,.57,.72)*star*smoothstep(.22,.47,ray.y)*(1.-mask);
  pixel=vec4(c+(hash(floor(gl_FragCoord.xy))-.5)/255.,1.);
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
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){
  // Edge-aware antialiasing preserves cover lettering and softens geometry edges.
  vec2 px=1./vec2(textureSize(uTex,0));
  vec3 center=texture(uTex,uv).rgb;
  float nw=luma(texture(uTex,uv+px*vec2(-1.,-1.)).rgb);
  float ne=luma(texture(uTex,uv+px*vec2(1.,-1.)).rgb);
  float sw=luma(texture(uTex,uv+px*vec2(-1.,1.)).rgb);
  float se=luma(texture(uTex,uv+px*vec2(1.,1.)).rgb);
  float middle=luma(center), low=min(middle,min(min(nw,ne),min(sw,se))), high=max(middle,max(max(nw,ne),max(sw,se)));
  vec3 c=center;
  if(high-low>max(.035,high*.10)) {
    vec2 direction=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
    float reduce=max((nw+ne+sw+se)*.03125,.0078125);
    float inverse=1./(min(abs(direction.x),abs(direction.y))+reduce);
    direction=clamp(direction*inverse,vec2(-6.),vec2(6.))*px;
    vec3 a=.5*(texture(uTex,uv-direction/6.).rgb+texture(uTex,uv+direction/6.).rgb);
    vec3 b=a*.5+.25*(texture(uTex,uv-direction*.5).rgb+texture(uTex,uv+direction*.5).rgb);
    float value=luma(b);
    c=mix(center,value<low || value>high ? a : b,.72);
  }
  c+=texture(uGlow,uv).rgb*.11*(1.-c*.70);
  c=mix(vec3(luma(c)),c,1.055);
  c=(c-.5)*1.035+.5;
  vec2 q=(uv-.5)*vec2(1.12,.93);
  c*=1.-.13*dot(q,q);
  pixel=vec4(clamp(c,0.,1.),1.);
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
    this.anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
    this.canvas = canvas;
    this.gl = gl;
    this.scene = program(gl, sceneVertex, sceneFragment, ['uView','uModel','uEye','uLightPos[0]','uLightColor[0]','uTex','uHiddenSlots','uProperty']);
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
      if (this.anisotropy) {
        const ext=this.anisotropy;
        gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      }
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
    gl.uniform1f(scene.u.uProperty, this.propertyMode ? 1 : 0);
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
