import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CARS, RATE, partOf, naira, dollars, km } from './cars.js';
import { createEngine } from './engine.js';

const V3 = THREE.Vector3;
const $ = s => document.querySelector(s);
const body = document.body;
const GAP = 6.4, YAW = -0.8, N = CARS.length;
const bayX = i => i * GAP;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const isTouch = matchMedia('(pointer: coarse)').matches;
const engine = createEngine();

/* ---------- renderer, camera, post ---------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = window.__capDPR || Math.min(devicePixelRatio, isTouch ? 1.5 : 1.6); // __capDPR: still captures only
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const BG_LOT = new THREE.Color(0x050506);
scene.background = BG_LOT.clone();
const fogLot = new THREE.Fog(0x050506, 12, 58);
const fogStudio = new THREE.Fog(0x0b0b0c, 9, 24);
const fogWater = new THREE.Fog(0x000000, 1e5, 2e5);
scene.fog = fogLot;
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 140);

const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(DPR);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.24, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uGrain: { value: 0.014 }, uVig: { value: 0.85 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uFade, uGrain, uVig; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - .5) * vec2(1.0, .82);
      c.rgb *= mix(1.0, smoothstep(.86, .18, length(d)), uVig);
      float l = dot(c.rgb, vec3(.2126, .7152, .0722));
      c.rgb += vec3(-.006, -.001, .01) * (1. - l) + vec3(.012, .005, -.01) * l;
      c.rgb += (hash(vUv * 1024. + fract(uTime * 7.31) * 97.) - .5) * uGrain;
      c.rgb *= 1. - uFade;
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);

/* ---------- tweens ---------- */
const tweens = new Set();
function tween(dur, fn, ez = ease) {
  return new Promise(res => { const t = { t0: performance.now(), dur: Math.max(1, dur), fn, ez, res }; tweens.add(t); fn(0); });
}
function runTweens(now) {
  for (const t of tweens) { const k = clamp((now - t.t0) / t.dur, 0, 1); t.fn(t.ez(k)); if (k >= 1) { tweens.delete(t); t.res(); } }
}
const fadeTo = (v, ms) => { const a = grade.uniforms.uFade.value; return tween(reduce ? 1 : ms, k => { grade.uniforms.uFade.value = a + (v - a) * k; }, k => k); };

/* ---------- loading ---------- */
const manager = new THREE.LoadingManager();
let glbFrac = 0, items = [0, 1], shownPct = 0;
manager.onProgress = (u, l, t) => { items = [l, t]; };
const draco = new DRACOLoader(manager).setDecoderPath('vendor/three/examples/jsm/libs/draco/gltf/');
const gltfL = new GLTFLoader(manager).setDRACOLoader(draco);
const rgbe = new RGBELoader(manager);
const texL = new THREE.TextureLoader(manager);
const load = (l, url, onP) => new Promise((res, rej) => l.load(url, res, onP, rej));
// the loader car: rolls the road with the load, wheels turning with the distance, then launches
const ld = { el: $('#ld'), rig: $('#ldRig'), fill: $('#ldFill'), wh: [...document.querySelectorAll('#ldRig .wh')], done: false, x: 0, rot: 0, tw: 0, cw: 0, go: 0, last: 0 };
const ldSize = () => { ld.tw = ld.el.clientWidth; ld.cw = ld.rig.clientWidth; };
ldSize(); addEventListener('resize', ldSize);
const ldReady = () => reduce || (ld.fullT && performance.now() - ld.fullT > 420); // a beat on the line, then go
function ldTick(now) {
  if (ld.go) return;
  const dt = Math.min(0.05, (now - (ld.last || now)) / 1000); ld.last = now;
  const p = ld.done ? 1 : Math.min(0.97, glbFrac * 0.72 + (items[0] / Math.max(1, items[1])) * 0.28);
  shownPct += clamp((p * 100 - shownPct) * (1 - Math.exp(-dt * (ld.done ? 3.2 : 2.4))), 0, 62 * dt);
  if (shownPct > 99.6) { shownPct = 100; ld.fullT ||= now; }
  const x = shownPct / 100 * (ld.tw - ld.cw);
  ld.rot += (x - ld.x) / (ld.cw * 0.0779) * 57.2958; ld.x = x;
  ld.rig.style.transform = `translate3d(${x}px,0,0)`;
  for (const w of ld.wh) w.style.transform = `rotate(${ld.rot}deg)`;
  ld.fill.style.transform = `scaleX(${shownPct / 100})`;
  ld.el.classList.toggle('full', shownPct >= 100);
  requestAnimationFrame(ldTick);
}
// the launch runs on the compositor, so the lot's first heavy frames can't make it stutter
function ldLaunch() {
  ld.go = performance.now();
  const N = 14, T = 1.1, a = innerWidth * 2.2, r = ld.cw * 0.0779, kf = [], wk = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N * T, dx = 0.5 * a * t * t, tilt = -1.6 * Math.sin(Math.min(1, t / 0.5) * Math.PI);
    kf.push({ transform: `translate3d(${ld.x + dx}px,0,0) rotate(${tilt}deg)` });
    wk.push({ transform: `rotate(${ld.rot + dx / r * 57.2958}deg)` });
  }
  ld.rig.animate(kf, { duration: T * 1000, fill: 'forwards' });
  for (const w of ld.wh) w.animate(wk, { duration: T * 1000, fill: 'forwards' });
}
requestAnimationFrame(ldTick);

// the seven cars, each baked into one merged GLB (see .work/prep.html)
const carFrac = CARS.map(() => 0);
const carsP = Promise.all(CARS.map((c, i) => load(gltfL, `assets/cars/real/${c.file}.glb`, e => {
  if (e.total) { carFrac[i] = e.loaded / e.total; glbFrac = carFrac.reduce((a, b) => a + b) / CARS.length; }
})));
const [models, hStudio, hMorning, hGolden, hNight, aDiff, aRough, aNorm, aoTex] = await Promise.all([
  carsP,
  load(rgbe, 'assets/hdr/studio_small_09.hdr'),
  load(rgbe, 'assets/hdr/learner_park.hdr'),
  load(rgbe, 'assets/hdr/sunset_jhbcentral.hdr'),
  load(rgbe, 'assets/hdr/rooftop_night.hdr'),
  load(texL, 'assets/tex/asphalt_diff_2k.jpg'),
  load(texL, 'assets/tex/asphalt_rough_2k.webp'),
  load(texL, 'assets/tex/asphalt_nor_gl_2k.webp'),
  load(texL, 'assets/cars/ferrari_ao.png'),
  document.fonts.load('900 120px "Cabinet Grotesk"'), document.fonts.load('800 120px "Cabinet Grotesk"'),
]);

