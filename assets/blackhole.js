/* ==========================================================================
   blackhole.js：Week 6 的黑洞（WebGL2，兩道全螢幕 pass，沒有函式庫）
   pass 1（低解析度）：每個像素沿著被重力彎折的光線往回追（Schwarzschild 光子：a = -1.5·M·h²·p / r⁵）。
     - 掉進事件視界（r < M）就是黑。
     - 穿過赤道面時，在吸積盤的範圍內累加盤的顏色：Kepler 轉速的 fbm 雜訊（越內圈轉越快）、
       朝我們來的那一側變亮偏藍（都卜勒）。盤的後半會被彎到黑洞上方和下方，就是電影裡那個樣子。
     - 逃出去的光線打到黑洞後面的「畫面平面」（uScene：撕開、碎掉的螢幕，由 2D canvas 畫），
       沒打到就看星空和雲氣。所以螢幕碎片在黑洞後面會被扭成光弧和愛因斯坦環。
   pass 2（全解析度）：重力波（往外擴散的漣漪＋四極伸縮）、橫向撕裂、色差、光暈、紅移、閃光、暗角、顆粒。
   M = 0 時光線不彎，畫面平面剛好鋪滿螢幕（一開始看到的就是平常的畫面）；M 變大，畫面就被扭進去。
   ========================================================================== */
