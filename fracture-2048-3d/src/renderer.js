const VS = `
attribute vec3 aPosition;
attribute vec3 aColor;
attribute vec2 aUV;
uniform mat4 uVP;
varying vec3 vColor;
varying vec3 vWorld;
varying vec2 vUV;
void main(){ vColor=aColor; vUV=aUV; vWorld=aPosition; gl_Position=uVP*vec4(aPosition,1.0); }
`;
const FS = `
precision mediump float;
varying vec3 vColor;
varying vec3 vWorld;
varying vec2 vUV;
uniform sampler2D uAtlas;
uniform vec3 uCamera;
uniform float uAlpha;
void main(){
  vec3 color=texture2D(uAtlas,vUV).rgb*vColor;
  float fog=1.0-exp(-length(vWorld-uCamera)*0.022);
  gl_FragColor=vec4(mix(color,vec3(0.025,0.034,0.043),fog),uAlpha);
}`;

const COLORS = ['#9ecac1', '#68dbc7', '#83b9e3', '#b5a1ed', '#f3bc7e', '#ff8458', '#ff6576', '#e7df88', '#d4ecbc', '#92ddf0', '#f9ead8'];
export const tileColor = (v) => COLORS[Math.min(COLORS.length - 1, Math.max(0, Math.log2(v) - 1))];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const faces = [
  [
    0.86,
    [
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
  ],
  [
    0.58,
    [
      [1, -1, -1],
      [-1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
    ],
  ],
  [
    0.69,
    [
      [1, -1, 1],
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
    ],
  ],
  [
    0.75,
    [
      [-1, -1, -1],
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1],
    ],
  ],
  [
    1,
    [
      [-1, 1, 1],
      [1, 1, 1],
      [1, 1, -1],
      [-1, 1, -1],
    ],
  ],
  [
    0.38,
    [
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
    ],
  ],
];
class Mesh {
  constructor() {
    this.data = [];
  }
  box(x, y, z, w, h, d, hex, value = 0, light = 1) {
    const color = rgb(hex),
      tile = value ? Math.min(15, Math.log2(value)) : 0,
      tx = tile % 4,
      ty = Math.floor(tile / 4),
      uv = [
        [0.012, 0.988],
        [0.988, 0.988],
        [0.988, 0.012],
        [0.012, 0.012],
      ];
    for (const [shade, points] of faces)
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const p = points[i];
        this.data.push(x + (p[0] * w) / 2, y + (p[1] * h) / 2, z + (p[2] * d) / 2, ...color.map((c) => c * shade * light), (tx + uv[i][0]) / 4, (ty + uv[i][1]) / 4);
      }
  }
}
function perspective(aspect, shift) {
  const f = Math.min(1 / Math.tan((58 * Math.PI) / 360), aspect * 1.55),
    n = 0.08,
    z = 130;
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, shift, 0, (z + n) / (n - z), -1, 0, 0, (2 * z * n) / (n - z), 0]);
}
function view(c) {
  const cy = Math.cos(c.yaw),
    sy = Math.sin(c.yaw),
    cp = Math.cos(c.pitch),
    sp = Math.sin(c.pitch),
    r = [cy, 0, sy],
    u = [-sy * sp, cp, cy * sp],
    b = [-sy * cp, -sp, cy * cp];
  const dot = (v) => -(v[0] * c.x + v[1] * c.y + v[2] * c.z);
  return new Float32Array([r[0], u[0], b[0], 0, r[1], u[1], b[1], 0, r[2], u[2], b[2], 0, dot(r), dot(u), dot(b), 1]);
}
function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.gl = gl;
    if (!gl) throw new Error('This chamber needs WebGL. Enable hardware acceleration or try another browser.');
    const compile = (type, code) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.locations = Object.fromEntries(['uVP', 'uAtlas', 'uCamera', 'uAlpha'].map((n) => [n, gl.getUniformLocation(p, n)]));
    this.attributes = ['aPosition', 'aColor', 'aUV'].map((n) => gl.getAttribLocation(p, n));
    this.dynamic = gl.createBuffer();
    this.makeAtlas();
    const scene = this.environment();
    this.staticBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.staticBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(scene.data), gl.STATIC_DRAW);
    this.staticCount = scene.data.length / 8;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.025, 0.034, 0.043, 1);
    this.resetCamera();
    this.particles = [];
    this.dropAnimation = null;
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  }
  makeAtlas() {
    const gl = this.gl,
      c = document.createElement('canvas');
    c.width = c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 1; i < 16; i++) {
      const x = (i % 4) * 256,
        y = Math.floor(i / 4) * 256;
      ctx.fillStyle = '#cbd0cd';
      ctx.fillRect(x + 4, y + 4, 248, 248);
      ctx.fillStyle = '#fafcf6';
      ctx.fillRect(x + 7, y + 7, 242, 242);
      ctx.strokeStyle = '#d1d7d3';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 18, y + 18, 220, 220);
      ctx.fillStyle = '#18242a';
      ctx.font = `700 ${i > 10 ? 58 : i > 6 ? 78 : 102}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(2 ** i), x + 128, y + 131);
      ctx.fillStyle = '#7c8a87';
      ctx.font = '14px monospace';
      ctx.fillText(`F / ${String(i).padStart(2, '0')}`, x + 128, y + 222);
      ctx.fillRect(x + 27, y + 28, 14, 3);
      ctx.fillRect(x + 215, y + 28, 14, 3);
    }
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  environment() {
    const m = new Mesh();
    m.box(0, -6, 0, 7, 0.6, 7, '#23343a');
    m.box(-10, 2.3, 0, 13, 0.4, 34, '#1b252b');
    m.box(10, 2.3, 0, 13, 0.4, 34, '#1b252b');
    m.box(0, 2.3, -10, 7, 0.4, 13, '#1b252b');
    m.box(0, 2.3, 10, 7, 0.4, 13, '#1b252b');
    for (const s of [-1, 1]) {
      m.box(s * 3.6, -1.7, 0, 0.2, 8.4, 7.4, '#263b41');
      m.box(0, -1.7, s * 3.6, 7.4, 8.4, 0.2, '#263b41');
      m.box(s * 3.6, 2.57, 0, 0.22, 0.08, 7.4, '#75c9bc');
      m.box(0, 2.57, s * 3.6, 7.4, 0.08, 0.22, '#75c9bc');
      for (let y = -5.5; y < 3; y++) {
        m.box(s * 3.48, y, 0, 0.03, 0.025, 7, '#3b6466');
        m.box(0, y, s * 3.48, 7, 0.025, 0.03, '#3b6466');
      }
      for (let n = -3; n <= 3; n++) {
        m.box(s * 3.48, -1.7, n, 0.025, 8, 0.025, '#3b6466');
        m.box(n, -1.7, s * 3.48, 0.025, 8, 0.025, '#3b6466');
      }
      for (let n = -16; n <= 16; n += 2) {
        if (Math.abs(n) > 3) m.box(n, 2.515, 0, 0.012, 0.008, 32, '#344149');
        m.box(s * 10, 2.515, n, 12.8, 0.008, 0.012, '#344149');
      }
      m.box(s * 16, 8, 0, 0.4, 11, 34, '#111c23');
      m.box(0, 8, s * 16, 32, 11, 0.4, '#111c23');
      for (let n = -12; n <= 12; n += 4) {
        m.box(n, 8, s * 15.65, 0.28, 11, 0.4, '#23353c');
        m.box(s * 15.65, 8, n, 0.4, 11, 0.28, '#23353c');
        m.box(n, 8, s * 15.4, 0.04, 5, 0.05, s > 0 ? '#dd7547' : '#62b7b0');
      }
    }
    for (let n = -3; n <= 3; n++) {
      m.box(n, -5.65, 0, 0.018, 0.02, 6, '#5c8b89');
      m.box(0, -5.65, n, 6, 0.02, 0.018, '#5c8b89');
    }
    for (let n = 0; n < 24; n++) {
      const p = -3.45 + n * 0.3;
      m.box(p, 2.53, 4, 0.13, 0.02, 0.23, '#c39057');
      m.box(p, 2.53, -4, 0.13, 0.02, 0.23, '#c39057');
      m.box(4, 2.53, p, 0.23, 0.02, 0.13, '#c39057');
      m.box(-4, 2.53, p, 0.23, 0.02, 0.13, '#c39057');
    }
    for (const x of [-5, 5])
      for (const z of [-5, 5]) {
        m.box(x, 4.8, z, 0.25, 4.6, 0.25, '#344850');
        m.box(x, 7.2, z, 0.5, 0.16, 0.5, '#ed915f');
        m.box(x, 3, z, 0.42, 1, 0.42, '#25353e');
        m.box(x, 7, z, 0.03, 0.03, 10, '#3a555c');
      }
    for (let n = -12; n <= 12; n += 4) {
      m.box(n, 13, 0, 0.2, 0.25, 32, '#203039');
      m.box(0, 13, n, 32, 0.25, 0.2, '#203039');
      m.box(n, 12.8, -4, 1.8, 0.05, 0.25, '#9dbeb4');
    }
    m.box(-6, 3.1, 6, 2, 1.2, 1.1, '#2e3d44');
    m.box(-6, 3.75, 6, 1.65, 0.1, 0.8, '#568c83');
    m.box(7, 2.9, -6, 2.5, 0.8, 1.4, '#2b3941');
    for (let i = 0; i < 6; i++) m.box(6.1 + i * 0.34, 3.32, -6, 0.16, 0.04, 0.9, i < 3 ? '#ba7955' : '#587475');
    return m;
  }
  bind(buffer) {
    const g = this.gl;
    g.bindBuffer(g.ARRAY_BUFFER, buffer);
    for (let i = 0; i < 3; i++) {
      g.enableVertexAttribArray(this.attributes[i]);
      g.vertexAttribPointer(this.attributes[i], i === 2 ? 2 : 3, g.FLOAT, false, 32, [0, 12, 24][i]);
    }
  }
  draw(m, alpha = 1) {
    if (!m.data.length) return;
    const g = this.gl;
    this.bind(this.dynamic);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array(m.data), g.DYNAMIC_DRAW);
    g.uniform1f(this.locations.uAlpha, alpha);
    g.drawArrays(g.TRIANGLES, 0, m.data.length / 8);
  }
  burst(events) {
    for (const e of events.slice(-16))
      for (let i = 0; i < 9; i++)
        this.particles.push({
          x: e.x - 2.5,
          y: e.y - 5.1,
          z: e.z - 2.5,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * 3 + 1,
          vz: (Math.random() - 0.5) * 3,
          life: 0.65 + Math.random() * 0.4,
          color: tileColor(e.value),
        });
  }
  render(game, dt, time, { home = false, shake = 0 } = {}) {
    if (this.lost) return;
    const g = this.gl,
      ratio = Math.min(2, devicePixelRatio || 1),
      w = Math.round(this.canvas.clientWidth * ratio),
      h = Math.round(this.canvas.clientHeight * ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      g.viewport(0, 0, w, h);
    }
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    const c = {
      ...this.camera,
      y: this.camera.y + Math.sin(time * 60) * shake,
    };
    g.uniformMatrix4fv(this.locations.uVP, false, multiply(perspective(w / h, home && w / h > 1 ? -0.42 : 0), view(c)));
    g.uniform3f(this.locations.uCamera, c.x, c.y, c.z);
    g.uniform1i(this.locations.uAtlas, 0);
    g.uniform1f(this.locations.uAlpha, 1);
    this.bind(this.staticBuffer);
    g.drawArrays(g.TRIANGLES, 0, this.staticCount);
    const m = new Mesh(),
      ghost = new Mesh();
    for (let x = 0; x < 6; x++)
      for (let z = 0; z < 6; z++)
        for (let y = 0; y < game.board[x][z].length; y++) {
          const v = game.board[x][z][y];
          m.box(x - 2.5, y - 5.1, z - 2.5, 0.94, 0.94, 0.94, tileColor(v), v);
        }
    if (game.active && !['over', 'won'].includes(game.status)) {
      const land = game.landing();
      for (const [dx, dz] of game.active.cells) ghost.box(game.x + dx - 2.5, land - 5.1, game.z + dz - 2.5, 0.96, 0.96, 0.96, '#b7e8ce', game.active.value);
    }
    if (this.dropAnimation) {
      const a = this.dropAnimation;
      a.time += dt;
      const t = Math.min(1, a.time / 0.3);
      for (const c of a.cells) m.box(c.x - 2.5, 3.5 + (c.y - 8.6) * t * t, c.z - 2.5, 0.94, 0.94, 0.94, tileColor(c.value), c.value);
      if (t >= 1) this.dropAnimation = null;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 5 * dt;
      const s = Math.max(0.015, p.life * 0.09);
      m.box(p.x, p.y, p.z, s, s, s, p.color, 0, 1.3);
    }
    this.draw(m);
    g.depthMask(false);
    this.draw(ghost, 0.29 + 0.06 * Math.sin(time * 3));
    g.depthMask(true);
  }
  moveCamera(forward, strafe, dt) {
    const c = this.camera,
      s = 5.2 * dt,
      dx = (Math.sin(c.yaw) * forward + Math.cos(c.yaw) * strafe) * s,
      dz = (-Math.cos(c.yaw) * forward + Math.sin(c.yaw) * strafe) * s,
      valid = (x, z) => Math.abs(x) < 14 && Math.abs(z) < 14 && (Math.abs(x) > 4.1 || Math.abs(z) > 4.1);
    if (valid(c.x + dx, c.z)) c.x += dx;
    if (valid(c.x, c.z + dz)) c.z += dz;
  }
  look(dx, dy) {
    this.camera.yaw += dx * 0.003;
    this.camera.pitch = Math.max(-1.45, Math.min(0.8, this.camera.pitch - dy * 0.003));
  }
  resetCamera() {
    this.camera = { x: 4.3, y: 7.5, z: 4.3, yaw: -Math.PI / 4, pitch: -1.05 };
  }
}