const pmrem = new THREE.PMREMGenerator(renderer);
const envOf = t => { t.mapping = THREE.EquirectangularReflectionMapping; const e = pmrem.fromEquirectangular(t).texture; t.dispose(); return e; };
const ENV = { studio: envOf(hStudio), morning: envOf(hMorning), golden: envOf(hGolden), night: envOf(hNight) };
for (const t of [aDiff, aRough, aNorm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
aDiff.colorSpace = THREE.SRGBColorSpace;
aoTex.colorSpace = THREE.SRGBColorSpace;
scene.environment = ENV.studio;
scene.environmentIntensity = 0.42;

/* ---------- shared state ---------- */
const pools = new Array(N).fill(0);           // light pool strength per bay, feeds ground + wall shaders
const bayXs = CARS.map((c, i) => bayX(i));
let signOn = 0;

/* ---------- wet asphalt (reflector with our own shader) ---------- */
const GroundShader = {
  name: 'KestrelGround',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    tAsph: { value: null }, tRough: { value: null }, tNorm: { value: null },
    uPool: { value: pools }, uBayX: { value: bayXs }, uGap: { value: GAP }, uYaw: { value: YAW },
    uStudio: { value: 0 }, uFocus: { value: new THREE.Vector2() }, uSign: { value: 0 }, uFloor: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uFogColor: { value: new THREE.Color() }, uFogNear: { value: 11 }, uFogFar: { value: 44 },
  },
  vertexShader: `
    uniform mat4 textureMatrix; varying vec4 vRefl; varying vec3 vW;
    void main(){ vRefl = textureMatrix * vec4(position, 1.); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tAsph, tRough, tNorm;
    uniform float uPool[${N}]; uniform float uBayX[${N}];
    uniform float uGap, uYaw, uStudio, uSign, uFogNear, uFogFar, uFloor; uniform vec2 uFocus; uniform vec3 uFogColor, uTint;
    varying vec4 vRefl; varying vec3 vW;
    void main(){
      vec2 tuv = vW.xz * .23;
      vec3 asph = texture2D(tAsph, tuv).rgb;
      float rough = texture2D(tRough, tuv).r;
      vec3 nrm = texture2D(tNorm, tuv).xyz * 2. - 1.;
      float puddle = smoothstep(.62, .40, texture2D(tRough, vW.xz * .031 + .37).r);
      float wet = mix(puddle, 1., uStudio);
      float r = mix(rough, .04, wet);
      vec2 ruv = vRefl.xy / vRefl.w + nrm.xy * mix(.0045, .001, wet);
      float bx = r * .006 + .001, by = r * .034 + .002;
      vec3 refl = texture2D(tDiffuse, ruv).rgb * .2;
      for (int k = 1; k <= 2; k++) {
        float f = float(k) * .5;
        refl += (texture2D(tDiffuse, ruv + vec2(0., by * f)).rgb + texture2D(tDiffuse, ruv - vec2(0., by * f)).rgb) * .15;
        refl += (texture2D(tDiffuse, ruv + vec2(bx * f, 0.)).rgb + texture2D(tDiffuse, ruv - vec2(bx * f, 0.)).rgb) * .05;
      }
      float L = 0.;
      for (int i = 0; i < ${N}; i++) { vec2 d = vec2(vW.x - uBayX[i], (vW.z - .5) * .78); L += uPool[i] * exp(-dot(d, d) * .2); }
      { vec2 d = vec2(vW.x + 6.4, vW.z + 2.2); L += uSign * .5 * exp(-dot(d, d) * .35); }
      vec3 V = normalize(cameraPosition - vW);
      float fres = .28 + .72 * pow(1. - clamp(V.y, 0., 1.), 4.);
      vec3 floorCol = mix(asph, vec3(.05), uStudio);
      vec3 col = floorCol * (.018 + L * .42) * vec3(1., .96, .9);
      col += refl * mix(.18, .95, wet) * fres;
      // painted bay lines, angled with the cars
      if (uStudio < .5) {
        float cy = cos(uYaw), sy = sin(uYaw);
        float x0 = uBayX[0] + uGap * .5;
        float k = floor((vW.x * cy - vW.z * sy - x0 * cy) / (uGap * cy) + .5);
        float xk = x0 + k * uGap;
        float du = abs(vW.x * cy - vW.z * sy - xk * cy);
        float dv = vW.x * sy + vW.z * cy - xk * sy;
        float m = (1. - smoothstep(.045, .065, du)) * (1. - smoothstep(2.45, 2.6, abs(dv - .25)));
        m *= step(-1.5, k) * step(k, float(${N}) - .5) * (.55 + .45 * smoothstep(.2, .5, asph.r));
        col = mix(col, vec3(.8, .78, .72) * (.03 + L * .55), m * .9);
      } else {
        vec2 q = vW.xz - uFocus; float d = length(q);
        float disk = 1. - smoothstep(5.38, 5.46, d);
        float lm = exp(-d * d * .02);
        vec3 base = uTint * uFloor * (.8 + .9 * lm) * (1. + .05 * disk);
        base *= 1. - .3 * (smoothstep(5.3, 5.38, d) - smoothstep(5.46, 5.54, d));
        col = base + refl * (.2 + .12 * disk) * fres;
      }
      float f = smoothstep(uFogNear, uFogFar, length(cameraPosition - vW));
      col = mix(col, uFogColor, f);
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
let quality = DPR;
const reflRes = () => [Math.round(innerWidth * quality * 0.42), Math.round(innerHeight * quality * 0.42)];
const ground = new Reflector(new THREE.PlaneGeometry(160, 70), { shader: GroundShader, textureWidth: reflRes()[0], textureHeight: reflRes()[1], clipBias: 0.002, multisample: 0 });
ground.rotation.x = -Math.PI / 2;
ground.position.set(GAP * 3, 0, 0);
const gu = ground.material.uniforms;
gu.tAsph.value = aDiff; gu.tRough.value = aRough; gu.tNorm.value = aNorm;
gu.uPool.value = pools; gu.uBayX.value = bayXs;
scene.add(ground);
// the mirror only needs the cars near the camera
{ const ob = ground.onBeforeRender, hidden = [];
  ground.onBeforeRender = (...a) => {
    const lb = look.x / GAP;
    bays.forEach(b => { if (b.pivot.visible && Math.abs(b.i - lb) > 2.2) { b.pivot.visible = false; hidden.push(b); } });
    ob(...a);
    hidden.forEach(b => { b.pivot.visible = true; }); hidden.length = 0;
  }; }

/* ---------- the lot: back wall, columns, sign, bay numbers ---------- */
const lot = new THREE.Group(); scene.add(lot);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(160, 16), new THREE.ShaderMaterial({
  uniforms: { uPool: { value: pools }, uBayX: { value: bayXs }, uSign: { value: 0 }, tAsph: { value: aDiff },
    uFogColor: { value: new THREE.Color() }, uFogNear: { value: 11 }, uFogFar: { value: 44 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform float uPool[${N}]; uniform float uBayX[${N}]; uniform float uSign, uFogNear, uFogFar; uniform vec3 uFogColor; uniform sampler2D tAsph; varying vec3 vW;
    void main(){
      float L = 0.;
      for (int i = 0; i < ${N}; i++) { float dx = vW.x - uBayX[i]; L += uPool[i] * exp(-dx * dx * .16); }
      { float dx = vW.x + 6.4; L += uSign * 1.4 * exp(-dx * dx * .2); }
      float h = vW.y;
      float wash = L * (.18 + .82 * exp(-pow((h - 4.6) / 1.8, 2.))) * smoothstep(-.2, 1.4, h);
      float tex = texture2D(tAsph, vW.xy * .12).r;
      vec3 col = vec3(.008, .008, .009) + vec3(1., .94, .86) * .055 * wash * (.6 + .8 * tex);
      float f = smoothstep(uFogNear, uFogFar, length(cameraPosition - vW));
      gl_FragColor = vec4(mix(col, uFogColor, f * .85), 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
wall.position.set(GAP * 3, 8, -7.4);
lot.add(wall);

const colMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.72, metalness: 0 });
for (let k = -1; k < N; k++) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.36, 7, 0.36), colMat);
  c.position.set(bayX(k) + GAP / 2, 3.5, -4.8);
  lot.add(c);
}

function textTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const signMat = new THREE.MeshBasicMaterial({
  map: textTex(2048, 560, (g, w, h) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#FF5A1F'; g.font = '900 300px "Cabinet Grotesk"'; g.fillText('KESTREL', w / 2, 330);
    g.font = '800 54px "Cabinet Grotesk"'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('MOTOR HOUSE  ·  IKOYI', w / 2, 460);
  }), transparent: true, depthWrite: false, color: new THREE.Color(0, 0, 0), fog: false,
});
const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.26), signMat);
sign.position.set(-6.4, 1.75, -2.6); sign.rotation.y = 0.42;
lot.add(sign);

/* ---------- cars ---------- */
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0b0d, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.6, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.6, name: 'glass' });
// every car is baked nose to +z, wheels on y = 0, in metres, with its part class in userData

const noRay = () => {};
const glowMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(1.0, 0.94, 0.84) }, uOp: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uOp; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uColor * (.35 + f * 1.8), (.1 + f * .9) * uOp); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

const bays = CARS.map((spec, i) => {
  const pivot = new THREE.Group();
  pivot.position.set(bayX(i), 0, 0);
  pivot.rotation.y = YAW;
  scene.add(pivot);

  const car = models[i].scene;
  const paint = new THREE.MeshPhysicalMaterial({ color: spec.paint.hex, metalness: spec.paint.metal, roughness: spec.paint.rough, clearcoat: 1, clearcoatRoughness: 0.03, name: 'paint' });
  const parts = {}, lamps = [], tails = [];
  car.traverse(o => {
    if (!o.isMesh) return;
    o.userData.part = /^trim_/.test(o.name) ? null : o.userData.part ?? partOf(o);
    const p = o.userData.part;
    o.material = p === 'paint' ? paint : p === 'glass' ? glassMat : o.material.clone();
    const rc = spec.recolour && spec.recolour[o.material.name]; if (rc) o.material.color.set(rc);
    if (p) (parts[p] ||= []).push(o);
    if (p === 'lights') lamps.push(o.material);
    if (p === 'taillights') tails.push(o.material);
  });
  const csz = new THREE.Box3().setFromObject(car).getSize(new V3());
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(csz.x * 1.34, csz.z * 1.155), new THREE.MeshBasicMaterial({ map: aoTex, blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, toneMapped: false }));
  ao.rotation.x = -Math.PI / 2; ao.position.y = 0.004; ao.renderOrder = 2; ao.raycast = noRay;
  car.add(ao);
  pivot.add(car);

  const proxy = new THREE.Mesh(new THREE.BoxGeometry(csz.x + 0.2, csz.y, csz.z + 0.2), new THREE.MeshBasicMaterial());
  proxy.position.y = csz.y / 2; proxy.visible = false; proxy.userData.bay = i;
  pivot.add(proxy);

  const barMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 4.6), barMat);
  bar.position.set(0, 2.8, 0.1); bar.raycast = noRay;
  pivot.add(bar);

  const numMat = new THREE.MeshBasicMaterial({
    map: textTex(256, 256, (g, w, h) => { g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 150px "Cabinet Grotesk"'; g.fillText(String(i + 1).padStart(2, '0'), w / 2, h / 2 + 8); }),
    transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -1,
  });
  const num = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), numMat);
  num.rotation.order = 'YXZ'; num.rotation.set(-Math.PI / 2, YAW, 0);
  num.position.set(bayX(i) + Math.sin(YAW) * 3.05, 0.003, Math.cos(YAW) * 3.05);
  num.raycast = noRay;
  lot.add(num);

  return { i, spec, pivot, car, paint, parts, lamps, tails, proxy, bar, barMat, numMat, num, on: 0, lvl: 0, overlays: {} };
});

/* ---------- studio + waterfront sets ---------- */
const studio = new THREE.Group(); studio.visible = false; scene.add(studio);
{
  const prof = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24 * Math.PI / 2; prof.push(new THREE.Vector2(9 + Math.sin(t) * 3.4, 3.4 - Math.cos(t) * 3.4)); }
  prof.push(new THREE.Vector2(12.4, 13), new THREE.Vector2(0.01, 13));
  const coveMat = new THREE.ShaderMaterial({
    uniforms: { uCove: { value: new THREE.Color(0.26, 0.26, 0.26) } }, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uCove; varying vec3 vL;
      void main(){
        float g = mix(1., .22, smoothstep(.0, 9., vL.y));
        gl_FragColor = vec4(uCove * g, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const cove = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), coveMat);
  studio.add(cove); studio.userData.cove = coveMat; studio.userData.coveMesh = cove;
  const halo = new THREE.Mesh(new THREE.RingGeometry(4.3, 4.75, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.1, 2.95), side: THREE.DoubleSide, fog: false }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 6.2; studio.add(halo); studio.userData.halo = halo;


}
// Three area lights, shared by every setting so the shaders never need recompiling.
const POOL = [0, 1, 2].map(() => { const l = new THREE.RectAreaLight(0xfff1e2, 0, 0.8, 4.6); l.rotation.order = 'YXZ'; scene.add(l); return l; });
function poolDown(l, x, z, w, h, int, col = 0xfff1e2) { l.width = w; l.height = h; l.color.set(col); l.position.set(x, 2.78, z); l.rotation.set(-Math.PI / 2, YAW, 0); l.intensity = int; }
const MOODS = {
  day: { top: 1.6, topCol: 0xffffff, strip: 5, stripCol: 0xfff6ea, floor: 0.24, tint: [1, 1, 1.02], env: 0.62, exp: 0.95 },
  golden: { top: 1.1, topCol: 0xffc48c, strip: 6, stripCol: 0xff9550, floor: 0.2, tint: [1, 0.78, 0.56], env: 0.34, exp: 1.0 },
  black: { top: 7, tw: 0.9, th: 7.5, topCol: 0xffffff, strip: 2.2, sw: 0.5, stripCol: 0xffffff, floor: 0.007, tint: [1, 1, 1], env: 0.06, exp: 1.1 },
};
function poolStudio() {
  const x = bayX(sel), m = MOODS[time] || MOODS.day;
  poolDown(POOL[0], x, 0, m.tw || 8.6, m.th || 8.6, m.top, m.topCol); POOL[0].position.y = m.tw ? 4.4 : 6.2;
  [1, 2].forEach((k, n) => { const l = POOL[k], a = YAW + Math.PI / 4 + n * Math.PI, r = 9.5; l.width = m.sw || 0.5; l.height = 4.2; l.color.set(m.stripCol); l.position.set(x + Math.sin(a) * r, 1.7, Math.cos(a) * r); l.lookAt(x, 1.1, 0); l.intensity = m.strip; });
  gu.uFloor.value = m.floor; gu.uTint.value.setRGB(...m.tint);
  studio.userData.cove.uniforms.uCove.value.setRGB(...m.tint).multiplyScalar(m.floor);
  studio.userData.halo.material.color.setScalar(m.top > 0 && !m.tw ? 3.1 : 0.04).multiply(new THREE.Color(m.topCol));
}
let skybox = null, skyKey = '';
const SKY = { morning: ['assets/hdr/learner_park.jpg', 2.0, 1.0], golden: ['assets/hdr/sunset_jhbcentral.jpg', 2.0, 0.95], night: ['assets/hdr/rooftop_night.jpg', 2.6, 1.35] };
const skyTex = {};
async function ensureSky(key) {
  if (skyKey === key) return;
  if (!skyTex[key]) { const t = await new THREE.TextureLoader().loadAsync(SKY[key][0]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; skyTex[key] = t; }
  if (skybox) { scene.remove(skybox); skybox.geometry.dispose(); skybox.material.dispose(); }
  for (const k in skyTex) if (k !== key) { skyTex[k].dispose(); delete skyTex[k]; }
  skybox = new GroundedSkybox(skyTex[key], SKY[key][1], 70);
  skybox.material.color.setScalar(1.18);
  skybox.material.fog = false;
  skyKey = key;
  scene.add(skybox);
}

/* ---------- UI: bays list, rail, card ---------- */
const lift = hex => { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl, THREE.SRGBColorSpace); if (hsl.l < .46) c.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), .46, THREE.SRGBColorSpace); return '#' + c.getHexString(THREE.SRGBColorSpace); };
const lum = hex => { const c = new THREE.Color(lift(hex)); return .2126 * c.r + .7152 * c.g + .0722 * c.b; };
const uiPaint = CARS.map(c => lift(c.paint.hex));
const pad = i => String(i + 1).padStart(2, '0');
const name = c => `${c.make} ${c.model}`;

const baysEl = $('#bays');
baysEl.innerHTML = CARS.map((c, i) => `<li><button type="button" data-i="${i}" style="--c:${uiPaint[i]}" aria-label="Bay ${pad(i)}, ${name(c)}"><span class="n">${pad(i)}</span><span class="nm"><i></i><b>${name(c)}</b><span>${naira(c.usd)}</span></span></button></li>`).join('');
const bayBtns = [...baysEl.querySelectorAll('button')];

function setAccent() { return; }
function oldAccent(i) {
  const r = document.documentElement.style;
  r.setProperty('--paint', uiPaint[i]);
  r.setProperty('--on-paint', lum(CARS[i].paint.hex) > .3 ? '#121212' : '#F6F3EE');
}

let sel = 0, shownUsd = 0, rollId = 0;
const reserved = new Map(); // cars held with a deposit this visit
function rollPrice(to) {
  const from = shownUsd || to * 0.6, id = ++rollId; shownUsd = to;
  tween(reduce ? 1 : 1100, k => { if (id !== rollId) return; const v = from + (to - from) * k; $('#cNaira').textContent = naira(v); $('#cUsd').textContent = dollars(Math.round(v / 1000) * 1000); }, k => 1 - Math.pow(1 - k, 4));
}
function fillCard(i, animate) {
  const c = CARS[i];
  $('#cOver').textContent = `Bay ${pad(i)} · ${c.year} · ${km(c.km)}`;
  const base = animate ? 0 : 0.75;
  $('#cName').innerHTML = name(c).split(' ').map((w, k) => `<span class="w" style="animation-delay:${(base + k * 0.06).toFixed(2)}s">${w}</span>`).join(' ');
  rollPrice(c.usd);
  $('#cSpecs').innerHTML = `<div><dt>Power</dt><dd>${c.hp}</dd></div><div><dt>0–100</dt><dd>${c.sprint}</dd></div><div><dt>Top speed</dt><dd>${c.top}</dd></div><div class="wide"><dt>Paint</dt><dd style="--c:${uiPaint[i]}"><i></i>${c.paint.name}</dd></div>`;
  // the figures count up with the price
  $('#cSpecs').querySelectorAll('div:not(.wide) dd').forEach(dd => {
    const m = dd.textContent.match(/^([\d.]+)(.*)$/); if (!m || reduce) return;
    const to = parseFloat(m[1]), dp = (m[1].split('.')[1] || '').length, rest = m[2];
    dd.textContent = (0).toFixed(dp) + rest;
    tween(1100, k => { dd.textContent = (to * k).toFixed(dp) + rest; }, k => 1 - Math.pow(1 - k, 4));
  });
  if (animate) { const k = $('#card'); k.classList.remove('swap'); void k.offsetWidth; k.classList.add('swap'); }
  setAccent(i);
  syncCar(i);
  railBtns.forEach((b, j) => b.classList.toggle('on', j === i));
}

/* thumbnails, rendered from the scene before the lights come up */
const thumbs = [], spins = [], SPIN_F = 36;
const spinEl = (i, cls = '') => `<i class="spin ${cls}${spins[i] ? ' live' : ''}" data-car="${i}" style="background-image:url(${spins[i] || thumbs[i]})"></i>`;
function liven(el) { const i = +el.dataset.car; if (!spins[i]) return; el.style.backgroundImage = `url(${spins[i]})`; el.classList.add('live'); }
function makeThumbs() {
  const w = 240, h = 150, c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
  const g = c2.getContext('2d');
  const tc = new THREE.PerspectiveCamera(24, w / h, 0.1, 60);
  const prev = { env: scene.environment, ei: scene.environmentIntensity, bg: scene.background, fog: scene.fog };
  scene.environment = ENV.studio; scene.environmentIntensity = 1.1; scene.background = new THREE.Color(0x141416); scene.fog = fogWater;
  ground.visible = false; lot.visible = false;
  bays.forEach(b => { b.pivot.visible = false; });
  renderer.setScissorTest(true);
  bays.forEach((b, i) => {
    b.pivot.visible = true; b.bar.visible = false;
    const yaw = YAW + 0.9, r = 7.4;
    tc.position.set(bayX(i) + Math.sin(yaw) * r, 1.55, Math.cos(yaw) * r);
    tc.lookAt(bayX(i) - 0.15, 0.5, 0);
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h);
    renderer.render(scene, tc);
    const H = renderer.domElement.height;
    g.drawImage(renderer.domElement, 0, H - Math.round(h * DPR), Math.round(w * DPR), Math.round(h * DPR), 0, 0, w, h);
    thumbs[i] = c2.toDataURL('image/jpeg', 0.86);
    const sw = 192, sh = 120, ry = b.car.rotation.y, strip = document.createElement('canvas'); strip.width = sw * SPIN_F; strip.height = sh;
    const sg = strip.getContext('2d');
    renderer.setViewport(0, 0, sw, sh); renderer.setScissor(0, 0, sw, sh);
    tc.aspect = sw / sh; tc.updateProjectionMatrix();
    for (let k = 0; k < SPIN_F; k++) {
      b.car.rotation.y = ry + k / SPIN_F * Math.PI * 2;
      renderer.render(scene, tc);
      sg.drawImage(renderer.domElement, 0, H - Math.round(sh * DPR), Math.round(sw * DPR), Math.round(sh * DPR), k * sw, 0, sw, sh);
    }
    b.car.rotation.y = ry; tc.aspect = w / h; tc.updateProjectionMatrix();
    strip.toBlob(bl => { spins[i] = URL.createObjectURL(bl); document.querySelectorAll(`.spin[data-car="${i}"]`).forEach(liven); }, BAKE ? 'image/png' : 'image/jpeg', 0.84);
    b.pivot.visible = false; b.bar.visible = true;
  });
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  Object.assign(scene, { environment: prev.env, environmentIntensity: prev.ei, background: prev.bg, fog: prev.fog });
  ground.visible = true; lot.visible = true;
  bays.forEach(b => { b.pivot.visible = true; });
}
// The turntable strips are rendered once ahead of time (open the site with ?bake to render them again)
const BAKE = new URLSearchParams(location.search).has('bake');
if (BAKE) makeThumbs();
else CARS.forEach((c, i) => { spins[i] = `assets/ui/spin/${c.id}.webp`; thumbs[i] = spins[i]; });

const rail = $('#rail');
rail.innerHTML = CARS.map((c, i) => `<button type="button" data-i="${i}" style="--c:${uiPaint[i]};transition:opacity .3s ${(0.6 + i * 0.05).toFixed(2)}s,transform .8s cubic-bezier(.16,1,.3,1) ${(0.6 + i * 0.05).toFixed(2)}s" aria-label="${name(c)}">${spinEl(i)}<span>${name(c)}</span></button>`).join('');
baysEl.querySelectorAll('button').forEach((b, i) => b.querySelector('.nm').insertAdjacentHTML('beforebegin', spinEl(i, 'bt')));
document.querySelectorAll('.spin').forEach(liven);
const railBtns = [...rail.querySelectorAll('button')];
fillCard(0);
setFocusBay(0);

/* ---------- toast, credits ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
const cred = document.createElement('div'); cred.className = 'credpanel';
cred.innerHTML = `<p><b>Models</b>, from Sketchfab, repainted for the lot:</p><p>${CARS.map(c => `${c.year} ${c.make} ${c.model}: ${c.credit}`).join('<br>')}</p><p>Lighting and asphalt: Poly Haven (CC0). Engine sounds: Pixabay (Chrysalyn and others). Type: Cabinet Grotesk.</p>`;
body.append(cred);
$('#credits').textContent = 'Credits';
$('#credits').addEventListener('click', e => { e.stopPropagation(); cred.classList.toggle('show'); });
addEventListener('pointerdown', e => { if (!cred.contains(e.target) && e.target.id !== 'credits') cred.classList.remove('show'); });

/* ---------- camera rig ---------- */
const look = new V3(); // where the camera is looking
const par = new THREE.Vector2(), parT = new THREE.Vector2();
let s = 0, sT = 0; // walk position along the row, in bays
// portrait screens need the camera further back to fit the whole car
const fitK = () => clamp(1.05 / (innerWidth / innerHeight), 1, 2.1);
function lotPose(sv, pos, tgt, withPar = true) {
  const fx = sv * GAP, px = withPar ? par.x : 0, py = withPar ? par.y : 0, k = Math.min(fitK(), 1.55);
  tgt.set(fx + (k > 1 ? 0.3 : 0.9), 0.62, 0);
  pos.set(fx - 4.4 + px * 0.4, 1.7 + py * 0.14, 10.4).sub(tgt).multiplyScalar(k).add(tgt);
}
function roomPose(j, pos, tgt, r = 8.2 * fitK()) {
  const yaw = YAW + 0.86;
  tgt.set(bayX(j), 0.62, 0);
  pos.set(bayX(j) + Math.sin(yaw) * r, 1.6, Math.cos(yaw) * r);
}
const ARRIVE_POS = new V3(-14.5, 1.75, 4.6), ARRIVE_TGT = new V3(0, 0.95, -1.6);

let flight = null;
function fly(p1, t1, dur, arc = 0, ez = ease) {
  const p0 = camera.position.clone(), t0 = look.clone();
  return new Promise(res => { flight = { p0, t0, p1: p1.clone(), t1: t1.clone(), start: performance.now(), dur: reduce ? 1 : dur, arc, ez, res }; });
}
const _c = new V3();
function runFlight(now) {
  if (!flight) return false;
  const f = flight, k = f.ez(clamp((now - f.start) / f.dur, 0, 1));
  _c.lerpVectors(f.p0, f.p1, 0.5); _c.y += f.arc;
  const a = 1 - k;
  camera.position.set(a * a * f.p0.x + 2 * a * k * _c.x + k * k * f.p1.x, a * a * f.p0.y + 2 * a * k * _c.y + k * k * f.p1.y, a * a * f.p0.z + 2 * a * k * _c.z + k * k * f.p1.z);
  look.lerpVectors(f.t0, f.t1, k);
  camera.lookAt(look);
  if (k >= 1) { flight = null; f.res(); }
  return true;
}

const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: 0.07, rotateSpeed: 0.55, zoomSpeed: 0.7, enablePan: false, minDistance: 4.2, maxDistance: 10, minPolarAngle: 0.3, maxPolarAngle: 1.5, autoRotateSpeed: -0.35 });
controls.addEventListener('start', () => { controls.autoRotate = false; body.classList.add('hinted'); });

/* ---------- modes ---------- */
let mode = 'arrive'; // arrive | lot | fly | room | close
let env = 'lot', time = 'day', lightsOn = false, hovBay = -1, filter = 'all';
const matches = i => filter === 'all' || CARS[i].type === filter;
const nearestMatch = v => { let best = -1, d = 1e9; for (let i = 0; i < N; i++) if (matches(i) && Math.abs(i - v) < d) { d = Math.abs(i - v); best = i; } return best < 0 ? Math.round(clamp(v, 0, N - 1)) : best; };

function setFocusBay(i) {
  if (!bayBtns) return; bayBtns.forEach((b, j) => b.classList.toggle('on', j === i)); }
let focusBay = 0;

async function enterRoom(j) {
  if (mode !== 'lot') return;
  mode = 'fly'; sel = j; sT = s = j; hovBay = -1;
  fillCard(j); hideTag();
  engine.ignite();
  body.classList.add('in-room'); body.classList.remove('hovering');
  const p = new V3(), t = new V3(); roomPose(j, p, t);
  await fly(p, t, 1900, 0.5);
  await wipe(() => applyEnv('studio'), { p, t });
  controls.target.copy(t); controls.enabled = true; controls.autoRotate = false; controls.update();
  mode = 'room'; touchT = performance.now() - 2000; showCoach();
  setTimeout(() => body.classList.add('hinted'), 7000);
}

async function exitRoom() {
  if (mode !== 'room' && mode !== 'close') return;
  const from = mode;
  engine.stop(); revUp(); hideCoach();
  mode = 'fly'; controls.enabled = false; controls.autoRotate = false; clearHover(); body.classList.remove('closeup');
  if (env !== 'lot') {
    await wipe(async () => {
      await applyEnv('lot');
      const p = new V3(), t = new V3(); roomPose(sel, p, t); camera.position.copy(p); controls.target.copy(t); look.copy(t); camera.lookAt(t);
    });
  } else if (from === 'close') {
    look.copy(controls.target);
  }
  look.copy(controls.target);
  body.classList.remove('in-room');
  sT = s = sel; focusBay = sel; setFocusBay(sel);
  const p = new V3(), t = new V3(); lotPose(sel, p, t);
  await fly(p, t, 1800, 0.4);
  mode = 'lot';
}

async function switchCar(j) {
  if (j === sel || (mode !== 'room' && mode !== 'close')) return;
  engine.stop(); revUp();
  mode = 'fly'; controls.enabled = false; controls.autoRotate = false; clearHover(); body.classList.remove('closeup');
  look.copy(controls.target);
  const p = new V3(), t = new V3();
  if (env === 'lot') {
    sel = j; fillCard(j, true); roomPose(j, p, t);
    await fly(p, t, 1700, 0.9);
  } else {
    await wipe(async () => {
      sel = j; fillCard(j, true); await applyEnv(env);
      roomPose(j, p, t); camera.position.copy(p); look.copy(t); camera.lookAt(t);
    }, { p, t });
  }
  controls.target.copy(t); controls.enabled = true; controls.update();
  mode = 'room';
  engine.ignite();
}

/* the switch between settings: freeze the last frame, change the set behind it, then peel the frame away
   through a feathered edge while the camera dollies in. Never a black hold. */
const xfEl = $('#xf'), xfShot = $('#xfShot'), xfLight = $('#xfLight'), xfCtx = xfShot.getContext('2d');
const frames = n => new Promise(r => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r()); f(); });
async function wipe(mid, dolly) {
  if (reduce) { await mid(); return; }
  const src = renderer.domElement;
  xfShot.width = src.width; xfShot.height = src.height;
  composer.render(0); xfCtx.drawImage(src, 0, 0);   // same task as the render, so the buffer is still there
  body.classList.add('xf-on');
  await mid();
  if (dolly) { // start a little further out, so the new set arrives with movement
    camera.position.copy(dolly.p).add(_p.copy(dolly.p).sub(dolly.t).setY(0).normalize().multiplyScalar(1.4)).setY(dolly.p.y + 0.25);
    look.copy(dolly.t); camera.lookAt(look);
  }
  await frames(3);                                   // let the new set compile and draw underneath
  const T = 1250 * (window.__xfSlow || 1), o = { duration: T, easing: 'cubic-bezier(.65,0,.3,1)', fill: 'forwards' };
  const an = [
    xfEl.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(124vw)' }], o),
    xfShot.animate([{ transform: 'translateX(0) scale(1)', filter: 'brightness(1)' }, { transform: 'translateX(-124vw) scale(1.07)', filter: 'brightness(.7)' }], o),
    xfLight.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(124vw)' }], o),
  ];
  await Promise.all([an[0].finished, dolly ? fly(dolly.p, dolly.t, T + 250, 0, easeOut) : 0]);
  body.classList.remove('xf-on'); an.forEach(a => a.cancel());
}

/* environments */
async function applyEnv(name) {
  env = name;
  body.classList.toggle('env-studio', name === 'studio');
  document.querySelectorAll('#envSeg button').forEach(b => b.classList.toggle('on', b.dataset.env === name));
  const x = bayX(sel);
  const lotOn = name === 'lot';
  ground.visible = name !== 'water';
  lot.visible = lotOn;
  studio.visible = name === 'studio';
  studio.position.set(x, 0, 0); studio.rotation.y = YAW;
  gu.uStudio.value = name === 'studio' ? 1 : 0;
  gu.uFocus.value.set(x, 0);
  bays.forEach((b, i) => { b.pivot.visible = lotOn || i === sel; b.bar.visible = lotOn; });
  if (skybox) skybox.visible = name === 'water';
  controls.maxDistance = 10 * fitK();
  studio.userData.coveMesh.scale.setScalar(Math.max(1, (10 * fitK() + 1.5) / 12.4));
  bloom.strength = name === 'studio' ? 0.16 : 0.24; bloom.threshold = name === 'studio' ? 1.3 : 1.0;
  if (name === 'lot') {
    scene.environment = ENV.studio; scene.environmentIntensity = 0.42; scene.background = BG_LOT.clone(); scene.fog = fogLot; renderer.toneMappingExposure = 1.05;
  } else if (name === 'studio') {
    const m = MOODS[time]; scene.environment = ENV.studio; scene.environmentIntensity = m.env; scene.background = new THREE.Color(0x080808); scene.fog = fogWater; renderer.toneMappingExposure = m.exp;
  } else {
    await ensureSky(time);
    skybox.position.set(x, SKY[time][1] - 0.01, 0); skybox.visible = true;
    scene.environment = ENV[time]; scene.environmentIntensity = time === 'night' ? 1.3 : 1.0; scene.fog = fogWater; renderer.toneMappingExposure = SKY[time][2];
  }
}
let envBusy = false;
async function setEnv(name, t = time) {
  if (envBusy || mode !== 'room' || (name === env && t === time)) return;
  envBusy = true; clearHover();
  await wipe(async () => {
    time = t;
    document.querySelectorAll('#times button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    await applyEnv(name);
  });
  envBusy = false;
}
document.querySelectorAll('#envSeg button').forEach(b => b.addEventListener('click', () => setEnv(b.dataset.env)));
document.querySelectorAll('#times button').forEach(b => b.addEventListener('click', () => {
  if (env !== 'studio' || time === b.dataset.t) return;
  time = b.dataset.t;
  document.querySelectorAll('#times button').forEach(x => x.classList.toggle('on', x === b));
  applyEnv('studio');
}));
$('#lightsBtn').addEventListener('click', () => {
  lightsOn = !lightsOn;
  $('#lightsBtn').setAttribute('aria-pressed', lightsOn);
  $('#lightsBtn').textContent = lightsOn ? 'Lights off' : 'Lights on';
});

/* turntable: the car turns on its own until you take over */
let touchT = 0, coachT = 0;
const coachEl = $('#coach');
function showCoach() { if (body.classList.contains('coached')) return; body.classList.add('coach-on'); clearTimeout(coachT); coachT = setTimeout(hideCoach, 7000); }
function hideCoach() { if (!body.classList.contains('coach-on')) return; body.classList.remove('coach-on'); body.classList.add('coached'); }
canvas.addEventListener('pointerdown', () => { touchT = performance.now(); if (mode === 'room') hideCoach(); });
addEventListener('wheel', () => { touchT = performance.now(); }, { passive: true });
const TAU = Math.PI * 2;

/* engine: sound toggle and hold-to-rev */
const sndBtn = $('#sndBtn'), revBtn = $('#rev'), rpmEl = $('#rpm'), tachEl = $('#tach');
function paintSound() { body.classList.toggle('snd-on', engine.on); sndBtn.setAttribute('aria-pressed', engine.on); sndBtn.querySelector('.sl').textContent = engine.on ? 'Sound on' : 'Sound off'; }
paintSound();
sndBtn.addEventListener('click', () => { engine.setOn(!engine.on); paintSound(); });
addEventListener('pointerdown', () => engine.prime(), { once: true });
function revDown() { if (mode !== 'room') return; engine.revDown(); revBtn.classList.add('held'); }
function revUp() { engine.revUp(); revBtn.classList.remove('held'); }
revBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { revBtn.setPointerCapture(e.pointerId); } catch { /* synthetic */ } revDown(); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => revBtn.addEventListener(t, revUp));
revBtn.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat && mode === 'room' && !e.target.matches('input')) { e.preventDefault(); revDown(); } });
addEventListener('keyup', e => { if (e.code === 'Space') { e.preventDefault(); revUp(); } });
addEventListener('blur', revUp);

/* ---------- lot interactions ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let ptr = { x: 0, y: 0, moved: false, down: false, sx: 0, sy: 0, sT0: 0, vx: 0, lx: 0, lt: 0, type: 'mouse' };
const proxies = bays.map(b => b.proxy);
const tagEl = $('#tag');
function hideTag() { tagEl.classList.remove('show'); }

function walkTo(v) { sT = clamp(v, 0, N - 1); body.classList.add('walked'); }
let snapT;
addEventListener('wheel', e => {
  if (mode !== 'lot' || body.classList.contains('booking')) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  walkTo(sT + d * 0.0032);
  clearTimeout(snapT); snapT = setTimeout(() => walkTo(nearestMatch(sT)), 150);
}, { passive: true });

canvas.addEventListener('pointerdown', e => {
  ptr = { ...ptr, down: true, sx: e.clientX, sy: e.clientY, sT0: sT, vx: 0, lx: e.clientX, lt: performance.now(), type: e.pointerType, drag: false };
  if (mode === 'lot') canvas.setPointerCapture(e.pointerId);
});
addEventListener('pointermove', e => {
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = true; ptr.type = e.pointerType;
  parT.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  if (ptr.down && mode === 'lot') {
    const dx = e.clientX - ptr.sx;
    if (Math.abs(dx) > 6) { ptr.drag = true; body.classList.add('dragging'); hideTag(); }
    if (ptr.drag) {
      walkTo(ptr.sT0 - dx / (innerWidth * 0.3));
      const now = performance.now(); ptr.vx = (e.clientX - ptr.lx) / Math.max(1, now - ptr.lt); ptr.lx = e.clientX; ptr.lt = now;
    }
  }
});
addEventListener('pointerup', e => {
  if (!ptr.down) return;
  ptr.down = false; body.classList.remove('dragging');
  const moved = Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 6;
  if (mode === 'lot') {
    if (ptr.drag) walkTo(nearestMatch(sT - ptr.vx * 2.2));
    else if (e.target === canvas) { const b = pickBay(e.clientX, e.clientY); if (b >= 0) enterRoom(b); }
    ptr.drag = false;
  } else if ((mode === 'room') && !moved && e.target === canvas) {
    const h = pickPart(e.clientX, e.clientY);
    if (!h) { clearHover(); return; }
    if (e.pointerType !== 'mouse' && (!hover || hover.cls !== h.cls)) { setHover(h); return; }
    setHover(h); closeUp(h);
  }
});

function pickBay(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(proxies, false)[0];
  return hit ? hit.object.userData.bay : -1;
}

bayBtns.forEach((b, i) => b.addEventListener('click', () => {
  if (mode !== 'lot') return;
  if (Math.round(s) === i && Math.abs(s - i) < 0.05) enterRoom(i); else walkTo(i);
}));
document.querySelectorAll('.filters button').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.f;
  document.querySelectorAll('.filters button').forEach(x => x.classList.toggle('on', x === b));
  bayBtns.forEach((x, i) => x.classList.toggle('off', !matches(i)));
  walkTo(nearestMatch(matches(Math.round(sT)) ? sT : (CARS.findIndex((c, i) => matches(i)))));
}));
railBtns.forEach((b, i) => b.addEventListener('click', () => switchCar(i)));
$('#back').addEventListener('click', exitRoom);
$('#home').addEventListener('click', e => { e.preventDefault(); if (body.classList.contains('booking')) closeSheet(); exitRoom(); });

/* ---------- parts: hover, label, close-up ---------- */
let hover = null; // { cls, point, bay }
const pinEl = $('#pin');
const PART_DIST = { tyres: 1.9, wheels: 1.7, brakes: 1.5, lights: 1.8, taillights: 1.9, glass: 2.6, interior: 2.2, paint: 3.4, aero: 2.4, grille: 1.9 };

function pickPart(x, y) {
  const b = bays[sel];
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(b.car, true).filter(h => h.object.isMesh && h.object.material !== glowMat);
  if (!hits.length) return null;
  let h = hits[0], cls = h.object.userData.part;
  if (cls === 'glass') { const inn = hits.find(k => k.object.userData.part === 'interior' && k.distance - h.distance < 1.6); if (inn) { h = inn; cls = 'interior'; } }
  return cls ? { cls, point: h.point.clone(), bay: sel } : null;
}
function overlaysFor(b, cls) {
  if (!b.overlays[cls]) {
    b.overlays[cls] = (b.parts[cls] || []).map(m => { const o = new THREE.Mesh(m.geometry, glowMat); o.raycast = noRay; o.renderOrder = 3; o.visible = false; m.add(o); return o; });
  }
  return b.overlays[cls];
}
let glowCls = null, glowBay = -1, glowK = 0;
function setHover(h) {
  if (hover && h && hover.cls === h.cls && hover.bay === h.bay) return;
  hover = h;
  if (h) {
    const spec = CARS[h.bay].parts[h.cls];
    pinEl.querySelector('b').textContent = spec[0];
    pinEl.querySelector('span').textContent = spec[1];
    pinEl.classList.add('show');
    body.classList.add('hovering');
  } else { pinEl.classList.remove('show'); body.classList.remove('hovering'); }
  showGlow(h ? h.bay : -1, h ? h.cls : null);
}
function clearHover() { setHover(null); }
function showGlow(bi, cls) {
  if (glowCls && glowBay >= 0) overlaysFor(bays[glowBay], glowCls).forEach(o => { o.visible = false; });
  glowCls = cls; glowBay = bi; glowK = 0;
  if (cls) overlaysFor(bays[bi], cls).forEach(o => { o.visible = true; });
}

let roomReturn = null;
async function closeUp(h) {
  if (mode !== 'room') return;
  mode = 'fly'; controls.enabled = false; controls.autoRotate = false; body.classList.add('hinted');
  roomReturn = { pos: camera.position.clone(), tgt: controls.target.clone() };
  look.copy(controls.target);
  const dir = camera.position.clone().sub(h.point).normalize();
  if (h.cls === 'interior') dir.y = Math.max(dir.y, 0.55);
  if (h.cls === 'tyres' || h.cls === 'wheels' || h.cls === 'brakes') dir.y = clamp(dir.y, 0.05, 0.3);
  dir.normalize();
  const p = h.point.clone().addScaledVector(dir, PART_DIST[h.cls] || 2.2);
  p.y = Math.max(p.y, 0.32);
  const c = CARS[h.bay].parts[h.cls];
  $('#dOver').textContent = `${name(CARS[h.bay])} · Bay ${pad(h.bay)}`;
  $('#dName').textContent = c[0]; $('#dText').textContent = c[1];
  body.classList.add('closeup'); pinEl.classList.remove('show');
  await fly(p, h.point, 1300, 0.15);
  controls.target.copy(h.point);
  Object.assign(controls, { minDistance: 0.9, maxDistance: 4.2, minPolarAngle: 0.15 });
  controls.enabled = true; controls.update();
  mode = 'close';
}
async function closeDown() {
  if (mode !== 'close' || !roomReturn) return;
  mode = 'fly'; controls.enabled = false;
  body.classList.remove('closeup');
  look.copy(controls.target);
  await fly(roomReturn.pos, roomReturn.tgt, 1100, 0.1);
  controls.target.copy(roomReturn.tgt);
  Object.assign(controls, { minDistance: 4.2, maxDistance: 10 * fitK(), minPolarAngle: 0.3 });
  controls.enabled = true; controls.update();
  clearHover();
  mode = 'room';
}
$('#dBack').addEventListener('click', closeDown);

/* ---------- sheets: every action on the site opens in this one panel ---------- */
const sheet = $('#sheet'), shBody = $('#shBody'), shTitle = $('#shTitle');
const SLOTS = ['10:00', '11:30', '13:00', '14:30', '16:00'];
const ADDRESS = '14 Alexander Avenue, Ikoyi, Lagos';
const FLOOR = 'Tunde';
const APR = 0.24; // indicative lending rate a year
const me = { name: '', phone: '' }; // remembered across forms for this visit
let flow = null; // the open sheet

const esc = v => String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const fmtN = n => n >= 1e9 ? '₦' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B' : n >= 1e6 ? '₦' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : '₦' + Math.round(n / 1e3) + 'k';
const priceN = i => CARS[i].usd * RATE;
const currentCar = () => (mode === 'room' || mode === 'close' || (mode === 'fly' && body.classList.contains('in-room'))) ? sel : focusBay;
function openDays(n = 6) { const out = [], d = new Date(); d.setHours(12, 0, 0, 0); while (out.length < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) out.push(new Date(d)); } return out; }
const dayLong = v => new Date(v).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const dayShort = v => new Date(v).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
const weekday = v => new Date(v).toLocaleDateString('en-GB', { weekday: 'long' });
const digits = () => me.phone.replace(/\D/g, '').replace(/^0/, '');
const phoneFmt = () => { const p = digits(); return `+234 ${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`; };
const first = () => esc(me.name.trim().split(/\s+/)[0]);
function checkContact() {
  return me.name.trim().length < 2 ? 'Add your name so the team knows who they are talking to.' : digits().length !== 10 ? 'Check the phone number. It should be 10 digits after +234.' : '';
}
function lagosNow() { const n = new Date(); return new Date(n.getTime() + (n.getTimezoneOffset() + 60) * 60000); }
function lotStatus() {
  const t = lagosNow(), d = t.getDay(), h = t.getHours() + t.getMinutes() / 60;
  if (d !== 0 && h >= 10 && h < 18) return { open: true, text: 'Open now · closes 18:00' };
  if (d !== 0 && h < 10) return { open: false, text: 'Closed · opens today at 10:00' };
  return { open: false, text: `Closed · opens ${d === 6 || d === 0 ? 'Monday' : 'tomorrow'} at 10:00` };
}

/* pieces */
const lbl = (t, f) => f ? `<label class="lbl" for="${f}">${t}</label>` : `<p class="lbl">${t}</p>`;
const carRow = (i, change) => `<div class="sh-car">${spinEl(i)}<div><b>${name(CARS[i])}</b><span class="num">Bay ${pad(i)} · ${naira(CARS[i].usd)}</span></div>${change ? `<button type="button" class="sh-change" data-act="change" aria-expanded="${!!flow.picking}">${flow.picking ? 'Close' : 'Change'}</button>` : ''}</div>`;
const picker = f => !f.picking ? '' : `<div class="pick">${CARS.map((c, i) => `<button type="button" data-pick="${i}" class="${i === f.car ? 'on' : ''}">${spinEl(i)}<b>${name(c)}</b><span class="num">${naira(c.usd)}</span></button>`).join('')}</div>`;
const seg = (key, opts, on) => `<div class="seg two" data-seg="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(on) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const daysPick = f => `${lbl('Day')}<div class="days">${openDays().map(x => { const v = x.toISOString(); return `<button type="button" data-day="${v}" class="${f.day === v ? 'on' : ''}"><small>${x.toLocaleDateString('en-GB', { weekday: 'short' })}</small><b>${x.getDate()}</b></button>`; }).join('')}</div>`;
const slotsPick = (f, noLast) => { const taken = f.day ? new Date(f.day).getDate() % 3 : -1; return `${lbl('Time')}<div class="slots">${SLOTS.map((t, k) => `<button type="button" data-slot="${t}" ${f.day && (k === taken || (noLast && k === 4)) ? 'disabled' : ''} class="${f.slot === t ? 'on' : ''}">${t}</button>`).join('')}</div>`; };
const contact = (phoneLbl = 'Phone') => `${lbl('Your name', 'fName')}<input id="fName" autocomplete="name" placeholder="Full name" value="${esc(me.name)}">${lbl(phoneLbl, 'fPhone')}<div class="phone"><span>+234</span><input id="fPhone" inputmode="tel" autocomplete="tel-national" placeholder="803 000 0000" value="${esc(me.phone)}"></div>`;
const foot = (cta, fine) => `<p class="err" role="alert"></p><button type="button" class="cta wide" data-act="go">${cta}</button>${fine ? `<p class="fine">${fine}</p>` : ''}`;
const kv = rows => `<dl class="kv num">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
const done = (over, h, p, rows, acts) => `<div class="done"><p class="over">${over}</p><h4>${h}</h4><p>${p}</p>${kv(rows)}<div class="acts">${acts}</div></div>`;
const btn = (cls, act, label) => `<button type="button" class="${cls}" data-act="${act}">${label}</button>`;
const doneBtn = (cls = 'ghost') => btn(cls, 'close', 'Done');

/* finance maths */
function plan(f) {
  const P = priceN(f.car), dep = P * f.dep / 100, fin = P - dep, r = APR / 12, n = +f.term;
  const m = fin * r / (1 - Math.pow(1 + r, -n));
  return { P, dep, fin, m, total: dep + m * n };
}
const finOut = f => { const p = plan(f); return `<small class="lbl">Every month</small><b class="num">${fmtN(p.m)}</b>${kv([['Deposit today', fmtN(p.dep)], ['Financed', fmtN(p.fin)], ['Total repaid', fmtN(p.total)]])}`; };

/* the flows */
const FLOWS = {
  book: {
    title: 'Book a viewing',
    view: f => {
      const kind = f.visit || 'Viewing';
      const cta = f.day && f.slot ? `Book it · ${dayShort(f.day)}, ${f.slot}` : 'Book it';
      return `${carRow(f.car, true)}${picker(f)}${seg('visit', [['Viewing', 'Viewing at the lot'], ['Test drive', 'Test drive']], kind)}${daysPick(f)}${slotsPick(f, kind === 'Test drive')}${contact()}${foot(cta, 'Test drives need a valid licence and a refundable ₦5M hold. Viewings are free.')}`;
    },
    go: f => !f.day ? 'Pick a day.' : !f.slot ? 'Pick a time.' : checkContact(),
    done: f => {
      const kind = f.visit || 'Viewing';
      return done('Booked', `See you ${weekday(f.day)}, ${first()}.`, `${FLOOR} from the floor team will text you on ${phoneFmt()} the day before to confirm.`,
        [['Car', name(CARS[f.car])], [kind, `${dayLong(f.day)}, ${f.slot}`], ['Where', ADDRESS], kind === 'Test drive' && ['Bring', 'Your licence. ₦5M refundable hold on the day.']],
        btn('cta', 'close', 'Done') + btn('ghost', 'ics', 'Add to calendar'));
    },
  },

  reserve: {
    title: 'Reserve this car',
    view: f => {
      const dep = priceN(f.car) * 0.05, until = new Date(Date.now() + 7 * 864e5);
      return `${carRow(f.car)}<div class="deal"><div><small class="lbl">Deposit</small><b class="num">${fmtN(dep)}</b><span>5% of ${naira(CARS[f.car].usd)}</span></div><div><small class="lbl">Held until</small><b class="num">${until.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</b><span>7 days</span></div></div>
        ${lbl('How it works')}<ol class="steps"><li><b>1</b><span>We text you a secure payment link.</span></li><li><b>2</b><span>The car comes off the lot the moment the deposit lands.</span></li><li><b>3</b><span>Inspect it within 7 days. Walk away and the deposit comes back in full.</span></li></ol>
        ${contact()}${foot(`Reserve for ${fmtN(dep)}`, 'No payment is taken on this page.')}`;
    },
    go: () => checkContact(),
    after: f => { reserved.set(f.car, { dep: priceN(f.car) * 0.05, until: new Date(Date.now() + 7 * 864e5), phone: phoneFmt(), first: first() }); syncCar(f.car); },
    done: f => {
      const r = reserved.get(f.car);
      return done('Reserved', `Held for you, ${r.first}.`, `We've texted a payment link to ${r.phone}. Pay the ${fmtN(r.dep)} deposit within 2 hours and the ${name(CARS[f.car])} stays off the lot until ${dayLong(r.until)}.`,
        [['Car', name(CARS[f.car])], ['Deposit', fmtN(r.dep)], ['Held until', dayLong(r.until)], ['Refund', 'In full if you walk away after the inspection']],
        btn('cta', 'book', 'Book the inspection') + doneBtn());
    },
  },

  walk: {
    title: 'Walkaround video',
    view: f => {
      const how = f.how || 'video', chips = ['Cold start', 'Cabin', 'Underside', 'Tyres and brakes', 'Paperwork'];
      const body2 = how === 'video'
        ? `${lbl('What should we show you?')}<div class="chips">${chips.map(c => `<button type="button" data-chip="${c}" aria-pressed="${f.show.has(c)}" class="${f.show.has(c) ? 'on' : ''}">${c}</button>`).join('')}</div>`
        : daysPick(f) + slotsPick(f);
      const cta = how === 'video' ? 'Request the video' : f.day && f.slot ? `Book the call · ${dayShort(f.day)}, ${f.slot}` : 'Book the call';
      const fine = how === 'video' ? 'Filmed on the lot on a phone, unedited, usually within 24 hours.' : 'About 20 minutes on WhatsApp video with someone standing next to the car. Ask them to show you anything.';
      return `${carRow(f.car)}${seg('how', [['video', 'Recorded video'], ['live', 'Live video call']], how)}${body2}${contact('WhatsApp number')}${foot(cta, fine)}`;
    },
    go: f => (f.how || 'video') === 'video' ? (!f.show.size ? 'Pick at least one thing to film.' : checkContact()) : (!f.day ? 'Pick a day.' : !f.slot ? 'Pick a time.' : checkContact()),
    done: f => (f.how || 'video') === 'video'
      ? done('Requested', `Filming it today, ${first()}.`, `${FLOOR} will send the video on WhatsApp to ${phoneFmt()} by tomorrow, 18:00.`,
        [['Car', name(CARS[f.car])], ['Showing', [...f.show].join(', ')], ['Sent to', phoneFmt()]], doneBtn('cta'))
      : done('Call booked', `Talk ${weekday(f.day)}, ${first()}.`, `${FLOOR} will video call you on WhatsApp at ${f.slot}, standing next to the car.`,
        [['Car', name(CARS[f.car])], ['Call', `${dayLong(f.day)}, ${f.slot}`], ['On', `WhatsApp, ${phoneFmt()}`]], btn('cta', 'close', 'Done') + btn('ghost', 'ics', 'Add to calendar')),
  },

  fin: {
    title: 'Finance',
    view: f => {
      if (f.step === 2) {
        const p = plan(f);
        return `${carRow(f.car)}<div class="sum"><div><b class="num">${fmtN(p.m)} a month</b><span class="num">${f.term} months · ${f.dep}% down</span></div>${btn('sh-change', 'back', 'Edit')}</div>
          ${lbl('How you earn')}${seg('work', [['Salaried', 'Salaried'], ['Self-employed', 'Self-employed'], ['Company', 'Company']], f.work)}${contact()}${foot('Send for pre-approval', 'We only use this to match you with a lender.')}`;
      }
      return `${carRow(f.car, true)}${picker(f)}<p class="lbl"><label for="finDep">Deposit</label><span class="num" id="finDepLbl">${f.dep}%</span></p>
        <input type="range" id="finDep" min="30" max="70" step="5" value="${f.dep}" style="--p:${(f.dep - 30) / 40 * 100}%" aria-valuetext="${f.dep}% deposit">
        ${lbl('Over')}${seg('term', [[12, '12 mo'], [24, '24 mo'], [36, '36 mo'], [48, '48 mo']], f.term)}
        <div class="fin-out" id="finOut">${finOut(f)}</div>${foot('Get pre-approved', `Indicative figures at ${APR * 100}% a year from our lending partners. Final terms depend on approval.`)}`;
    },
    go: f => f.step !== 2 ? 'next' : !f.work ? 'Pick how you earn.' : checkContact(),
    done: f => {
      const p = plan(f);
      return done('Sent', `An answer within 48 hours, ${first()}.`, `A finance manager will call ${phoneFmt()} with your pre-approval and the documents you'll need.`,
        [['Car', name(CARS[f.car])], ['Plan', `${fmtN(p.m)} a month for ${f.term} months`], ['Deposit', `${fmtN(p.dep)} (${f.dep}%)`]],
        btn('cta', 'book', 'Book a viewing') + doneBtn());
    },
  },

  sell: {
    title: 'Sell or trade in',
    view: f => `${lbl('Your car', 'sModel')}<input id="sModel" data-field="model" placeholder="Make and model, e.g. Lexus LX 600" value="${esc(f.model)}">
      <div class="cols"><div>${lbl('Year', 'sYear')}<input id="sYear" data-field="year" inputmode="numeric" maxlength="4" placeholder="2021" value="${esc(f.year)}"></div><div>${lbl('Mileage, km', 'sKm')}<input id="sKm" data-field="miles" inputmode="numeric" placeholder="40,000" value="${esc(f.miles)}"></div></div>
      ${lbl('Condition')}${seg('cond', [['Excellent', 'Excellent'], ['Good', 'Good'], ['Fair', 'Fair']], f.cond)}
      ${lbl('Trade toward a car here?')}<div class="chips">${[['none', 'Just selling'], ...CARS.map((c, i) => [String(i), c.model])].map(([v, l]) => `<button type="button" data-trade="${v}" aria-pressed="${f.trade === v}" class="${f.trade === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${contact()}${foot('Get my offer', 'An appraiser looks at it on the lot or at your home in Lagos. Offers hold for 7 days.')}`,
    go: f => {
      const y = +f.year;
      return (f.model || '').trim().length < 3 ? 'Tell us the make and model.' : !(y >= 1990 && y <= new Date().getFullYear() + 1) ? 'Check the year.' : !(f.miles || '').replace(/\D/g, '') ? 'Add the mileage.' : !f.cond ? 'Pick the condition.' : checkContact();
    },
    done: f => {
      const toward = f.trade && f.trade !== 'none' ? +f.trade : -1, kmv = (+f.miles.replace(/\D/g, '')).toLocaleString('en-US');
      return done('Received', `An offer within 24 hours, ${first()}.`, `An appraiser will call ${phoneFmt()} to arrange a look at your ${esc(f.model.trim())}.`,
        [['Your car', `${esc(f.year)} ${esc(f.model.trim())}`], ['Mileage', `${kmv} km`], ['Condition', f.cond], ['Toward', toward >= 0 ? name(CARS[toward]) : 'Selling outright']],
        toward >= 0 ? btn('cta', 'book', `Book a viewing of the ${esc(CARS[toward].model)}`) + doneBtn() : doneBtn('cta'));
    },
  },

  visit: {
    title: 'Visit the lot',
    view: () => {
      const st = lotStatus();
      return `<p class="vis-st${st.open ? ' open' : ''}"><i></i>${st.text}</p><p class="vis-addr">14 Alexander Avenue<br>Ikoyi, Lagos</p>
        ${kv([['Monday to Saturday', '10:00 to 18:00'], ['Sunday', 'Closed'], ['Parking', 'Valet at the gate'], ['Viewings', 'Free, about 45 minutes'], ['Test drives', 'Licence and a refundable ₦5M hold']])}
        <div class="acts"><a class="ghost" href="https://www.google.com/maps/search/?api=1&query=Alexander%20Avenue%2C%20Ikoyi%2C%20Lagos" target="_blank" rel="noopener">Get directions</a>${btn('cta', 'book', 'Book a viewing')}</div>`;
    },
  },

  menu: {
    title: 'Menu',
    view: () => `<div class="rows">${[['sell', 'Sell or trade in', 'An offer within 24 hours'], ['fin', 'Finance', 'Monthly payments on any car'], ['visit', 'Visit the lot', lotStatus().text], ['credits', 'Credits', 'Models, sound and type']].map(([k, t, s]) => `<button type="button" class="row" data-open="${k}"><b>${t}</b><span>${s}</span></button>`).join('')}</div>`,
  },

  credits: {
    title: 'Credits',
    view: () => `<div class="cred">${cred.innerHTML}</div>`,
  },
};

