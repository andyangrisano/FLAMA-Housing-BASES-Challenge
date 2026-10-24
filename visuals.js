// Shared look: a physically based sky that also lights the scene, and procedural textures drawn on canvases
// (no image downloads, so the site stays self-contained on GitHub Pages).
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

function rng(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const shade = (hex, f) => { const c = new THREE.Color(hex); c.multiplyScalar(f); return `#${c.getHexString()}`; };

function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size, rng(size * 7 + draw.length));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// speckle noise: n random dots of size r..R in shades around the base colour
function speckle(g, s, r, base, n, size, spread) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    g.fillStyle = shade(base, 1 + (r() - 0.5) * spread);
    const w = size[0] + r() * (size[1] - size[0]);
    g.fillRect(r() * s, r() * s, w, w);
  }
}

export function makeTextures() {
  const T = {
    grass: canvasTexture(256, (g, s, r) => {
      speckle(g, s, r, '#5d8a41', 2600, [1, 3], 0.45);
      for (let i = 0; i < 900; i++) { g.strokeStyle = shade('#6c9a4a', 0.8 + r() * 0.5); g.beginPath(); const x = r() * s, y = r() * s; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); g.stroke(); }
    }),
    dirt: canvasTexture(256, (g, s, r) => speckle(g, s, r, '#6a4f37', 3000, [1, 4], 0.5)),
    gravel: canvasTexture(256, (g, s, r) => { speckle(g, s, r, '#8b857a', 1400, [2, 6], 0.55); }),
    concrete: canvasTexture(256, (g, s, r) => speckle(g, s, r, '#b9b5ad', 4000, [1, 2], 0.18)),
    wetConcrete: canvasTexture(256, (g, s, r) => speckle(g, s, r, '#7d7a75', 3000, [1, 3], 0.25)),
    asphalt: canvasTexture(256, (g, s, r) => speckle(g, s, r, '#3b3e42', 5000, [1, 2], 0.5)),
    wood: canvasTexture(256, (g, s, r) => {
      g.fillStyle = '#cfa56c'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 70; i++) { g.strokeStyle = shade('#b88d55', 0.85 + r() * 0.3); g.lineWidth = 1 + r() * 2; g.beginPath(); const x = r() * s; g.moveTo(x, 0); g.bezierCurveTo(x + 6, s / 3, x - 6, 2 * s / 3, x + (r() - 0.5) * 8, s); g.stroke(); }
    }),
    osb: canvasTexture(256, (g, s, r) => {
      g.fillStyle = '#c49a62'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 700; i++) { g.save(); g.translate(r() * s, r() * s); g.rotate(r() * Math.PI); g.fillStyle = shade('#c49a62', 0.75 + r() * 0.45); g.fillRect(-9, -3, 18 + r() * 10, 5 + r() * 3); g.restore(); }
    }),
    shingles: canvasTexture(256, (g, s, r) => {
      g.fillStyle = '#3e4146'; g.fillRect(0, 0, s, s);
      const rows = 8, h = s / rows;
      for (let j = 0; j < rows; j++) for (let x = (j % 2) * 16 - 16; x < s; x += 32) {
        g.fillStyle = shade('#4a4d52', 0.8 + r() * 0.4); g.fillRect(x + 1, j * h + 1, 30, h - 3);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, j * h + h - 3, 32, 3);
      }
    }),
    siding: canvasTexture(256, (g, s, r) => {
      const rows = 12, h = s / rows;
      for (let j = 0; j < rows; j++) { g.fillStyle = shade('#d6d1c4', 0.96 + r() * 0.06); g.fillRect(0, j * h, s, h); g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, j * h + h - 2, s, 2); }
    }),
    stucco: canvasTexture(256, (g, s, r) => speckle(g, s, r, '#d8cbb3', 5000, [1, 2], 0.12)),
    drywall: canvasTexture(128, (g, s, r) => speckle(g, s, r, '#e6e3dc', 900, [1, 2], 0.05)),
    insulation: canvasTexture(128, (g, s, r) => speckle(g, s, r, '#e9c766', 1500, [2, 5], 0.3)),
    planks: canvasTexture(256, (g, s, r) => {            // hardwood floor, 4 boards per tile
      for (let i = 0; i < 4; i++) {
        const base = shade('#b48c62', 0.88 + r() * 0.24), y = i * s / 4, off = r() * s;
        g.fillStyle = base; g.fillRect(0, y, s, s / 4);
        for (let k = 0; k < 14; k++) { g.strokeStyle = shade(base, 0.85 + r() * 0.15); g.beginPath(); const yy = y + r() * s / 4; g.moveTo(0, yy); g.bezierCurveTo(s / 3, yy + 3, 2 * s / 3, yy - 3, s, yy + (r() - 0.5) * 4); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, s, 1.5); g.fillRect(off, y, 1.5, s / 4);
      }
    }),
    tiles: canvasTexture(256, (g, s, r) => {
      g.fillStyle = '#bdb8ae'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = shade('#e4e1da', 0.95 + r() * 0.08); g.fillRect(i * s / 4 + 2, j * s / 4 + 2, s / 4 - 4, s / 4 - 4); }
    }),
    carpet: canvasTexture(128, (g, s, r) => speckle(g, s, r, '#cfc7b8', 3000, [1, 2], 0.14)),
    // Greyscale detail maps: multiplied by a material's own colour, so one texture serves every wood / fabric / stone.
    grain: canvasTexture(256, (g, s, r) => {
      g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) { const v = 170 + r() * 70 | 0; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); const y = r() * s; g.moveTo(0, y); g.bezierCurveTo(s / 3, y + (r() - 0.5) * 10, 2 * s / 3, y + (r() - 0.5) * 10, s, y + (r() - 0.5) * 6); g.stroke(); }
    }),
    weave: canvasTexture(128, (g, s, r) => {
      g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 2) for (let x = 0; x < s; x += 2) { const v = ((x + y) / 2) % 2 ? 222 : 245; const n = v - r() * 18 | 0; g.fillStyle = `rgb(${n},${n},${n})`; g.fillRect(x, y, 2, 2); }
    }),
    stone: canvasTexture(256, (g, s, r) => { speckle(g, s, r, '#ececec', 3500, [1, 3], 0.16); for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(120,120,120,${0.15 + r() * 0.2})`; g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2); } }),
  };
  // A clone of a texture tiled `rx` x `ry` times (clones share the image).
  T.tile = (name, rx, ry = rx) => { const t = T[name].clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
  return T;
}

// Sky dome + matching environment lighting. sunDir points from the scene toward the sun.
export function makeSky(renderer, sunDir) {
  const sky = new Sky(); sky.scale.setScalar(800);     // inside the camera's far plane
  const u = sky.material.uniforms;
  u.turbidity.value = 3.5; u.rayleigh.value = 1.3; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(sunDir).normalize();
  const skyScene = new THREE.Scene(); skyScene.add(sky.clone());
  const env = new THREE.PMREMGenerator(renderer).fromScene(skyScene, 0.02).texture;
  return { sky, env };
}