(function () {
  "use strict";

  const VS = `#version 300 es
in vec2 aP; out vec2 vUv;
void main() { vUv = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;

  const FS_TRACE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uT;
uniform vec3 uCam, uFwd, uRight, uUp; uniform float uTan;
uniform float uM, uDisk, uStars;
uniform sampler2D uScene; uniform float uSceneOn, uSceneZ; uniform vec2 uSceneHalf;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
vec3 sky(vec3 d) {
  vec3 c = vec3(0.0);
  vec3 q = d * 160.0; vec3 i = floor(q), f = fract(q);
  float h = h3(i);
  if (h > 0.982) { float s = smoothstep(0.42, 0.0, length(f - 0.5)); c += mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), h3(i + 3.1)) * s * (h - 0.982) * 70.0; }
  float n = fbm(d.xy * 2.0 + d.z * 1.7);
  c += vec3(0.13, 0.05, 0.26) * n * n * 1.7 + vec3(0.02, 0.08, 0.18) * fbm(d.yz * 3.3 + 5.0) * 0.9;
  return c * uStars;
}
vec3 diskCol(float x) {           // x：0 內緣（白熱）→ 1 外緣（紫）
  vec3 hot = vec3(1.0, 0.97, 0.93), gold = vec3(1.0, 0.7, 0.3), mag = vec3(0.95, 0.28, 0.5), vio = vec3(0.38, 0.16, 0.78);
  return x < 0.22 ? mix(hot, gold, x / 0.22) : x < 0.58 ? mix(gold, mag, (x - 0.22) / 0.36) : mix(mag, vio, (x - 0.58) / 0.42);
}
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float asp = uRes.x / uRes.y;
  vec3 dir = normalize(uFwd + uRight * ndc.x * uTan * asp + uUp * ndc.y * uTan);
  vec3 p = uCam, v = dir;
  float M = uM;
  vec3 col = vec3(0.0); float acc = 0.0;
  float rin = 3.0 * M, rout = 7.5 * M;
  vec3 L = cross(p, v); float h2 = dot(L, L);
  bool captured = false; float minR = 1e9;
  vec4 scene = vec4(0.0); bool sceneHit = uSceneOn < 0.5;
  for (int i = 0; i < 120; i++) {
    float r = length(p);
    minR = min(minR, r);
    if (M > 0.001 && r < M) { captured = true; break; }
    float dt = clamp(0.055 * r, 0.015, 2.5);
    if (M > 0.001) v += (-1.5 * M * h2 * p / pow(r, 5.0)) * dt;
    vec3 np = p + v * dt;
    // 光線穿過黑洞後面的那張畫面（撕開的螢幕）：記下那裡的顏色，後面的星空只透過透明的地方
    if (!sceneHit && p.z < uSceneZ && np.z >= uSceneZ) {
      vec3 hp = mix(p, np, (uSceneZ - p.z) / (np.z - p.z));
      vec2 uv = hp.xy / uSceneHalf * 0.5 + 0.5;
      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) scene = texture(uScene, uv);
      sceneHit = true;
    }
    if (uDisk > 0.001 && M > 0.001 && p.y * np.y < 0.0) {
      vec3 cp = mix(p, np, p.y / (p.y - np.y));
      float rr = length(cp.xz);
      if (rr > rin && rr < rout) {
        float ang = atan(cp.z, cp.x);
        float om = 1.4 / pow(rr / M, 1.5);
        float n = fbm(vec2(rr / M * 2.4, ang * 3.0 + uT * om * 6.0));
        float n2 = fbm(vec2(rr / M * 7.0, ang * 9.0 + uT * om * 6.0 + 3.0));
        float x = (rr - rin) / (rout - rin);
        // 一圈圈亮帶和暗紋（雜訊取次方，暗的地方更暗）
        float dens = smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.45, x) * (pow(n, 1.8) * 1.6 + 0.25 * n2);
        vec3 vel = normalize(vec3(-cp.z, 0.0, cp.x)) * sqrt(0.5 * M / rr);
        float g = 1.0 / max(0.3, 1.0 - dot(vel, normalize(v)) * 1.4);
        vec3 dc = diskCol(x) * pow(g, 2.5);
        dc = mix(dc, dc * vec3(0.75, 0.95, 1.35), clamp(g - 1.0, 0.0, 1.0));
        float al = clamp(dens, 0.0, 1.0) * uDisk;
        col += (1.0 - acc) * al * dc * 0.62;
        acc += (1.0 - acc) * al;
        if (acc > 0.985) break;
      }
    }
    p = np;
    if (r > 60.0 && dot(p, v) > 0.0) break;
  }
  vec3 bg = captured ? vec3(0.0) : sky(normalize(v));
  bg = scene.rgb + bg * (1.0 - scene.a);
  // 光子球（r = 1.5M）附近擦身而過的光：一圈亮邊
  float rq = (minR - 1.5 * M) / (0.18 * M + 1e-4);
  float ring = M > 0.001 ? exp(-rq * rq) : 0.0;
  vec3 c = col + (1.0 - acc) * bg + vec3(1.0, 0.86, 0.72) * ring * 0.55 * (1.0 - acc) * max(uDisk, 0.35 * step(0.001, M));
  o = vec4(c, 1.0);
}`;

  const FS_POST = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uImg; uniform vec2 uRes; uniform float uT;
uniform float uChroma, uGlitch, uWave, uWaveT0, uQuad, uRed, uDark, uFlash, uGrain, uGlow, uZoom, uStreak;
float hh(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(asp, 1.0);
  // 重力波：從中心往外跑的一圈漣漪（波包），波峰處的色差最重
  float d = length(p), age = uT - uWaveT0, front = age * 0.85;
  float dq = (d - front) / 0.14;
  float env = uWave * exp(-dq * dq) * (1.0 - smoothstep(0.0, 2.6, age)) * step(0.0, age);
  float w = env * sin((d - front) * 20.0);
  vec2 rd = d > 1e-4 ? p / d : vec2(0.0);
  p += rd * w * 0.022;                        // 空間被擠一下再拉開（只有位移，不畫亮圈）
  // 四極伸縮：一個方向拉長、另一個方向壓扁，交替
  float q = uQuad * sin(uT * 8.0) * 0.03;
  p += vec2(p.x, -p.y) * q + vec2(p.y, p.x) * q * 0.6 * cos(uT * 8.0);
  vec2 uv = p / vec2(asp, 1.0) + 0.5;
  // 橫向撕裂：一條條橫帶突然錯開
  float band = floor(uv.y * 26.0), ts = floor(uT * 15.0);
  if (hh(band * 91.7 + ts * 13.1) < uGlitch * 0.33) uv.x += (hh(band * 7.3 + ts * 3.7) - 0.5) * 0.14 * uGlitch;
  vec2 cd = (uv - 0.5) * (uChroma * 0.016 + abs(w) * 0.03) + vec2(uGlitch * 0.007, 0.0);
  vec3 c = vec3(texture(uImg, uv + cd).r, texture(uImg, uv).g, texture(uImg, uv - cd).b);
  // 往裡面掉的時候：從中心往外的速度模糊
  if (uZoom > 0.001) {
    vec3 zs = c; vec2 dz = uv - 0.5;
    for (int k = 1; k < 8; k++) zs += texture(uImg, 0.5 + dz * (1.0 - float(k) * 0.022 * uZoom)).rgb;
    c = zs / 8.0;
  }
  // 橫向的光條（電影鏡頭那種）：只有亮的地方會拉出來
  vec3 an = vec3(0.0);
  for (int k = 1; k <= 6; k++) {
    float fk = float(k), wk = 1.0 - fk / 7.0;
    an += (max(texture(uImg, uv + vec2(fk * 0.014, 0.0)).rgb - 0.62, 0.0) + max(texture(uImg, uv - vec2(fk * 0.014, 0.0)).rgb - 0.62, 0.0)) * wk;
  }
  c += an * vec3(0.5, 0.62, 1.0) * 0.16 * uStreak;
  // 光暈：亮的地方往外暈開一點
  vec3 gl = vec3(0.0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.785398;
    vec2 off = vec2(cos(a), sin(a)) * vec2(1.0 / asp, 1.0);
    gl += max(texture(uImg, uv + off * 0.008).rgb - 0.55, 0.0) + max(texture(uImg, uv + off * 0.02).rgb - 0.55, 0.0);
  }
  c += gl * 0.07 * uGlow;
  c += abs(w) * vec3(0.55, 0.65, 1.0) * 0.12;
  c = vec3(1.0) - exp(-c * 1.45);          // 色調對應：亮的吸積盤不會整片過曝
  float l2 = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(vec3(l2), c, 1.18);              // 色彩飽和一點
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(c, vec3(lum * 1.35, lum * 0.42, lum * 0.22), uRed);
  c *= 1.0 - 0.32 * dot(p, p);
  c += (fract(sin(dot(gl_FragCoord.xy + uT * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * uGrain;
  c = mix(c, vec3(0.0), uDark);
  c += uFlash * vec3(0.92, 0.93, 1.0);
  o = vec4(c, 1.0);
}`;

  function BlackHole(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("no webgl2");
    this.gl = gl; this.canvas = canvas;
    const prog = (fs) => {
      const p = gl.createProgram();
      [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]].forEach(([type, src]) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      });
      gl.bindAttribLocation(p, 0, "aP");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    };
    this.trace = prog(FS_TRACE);
    this.post = prog(FS_POST);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.sceneTex = this.tex();
    this.fbo = null; this.fboTex = null;
    this.q = 0.5;            // 光線追蹤那一道的解析度倍數（會依速度自動調整）
    this.slow = 0; this.fast = 0;
  }
  BlackHole.prototype.tex = function () {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  BlackHole.prototype.resize = function (w, h, dpr) {
    this.W = w; this.H = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.makeFbo();
  };
  BlackHole.prototype.makeFbo = function () {
    const gl = this.gl;
    const fw = Math.max(64, Math.round(this.W * this.q)), fh = Math.max(36, Math.round(this.H * this.q));
    if (this.fbo && this.fw === fw && this.fh === fh) return;
    if (this.fbo) { gl.deleteFramebuffer(this.fbo); gl.deleteTexture(this.fboTex); }
    this.fw = fw; this.fh = fh;
    this.fboTex = this.tex();
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  // 把 2D 畫布（碎掉的螢幕）傳上去當作黑洞後面的那張畫面
  BlackHole.prototype.setScene = function (src) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  };
  /* s：{ t, M, disk, stars, camZ, incl, tanFov, sceneOn, sceneZ, sceneHalf:[x,y],
          chroma, glitch, wave, waveT0, quad, red, dark, flash, grain, glow } */
  BlackHole.prototype.render = function (s, frameMs) {
    const gl = this.gl;
    // 太慢就降低光線追蹤的解析度，很快就提高一點
    if (frameMs) {
      if (frameMs > 24) { this.slow++; this.fast = 0; } else if (frameMs < 12) { this.fast++; this.slow = 0; } else { this.slow = Math.max(0, this.slow - 1); this.fast = 0; }
      if (this.slow > 8 && this.q > 0.3) { this.q = Math.max(0.3, this.q - 0.08); this.slow = 0; this.makeFbo(); }
      if (this.fast > 40 && this.q < 0.75) { this.q = Math.min(0.75, this.q + 0.05); this.fast = 0; this.makeFbo(); }
    }
    const cz = -s.camZ * Math.cos(s.incl), cy = s.camZ * Math.sin(s.incl);
    const len = Math.hypot(cy, cz);
    const fwd = [0, -cy / len, -cz / len];
    const right = [1, 0, 0];
    const up = [0, fwd[2], -fwd[1]];       // cross(fwd, right)
    gl.bindVertexArray(this.vao);
    // pass 1
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.fw, this.fh);
    let u = this.trace.u;
    gl.useProgram(this.trace.p);
    gl.uniform2f(u.uRes, this.fw, this.fh);
    gl.uniform1f(u.uT, s.t);
    gl.uniform3f(u.uCam, 0, cy, cz);
    gl.uniform3fv(u.uFwd, fwd); gl.uniform3fv(u.uRight, right); gl.uniform3fv(u.uUp, up);
    gl.uniform1f(u.uTan, s.tanFov);
    gl.uniform1f(u.uM, s.M); gl.uniform1f(u.uDisk, s.disk); gl.uniform1f(u.uStars, s.stars);
    gl.uniform1f(u.uSceneOn, s.sceneOn); gl.uniform1f(u.uSceneZ, s.sceneZ); gl.uniform2f(u.uSceneHalf, s.sceneHalf[0], s.sceneHalf[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sceneTex); gl.uniform1i(u.uScene, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // pass 2
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    u = this.post.u;
    gl.useProgram(this.post.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fboTex); gl.uniform1i(u.uImg, 0);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uT, s.t);
    gl.uniform1f(u.uChroma, s.chroma); gl.uniform1f(u.uGlitch, s.glitch);
    gl.uniform1f(u.uWave, s.wave); gl.uniform1f(u.uWaveT0, s.waveT0); gl.uniform1f(u.uQuad, s.quad);
    gl.uniform1f(u.uRed, s.red); gl.uniform1f(u.uDark, s.dark); gl.uniform1f(u.uFlash, s.flash);
    gl.uniform1f(u.uGrain, s.grain); gl.uniform1f(u.uGlow, s.glow);
    gl.uniform1f(u.uZoom, s.zoom || 0); gl.uniform1f(u.uStreak, s.streak == null ? 0.6 : s.streak);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  };

  window.BlackHole = BlackHole;
})();