/* rendering */
function render() {
  const F = FLOWS[flow.id];
  shTitle.textContent = F.title;
  shBody.innerHTML = flow.done ? F.done(flow) : F.view(flow);
  shBody.querySelectorAll('.spin').forEach(liven);
}
function openFlow(id, car = currentCar(), extra = {}) {
  flow = { id, car, dep: 40, term: 36, show: new Set(['Cold start', 'Cabin']), ...extra };
  if (id === 'reserve' && reserved.has(car)) flow.done = true;
  render();
  shBody.scrollTop = 0;
  cred.classList.remove('show'); hideTag(); clearHover();
  sheet.inert = false; body.classList.add('booking');
  controls.enabled = false;
  if (!isTouch) setTimeout(() => shBody.querySelector('button:not(:disabled):not(.sh-change), input')?.focus({ preventScroll: true }), 450);
}
const openSheet = i => openFlow('book', i);
function closeSheet() {
  body.classList.remove('booking'); sheet.inert = true; flow = null;
  if (mode === 'room' || mode === 'close') controls.enabled = true;
}
function grab() {
  const n = $('#fName'), p = $('#fPhone');
  if (n) me.name = n.value; if (p) me.phone = p.value;
  shBody.querySelectorAll('[data-field]').forEach(el => { flow[el.dataset.field] = el.value; });
}
function rerender(focusSel) {
  const y = shBody.scrollTop; render(); shBody.scrollTop = y;
  if (focusSel) shBody.querySelector(focusSel)?.focus({ preventScroll: true });
}
function ics() {
  const f = flow, d = new Date(f.day), [hh, mm] = f.slot.split(':').map(Number);
  const start = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), hh - 1, mm); // the lot keeps Lagos time, UTC+1 all year
  const len = f.id === 'walk' ? 20 : f.visit === 'Test drive' ? 60 : 45;
  const z = t => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const what = f.id === 'walk' ? 'Video call' : (f.visit || 'Viewing');
  const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kestrel Motor House//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@kestrel`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(start)}`, `DTEND:${z(start + len * 60000)}`,
    `SUMMARY:${what}: ${name(CARS[f.car])} at Kestrel`, `LOCATION:${f.id === 'walk' ? 'WhatsApp video' : ADDRESS.replace(/,/g, '\\,')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = `kestrel-${what.toLowerCase().replace(/\s+/g, '-')}.ics`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Saved. Open the file to add it to your calendar.');
}
function act(a) {
  if (a === 'close') return closeSheet();
  if (a === 'ics') return ics();
  if (a === 'book') return openFlow('book', flow.car);
  if (a === 'change') { flow.picking = !flow.picking; return rerender('.sh-change'); }
  if (a === 'back') { flow.step = 1; return rerender(); }
  if (a === 'go') {
    const F = FLOWS[flow.id], err = F.go(flow);
    if (err === 'next') { flow.step = 2; flow.picking = false; render(); shBody.scrollTop = 0; return; }
    const e = shBody.querySelector('.err');
    if (err) { e.textContent = ''; void e.offsetWidth; e.textContent = err; return; }
    F.after?.(flow); flow.done = true; render(); shBody.scrollTop = 0;
    shBody.querySelector('.done .cta')?.focus({ preventScroll: true });
  }
}
shBody.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled || !flow) return;
  const wasFocus = document.activeElement === b;
  grab();
  let fs = null;
  if (b.dataset.act) return act(b.dataset.act);
  if (b.dataset.open) return openFlow(b.dataset.open, flow.car);
  if (b.dataset.day) { flow.day = b.dataset.day; flow.slot = null; fs = `[data-day="${b.dataset.day}"]`; }
  else if (b.dataset.slot) { flow.slot = b.dataset.slot; fs = `[data-slot="${b.dataset.slot}"]`; }
  else if (b.dataset.pick != null) { flow.car = +b.dataset.pick; flow.picking = false; fs = '.sh-change'; }
  else if (b.dataset.chip) { const c = b.dataset.chip; flow.show.has(c) ? flow.show.delete(c) : flow.show.add(c); fs = `[data-chip="${c}"]`; }
  else if (b.dataset.trade) { flow.trade = flow.trade === b.dataset.trade ? null : b.dataset.trade; fs = `[data-trade="${b.dataset.trade}"]`; }
  else if (b.closest('[data-seg]')) {
    const k = b.closest('[data-seg]').dataset.seg; flow[k] = b.dataset.v; fs = `[data-seg="${k}"] [data-v="${b.dataset.v}"]`;
    if (k === 'visit' && flow.visit === 'Test drive' && flow.slot === SLOTS[4]) flow.slot = null;
    if (k === 'how') { flow.day = flow.slot = null; }
  } else return;
  rerender(wasFocus ? fs : null);
});
shBody.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'fPhone') t.value = t.value.replace(/[^\d ]/g, '').slice(0, 13);
  if (t.id === 'sYear') t.value = t.value.replace(/\D/g, '').slice(0, 4);
  if (t.id === 'sKm') { const n = t.value.replace(/\D/g, '').slice(0, 7); t.value = n ? (+n).toLocaleString('en-US') : ''; }
  if (t.id === 'finDep') {
    flow.dep = +t.value; t.style.setProperty('--p', `${(flow.dep - 30) / 40 * 100}%`); t.setAttribute('aria-valuetext', `${flow.dep}% deposit`);
    $('#finDepLbl').textContent = `${flow.dep}%`; $('#finOut').innerHTML = finOut(flow);
  }
});
shBody.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input:not([type=range])')) { grab(); act('go'); } });
$('#shClose').addEventListener('click', closeSheet);
$('#dim').addEventListener('click', closeSheet);

/* what each button on the page opens */
$('#bookCard').addEventListener('click', () => openFlow('book', sel));
$('#bookTop').addEventListener('click', () => openFlow('book', currentCar()));
$('#reserveCard').addEventListener('click', () => openFlow('reserve', sel));
$('#walkCard').addEventListener('click', () => openFlow('walk', sel));
document.querySelectorAll('.top [data-open]').forEach(b => b.addEventListener('click', () => openFlow(b.dataset.open)));

/* a reserved car says so everywhere it appears */
function syncCar(i) {
  if (i !== sel) return;
  const r = reserved.has(i), b = $('#reserveCard');
  b.textContent = r ? 'Reserved' : 'Reserve';
  b.classList.toggle('held', r);
  $('#cOver').textContent = `Bay ${pad(i)} · ${CARS[i].year} · ${km(CARS[i].km)}${r ? ' · Held for you' : ''}`;
}

/* ---------- keyboard ---------- */
addEventListener('keydown', e => {
  if (e.target.matches('input')) return;
  if (e.key === 'Escape') {
    if (body.classList.contains('booking')) closeSheet();
    else if (mode === 'close') closeDown();
    else if (mode === 'room') exitRoom();
    return;
  }
  if (mode === 'lot' && !body.classList.contains('booking')) {
    const step = d => { let j = Math.round(sT) + d; while (j >= 0 && j < N && !matches(j)) j += d; if (j >= 0 && j < N) walkTo(j); };
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'Enter' && e.target === body) enterRoom(Math.round(s));
  }
});

/* ---------- resize ---------- */
// Resolution follows the GPU: measured during warm-up, then nudged while running.
function setQuality(q) {
  if (window.__capDPR) return;
  q = clamp(Math.round(q * 20) / 20, Math.min(DPR, 1), DPR);
  if (q === quality) return;
  quality = q; renderer.setPixelRatio(q); composer.setPixelRatio(q); resize();
}
let fpsAcc = 0, fpsN = 0, warmAcc = 0;
function trackFps(raw) {
  if (mode === 'warm' || flight || raw > 0.25) return;
  fpsAcc += raw; fpsN++;
  if (fpsAcc > 1.5) {
    const fps = fpsN / fpsAcc; fpsAcc = fpsN = 0;
    if (fps < 40) setQuality(quality * Math.max(0.8, Math.sqrt(fps / 52)));
    else if (fps > 58) setQuality(quality + 0.05);
  }
}
function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  const [w, h] = reflRes(); ground.getRenderTarget().setSize(w, h);
}
addEventListener('resize', resize);

/* ---------- per-frame ---------- */
const flick = t => { // a tube striking: a few stutters, then steady
  if (t <= 0) return 0;
  const seq = [[0, .7], [.05, .05], [.11, .85], [.17, .2], [.25, 1], [.31, .55], [.37, 1]];
  let v = 0; for (const [a, b] of seq) if (t >= a) v = b; return v;
};
const _p = new V3(), _t = new V3(), _s = new V3();
let arriveT0 = 0, last = performance.now(), frame = 0, viewShift = -120, viewShiftY = 0, warmN = 0;

function project(v) { _s.copy(v).project(camera); return { x: (_s.x * .5 + .5) * innerWidth, y: (-_s.y * .5 + .5) * innerHeight, z: _s.z }; }

function loop(now) {
  requestAnimationFrame(loop);
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now; frame++;
  if (mode === 'warm') {
    warmN = raw < 0.12 ? warmN + 1 : 0; warmAcc = warmN ? warmAcc + raw : 0;
    if ((warmN >= 4 || frame > 90) && ldReady()) {
      if (warmN >= 4) setQuality(DPR * Math.min(1, Math.sqrt((warmN / warmAcc) / 52)));
      mode = 'arrive'; arriveT0 = reduce ? now - 1e6 : now + 450;
      body.classList.remove('is-loading'); fadeTo(0, reduce ? 300 : 1700);
      if (!reduce) ldLaunch();
    }
  }
  runTweens(now);
  trackFps(raw);
  par.lerp(parT, 1 - Math.exp(-dt * 2.2));

  // camera
  if (mode === 'arrive') {
    const at = (now - arriveT0) / 1000;
    const k = ease(clamp((at - 3.3) / 4.2, 0, 1));
    lotPose(0, _p, _t);
    camera.position.lerpVectors(ARRIVE_POS, _p, k);
    look.lerpVectors(ARRIVE_TGT, _t, k);
    camera.position.x += Math.sin(at * 0.4) * 0.04 * (1 - k);
    camera.lookAt(look);
    signOn = clamp(at / 0.9, 0, 1);
    bays.forEach((b, i) => { b.on = flick(at - (1.0 + i * 0.32)); });
    if (at > 6.4 && !body.classList.contains('ready')) body.classList.add('ready');
    if (at > 7.5) { mode = 'lot'; bays.forEach(b => { b.on = 1; }); }
  } else if (!runFlight(now)) {
    if (mode === 'lot') {
      s += (sT - s) * (1 - Math.exp(-dt * 4.2));
      lotPose(s, _p, _t);
      camera.position.copy(_p); look.copy(_t); camera.lookAt(look);
      const fb = Math.round(clamp(s, 0, N - 1));
      if (fb !== focusBay) { focusBay = fb; setFocusBay(fb); setAccent(fb); }
    } else if (mode === 'room' || mode === 'close') {
      controls.update(dt);
      look.copy(controls.target);
    }
  }

  // hover picking (one raycast per frame at most)
  if (ptr.moved && !ptr.down && !body.classList.contains('booking')) {
    ptr.moved = false;
    if (mode === 'lot') {
      const b = pickBay(ptr.x, ptr.y);
      if (b !== hovBay) { hovBay = b; body.classList.toggle('hovering', b >= 0); if (b < 0) hideTag(); else fillTag(b); }
    } else if (mode === 'room' && ptr.type === 'mouse') {
      setHover(pickPart(ptr.x, ptr.y));
    }
  }
  if (mode !== 'lot' && hovBay >= 0) { hovBay = -1; hideTag(); }
  if (hovBay >= 0) {
    const q = project(_p.set(bayX(hovBay), 1.62, 0));
    tagEl.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -100%)`;
  }
  if (hover && (mode === 'room')) {
    const q = project(hover.point);
    pinEl.style.transform = `translate(${q.x}px, ${q.y}px)`;
    pinEl.classList.toggle('flip', q.x > innerWidth - 330);
  }
  engine.update(Math.min(raw, 0.2));
  const rpm = engine.rpm;
  if (body.classList.contains('in-room')) {
    rpmEl.textContent = engine.running ? Math.round((700 + rpm * 8300) / 50) * 50 : 0;
    tachEl.style.transform = `scaleX(${engine.running ? (0.08 + rpm * 0.92).toFixed(3) : 0})`;
  }
  // turntable spin; cars that are not on show glide back to face the row
  bays.forEach((b, i) => {
    b.spin ??= 0; b.spinV ??= 0; b.car.userData.ry0 ??= b.car.rotation.y;
    const shown = i === sel && body.classList.contains('in-room');
    if (shown && mode === 'room' && !reduce) {
      const idle = now - touchT > 3500 && !hover && !ptr.down;
      b.spinV += ((idle ? 0.17 : 0) - b.spinV) * (1 - Math.exp(-dt * (idle ? 0.8 : 4)));
      b.spin += b.spinV * dt;
    } else if (!shown) {
      b.spinV = 0;
      const home = Math.round(b.spin / TAU) * TAU;
      b.spin += (home - b.spin) * (1 - Math.exp(-dt * 2.4));
    }
    b.car.rotation.y = b.car.userData.ry0 + b.spin;
  });
  if (body.classList.contains('coach-on')) {
    const cx = bayX(sel), d = _p.copy(camera.position).setY(0).sub(_t.set(cx, 0, 0)).normalize().multiplyScalar(2.9);
    const q = project(_t.set(cx, 0, 0).add(d));
    coachEl.style.transform = `translate(${q.x}px, ${Math.min(q.y, innerHeight - 190)}px) translate(-50%, -50%)`;
  }
  { const c = bays[sel].car; c.userData.y0 ??= c.position.y;
    const sh = Math.max(0, rpm - 0.09);
    c.position.y = c.userData.y0 + sh * 0.006 * Math.sin(now * 0.11) * Math.sin(now * 0.047);
    c.rotation.z = sh * 0.0035 * Math.sin(now * 0.083); }
  glowK = Math.min(1, glowK + dt * 4);
  glowMat.uniforms.uOp.value = glowCls ? (0.7 + 0.3 * Math.sin(now / 420)) * easeOut(glowK) : 0;

  // bay lighting
  const inRoom = mode === 'room' || mode === 'close' || (mode === 'fly' && body.classList.contains('in-room'));
  bays.forEach((b, i) => {
    let tgt = 1;
    if (inRoom) tgt = i === sel ? 1.35 : 0.12;
    else { if (!matches(i)) tgt = 0.16; if (i === hovBay) tgt = 1.3; }
    b.lvl += (tgt - b.lvl) * (1 - Math.exp(-dt * 3.5));
    const v = b.on * b.lvl;
    b.barMat.color.setScalar(3.2 * b.on * Math.min(1.15, 0.25 + b.lvl));
    pools[i] = v;
    b.numMat.color.setScalar(0.03 + v * 0.3);
    // headlights and tail lights
    const lit = lightsOn && i === sel && inRoom ? 1 : 0;
    b.lamps.forEach(m => { if (m.emissive) { m.emissive.setRGB(1, .97, .92); m.emissiveIntensity += (lit * 4 - m.emissiveIntensity) * (1 - Math.exp(-dt * 8)); } });
    const tl = Math.max(lit * 5, i === sel && inRoom && engine.running ? 0.8 + rpm * 6 : 0);
    b.tails.forEach(m => { if (m.emissive) { m.emissive.setRGB(1, .05, .03); m.emissiveIntensity += (tl - m.emissiveIntensity) * (1 - Math.exp(-dt * 8)); } });
  });
  // area lights follow the camera along the row; studio and waterfront set their own
  if (env === 'lot') {
    const lb = look.x / GAP, c = clamp(Math.round(lb), 1, N - 2);
    [c - 1, c, c + 1].forEach((i, k) => { const b = bays[i], w = clamp(1.5 - Math.abs(i - lb), 0, 1); poolDown(POOL[k], bayX(i) + Math.sin(YAW) * 0.1, Math.cos(YAW) * 0.1, 1.9, 5.2, 4.2 * b.on * b.lvl * (inRoom || mode === 'arrive' ? 1 : w)); });
  } else if (env === 'studio') poolStudio();
  else POOL.forEach(l => { l.intensity = 0; });
  // keep neighbours out of the way while orbiting in the lot
  if (inRoom && env === 'lot') bays.forEach((b, i) => { if (i !== sel) b.pivot.visible = camera.position.distanceTo(b.pivot.position) > 3.6; });
  else if (env === 'lot') bays.forEach(b => { b.pivot.visible = true; });

  signMat.color.setRGB(2.1 * signOn, 1.98 * signOn, 1.82 * signOn);
  gu.uSign.value = signOn; wall.material.uniforms.uSign.value = signOn;
  const fog = scene.fog || fogLot;
  for (const u of [gu, wall.material.uniforms]) { u.uFogColor.value.copy(fog.color); u.uFogNear.value = fog.near; u.uFogFar.value = scene.fog ? fog.far : 1e6; }
  grade.uniforms.uTime.value = now / 1000;
  const wide = innerWidth > 820, inR = body.classList.contains('in-room');
  const shiftT = !wide ? 0 : inR ? (body.classList.contains('closeup') ? 150 : 175) : -120;
  viewShift += (shiftT - viewShift) * (1 - Math.exp(-dt * 2.6));
  // on a phone the card covers the lower half, so the car rides higher
  viewShiftY += ((!wide ? innerHeight * (inR ? 0.16 : 0.1) : 0) - viewShiftY) * (1 - Math.exp(-dt * 2.6));
  const shk = inRoom && !reduce ? Math.pow(Math.max(0, rpm - 0.12), 1.6) * 3.4 : 0;
  camera.setViewOffset(innerWidth, innerHeight, viewShift + shk * (Math.sin(now * 0.071) + 0.6 * Math.sin(now * 0.13)), viewShiftY + shk * 0.8 * Math.sin(now * 0.097 + 1.3), innerWidth, innerHeight);
  bloom.strength = (env === 'studio' ? 0.16 : 0.24) + (inRoom ? rpm * 0.12 : 0);

  composer.render(dt);
}

function fillTag(i) {
  const c = CARS[i];
  tagEl.querySelector('b').textContent = `Bay ${pad(i)}`;
  tagEl.querySelector('.tn').textContent = name(c);
  tagEl.querySelector('.tp').textContent = `${c.year} · ${naira(c.usd)}${reserved.has(i) ? ' · Reserved' : ''}`;
  tagEl.classList.add('show');
}

/* ---------- go ---------- */
ld.done = true;
camera.position.copy(ARRIVE_POS); look.copy(ARRIVE_TGT); camera.lookAt(look);
mode = 'warm';
studio.visible = true;   // compile the studio set now too, so the first switch into it never stalls
// compile against the post-processing target: frames render there (linear, no tone mapping), so these are the shaders actually used
renderer.setRenderTarget(composer.readBuffer);
try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
renderer.setRenderTarget(null);
studio.visible = env === 'studio';
requestAnimationFrame(t => { last = t; loop(t); });
window.__k = { spins, get quality() { return quality; }, get walk() { return sT; }, bloom, ground, composer, renderer, POOL, get frame() { return frame; }, get dbg() { return { arriveT0, now: performance.now(), mode, reduce, cam: camera.position.toArray() }; }, scene, camera, bays, enterRoom, exitRoom, setEnv, get mode() { return mode; }, closeUp, pickPart, openSheet, walkTo, engine };
