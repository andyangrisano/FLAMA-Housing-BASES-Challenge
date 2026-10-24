// The construction story, following the team's research: two robots build the house.
//   Robot 1 (outdoor): a compact track loader with an autonomy kit and swappable tools:
//     grading blade, bucket, plate compactor, auger, concrete screed head, and a 6 m boom with a robot arm.
//   Robot 2 (indoor): a 0.65 m wide mobile base with a lift column and a 6-axis arm with a tool changer:
//     insulation sprayer, drywall gripper, screw gun, router, mud sprayer, sander + vacuum, paint sprayer.
// People still frame the walls, pour the concrete, set windows and do plumbing, electrical and inspections.
// Every trench, slab, wall, truss and sheet comes from house.json, so the built house is the one you explore after.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import theatreCore from '@theatre/core';
const { getProject, types, onChange } = theatreCore;

export function createStory(ctx) {
  const { scene, camera, controls, S, H, meta, wallSegments, floors, site, fx, TEX } = ctx;
  const ease = k => k * k * (3 - 2 * k), clamp = (k, a = 0, b = 1) => Math.max(a, Math.min(b, k)), lerp = (a, b, k) => a + (b - a) * k;
  const seg01 = (k, a, b) => clamp((k - a) / (b - a));
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const H2 = meta.ceiling_height, WT = meta.wall_thickness;
  const root = new THREE.Group(); root.visible = false; scene.add(root);

  // ---------------------------------------------------------------- materials
  const std = o => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
  const tex = (name, rx, ry, o = {}) => std({ map: TEX.tile(name, rx, ry), roughness: 0.9, ...o });
  const C = {
    body: std({ color: '#f2f2f0', roughness: 0.35 }), joint: std({ color: '#2b2b2b', roughness: 0.45, metalness: 0.3 }),
    accent: std({ color: '#3a7bd5', roughness: 0.3, metalness: 0.1 }), rubber: std({ color: '#1f1f1f', roughness: 0.9 }),
    steel: std({ color: '#a3a8ad', roughness: 0.3, metalness: 0.8 }), glass: std({ color: '#2e3640', roughness: 0.05, metalness: 0.5 }),
    wood: tex('wood', 1, 3, { roughness: 0.8 }), dirt: tex('dirt', 3, 3, { roughness: 1 }), gravel: tex('gravel', 4, 4, { roughness: 1 }),
    drywall: tex('drywall', 1, 2, { roughness: 0.95 }), insulation: tex('insulation', 1, 3, { roughness: 1 }),
    siding: tex('siding', 3, 1.5), trim: std({ color: '#f4f1ea', roughness: 0.5 }),
    gutter: std({ color: '#55585c', roughness: 0.4, metalness: 0.4 }),
    pane: new THREE.MeshStandardMaterial({ color: '#a9c8d8', roughness: 0.04, transparent: true, opacity: 0.35 }),
    navy: std({ color: '#3a5a78' }), vest: std({ color: '#f07a2a', roughness: 0.7 }), hat: std({ color: '#f5f5f2', roughness: 0.3 }),
    skin: std({ color: '#c99a77', roughness: 0.8 }), pants: std({ color: '#33475b', roughness: 0.9 }),
    laser: new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.55 }),
    ring: new THREE.MeshBasicMaterial({ color: '#3a7bd5', transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    truck: std({ color: '#d9dcdf', roughness: 0.4, metalness: 0.3 }), drum: std({ color: '#e2702b', roughness: 0.5 }),
    mud: std({ color: '#f4f2ec', roughness: 1 }),
  };
  const shadowed = o => { o.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = !m.material.transparent; }); return o; };
  const mesh = (geo, material, x, y, z, parent = root) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); shadowed(o); parent.add(o); return o; };
  const rbox = (w, h, d, material, x, y, z, parent, r = 0.04) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), material, x, y, z, parent);
  const bx = (w, h, d, material, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  const cyl = (r, h, material, x, y, z, parent, rt = r, seg = 20) => mesh(new THREE.CylinderGeometry(rt, r, h, seg), material, x, y, z, parent);
  const grp = (parent = root, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // ---------------------------------------------------------------- the house as data
  const segs = wallSegments(0);
  const ext = segs.filter(s => s.exterior), inner = segs.filter(s => !s.exterior);
  const rects = H.rooms.filter(r => !(r.floor || 0) && !r.outdoor);
  const center = V(1.9, 0, 5);
  const midOf = s => s.axis === 'x' ? [(s.a + s.b) / 2, s.c] : [s.c, (s.a + s.b) / 2];
  const angleOf = (x, z) => Math.atan2(z - center.z, x - center.x);
  const along = (axis, c, a, b, y0, y1, depth, material, parent, off = 0) => {
    if (b - a < 1e-3 || y1 - y0 < 1e-3) return null;
    return axis === 'x' ? bx(b - a, y1 - y0, depth, material, (a + b) / 2, (y0 + y1) / 2, c + off, parent)
                        : bx(depth, y1 - y0, b - a, material, c + off, (y0 + y1) / 2, (a + b) / 2, parent);
  };

  // ---------------------------------------------------------------- people
  function worker(x, z) {
    const g = grp(root, x, 0, z);
    const legs = [-0.09, 0.09].map(dx => { const l = grp(g, dx, 0.85, 0); bx(0.12, 0.85, 0.14, C.pants, 0, -0.42, 0, l); return l; });
    rbox(0.42, 0.62, 0.26, C.vest, 0, 1.17, 0, g, 0.08); bx(0.43, 0.05, 0.27, C.hat, 0, 1.1, 0, g);
    mesh(new THREE.SphereGeometry(0.12, 16, 12), C.skin, 0, 1.6, 0, g);
    mesh(new THREE.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.hat, 0, 1.66, 0, g);
    return { g, legs, walk(phase) { legs[0].rotation.x = Math.sin(phase) * 0.5; legs[1].rotation.x = -Math.sin(phase) * 0.5; } };
  }
  const crew = [worker(-3, -3), worker(-2, -3.5), worker(4, -3)];
  function walkTo(w, p, dt, speed = 1.2) {
    const d = V(p.x - w.g.position.x, 0, p.z - w.g.position.z), dist = d.length();
    if (dist < 0.05) { w.walk(0); return true; }
    w.g.position.addScaledVector(d.normalize(), Math.min(dist, speed * dt));
    w.g.rotation.y = Math.atan2(d.x, d.z);
    w.walk(S.anim * 9);
    return false;
  }

  // ---------------------------------------------------------------- Robot 1: outdoor
  function robot1() {
    const g = grp(), R = { g };
    for (const sx of [-0.78, 0.78]) {
      rbox(0.42, 0.56, 2.7, C.rubber, sx, 0.28, 0, g, 0.18);
      for (const z of [-0.95, 0, 0.95]) cyl(0.17, 0.44, C.joint, sx, 0.28, z, g).rotation.z = Math.PI / 2;
    }
    rbox(1.2, 0.75, 2.2, C.body, 0, 0.9, -0.1, g, 0.12);
    rbox(1.3, 0.55, 0.8, C.body, 0, 1.0, -1.05, g, 0.1);
    rbox(1.0, 0.55, 0.9, C.glass, 0, 1.45, 0.25, g, 0.06);                        // cab, kept for manual override
    bx(0.95, 0.06, 0.6, C.joint, 0, 1.76, 0.2, g);                                // autonomy kit roof rack
    cyl(0.1, 0.1, C.accent, 0, 1.84, 0.25, g);                                    // lidar
    for (const x of [-0.38, 0.38]) cyl(0.12, 0.03, C.body, x, 1.81, -0.02, g);    // GPS antennas
    for (const x of [-0.55, 0.55]) bx(0.08, 0.06, 0.06, C.joint, x, 1.25, 0.95, g);    // cameras
    mesh(new THREE.SphereGeometry(0.07, 12, 8), std({ color: '#ffb02e', emissive: '#ff8a00', emissiveIntensity: 1 }), -0.42, 1.86, -0.2, g);
    R.arms = grp(g, 0, 1.25, -0.9);                                               // loader arms pivot at the back
    for (const sx of [-0.7, 0.7]) rbox(0.13, 0.2, 2.35, C.body, sx, -0.25, 1.15, R.arms, 0.05).rotation.x = 0.22;
    R.coupler = grp(R.arms, 0, -0.75, 2.25);
    bx(1.45, 0.4, 0.08, C.joint, 0, 0, 0, R.coupler);
    R.ring = mesh(new THREE.RingGeometry(3.4, 3.55, 64), C.ring, 0, 0.03, 0, g); R.ring.rotation.x = -Math.PI / 2;
    R.tool = null;
    return R;
  }
  const r1 = robot1();
  const toolBucket = () => { const g = new THREE.Group(); rbox(1.7, 0.55, 0.75, C.joint, 0, -0.05, 0.45, g, 0.05); for (let i = 0; i < 6; i++) bx(0.07, 0.05, 0.16, C.steel, -0.7 + i * 0.28, -0.3, 0.85, g); return g; };
  const toolBlade = () => { const g = new THREE.Group(); rbox(2.3, 0.6, 0.12, C.joint, 0, -0.05, 0.35, g, 0.03); bx(0.05, 1.4, 0.05, C.steel, 0.9, 0.65, 0.35, g); cyl(0.08, 0.2, C.accent, 0.9, 1.4, 0.35, g); return g; };
  const toolCompactor = () => { const g = new THREE.Group(); bx(1.0, 0.07, 0.8, C.steel, 0, -0.33, 0.5, g); rbox(0.55, 0.42, 0.45, C.accent, 0, -0.08, 0.5, g, 0.05); return g; };
  function toolAuger() {
    const g = new THREE.Group(); rbox(0.5, 0.5, 0.5, C.accent, 0, 0.1, 0.45, g, 0.05);
    const bit = grp(g, 0, -0.15, 0.45); cyl(0.05, 1.6, C.steel, 0, -0.8, 0, bit);
    for (let i = 0; i < 9; i++) cyl(0.17, 0.02, C.steel, 0, -0.2 - i * 0.16, 0, bit).rotation.z = 0.25;
    g.userData.bit = bit; return g;
  }
  function toolScreed() {
    const g = new THREE.Group(); rbox(0.5, 0.3, 0.4, C.accent, 0, 0.1, 0.5, g, 0.04); bx(0.08, 0.08, 1.0, C.steel, 0, -0.05, 0.9, g);
    rbox(3.2, 0.14, 0.32, C.steel, 0, -0.4, 1.4, g, 0.03);
    for (const x of [-1.4, 1.4]) { bx(0.04, 1.2, 0.04, C.steel, x, 0.25, 1.4, g); cyl(0.07, 0.18, C.accent, x, 0.9, 1.4, g); }
    return g;
  }
  function toolBoom() {          // telescoping boom; a short arm with a vacuum lifter hangs from the tip
    const g = new THREE.Group(); rbox(0.6, 0.5, 0.5, C.accent, 0, 0.1, 0.3, g, 0.05);
    const pitch = grp(g, 0, 0.3, 0.3);
    rbox(0.38, 0.38, 2.4, C.body, 0, 0, 1.2, pitch, 0.06);
    const s2 = grp(pitch); rbox(0.3, 0.3, 2.4, C.body, 0, 0, 1.2, s2, 0.05);
    const s3 = grp(s2); rbox(0.23, 0.23, 2.4, C.body, 0, 0, 1.2, s3, 0.04);
    const tip = grp(s3, 0, 0, 2.4), wrist = grp(tip);
    mesh(new THREE.SphereGeometry(0.14, 16, 12), C.joint, 0, 0, 0, wrist);
    bx(0.08, 0.7, 0.08, C.joint, 0, -0.35, 0, wrist); rbox(0.5, 0.08, 0.5, C.accent, 0, -0.74, 0, wrist, 0.03);
    g.userData = { pitch, s2, s3, wrist };
    return g;
  }
  const tools = { blade: toolBlade(), bucket: toolBucket(), compactor: toolCompactor(), auger: toolAuger(), screed: toolScreed(), boom: toolBoom() };
  Object.values(tools).forEach(shadowed);
  const rackPos = {}; Object.keys(tools).forEach((k, i) => { rackPos[k] = V(17.5, 0.42, -5.5 + i * 2.3); });     // tool rack on the east lawn
  const park = (name) => { const t = tools[name]; root.add(t); t.position.copy(rackPos[name]); t.rotation.set(0, -Math.PI / 2, 0); };
  function parkTools() { Object.keys(tools).forEach(park); r1.tool = null; }
  function equip(name) {
    if (r1.tool) park(Object.keys(tools).find(n => tools[n] === r1.tool));
    const t = tools[name]; r1.coupler.add(t); t.position.set(0, 0, 0.05); t.rotation.set(0, 0, 0); r1.tool = t;
  }
  // Point the boom so the lifter hangs over `target`. The robot must already face it.
  function aimBoom(target) {
    const u = tools.boom.userData; root.updateMatrixWorld(true);
    const base = u.pitch.getWorldPosition(V()), tipAt = target.clone().add(V(0, 0.8, 0));
    const fwd = V(Math.sin(r1.g.rotation.y), 0, Math.cos(r1.g.rotation.y));
    const horiz = Math.max(0.5, tipAt.clone().sub(base).dot(fwd)), up = tipAt.y - base.y, tilt = r1.arms.rotation.x;
    u.pitch.rotation.x = -Math.atan2(up, horiz) - tilt;
    const ext = (clamp(Math.hypot(horiz, up), 2.4, 6.6) - 2.4) / 2;
    u.s2.position.z = ext; u.s3.position.z = ext;
    u.wrist.rotation.x = -u.pitch.rotation.x - tilt;          // keep the lifter level
  }

  // ---------------------------------------------------------------- Robot 2: indoor
  function robot2() {
    const g = grp(), R = { g, L1: 0.6, L2: 0.55 };
    rbox(0.65, 0.34, 0.9, C.body, 0, 0.27, 0, g, 0.08); bx(0.66, 0.05, 0.91, C.accent, 0, 0.3, 0, g);
    for (const [x, z] of [[-0.3, 0.32], [0.3, 0.32], [-0.3, -0.32], [0.3, -0.32]]) cyl(0.1, 0.06, C.rubber, x, 0.1, z, g).rotation.z = Math.PI / 2;
    R.legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {      // outriggers: fold along the body, swing out to brace
      const l = grp(g, sx * 0.3, 0.16, sz * 0.42); bx(0.06, 0.06, 0.4, C.joint, 0, 0, 0.2, l); const foot = cyl(0.07, 0.03, C.joint, 0, -0.12, 0.38, l);
      const stow = sz > 0 ? Math.PI : 0, out = Math.atan2(sx, sz);                  // folded under the base / braced out diagonally
      l.userData = { stow, swing: Math.atan2(Math.sin(out - stow), Math.cos(out - stow)), foot }; return l;
    });
    cyl(0.14, 0.36, C.joint, 0, 0.62, -0.28, g);                                     // dust vacuum
    bx(0.04, 0.35, 0.04, C.joint, 0.24, 0.6, 0.38, g); R.lidar = cyl(0.07, 0.08, C.accent, 0.24, 0.82, 0.38, g);
    rbox(0.24, 0.8, 0.24, C.body, 0, 0.84, 0.05, g, 0.05);
    R.lift = grp(g, 0, 1.2, 0.05); rbox(0.18, 0.8, 0.18, C.joint, 0, -0.35, 0, R.lift, 0.04);
    const light = new THREE.PointLight('#fff1d6', 5, 6, 1.6); light.position.set(0, 0.2, 0.2); R.lift.add(light);   // work light
    R.yaw = grp(R.lift, 0, 0.08, 0); cyl(0.12, 0.1, C.joint, 0, 0, 0, R.yaw);
    R.upper = grp(R.yaw, 0, 0.1, 0); mesh(new THREE.SphereGeometry(0.1, 16, 12), C.joint, 0, 0, 0, R.upper); rbox(0.12, 0.12, R.L1, C.body, 0, 0, R.L1 / 2, R.upper, 0.04);
    R.fore = grp(R.upper, 0, 0, R.L1); mesh(new THREE.SphereGeometry(0.08, 16, 12), C.joint, 0, 0, 0, R.fore); rbox(0.1, 0.1, R.L2, C.body, 0, 0, R.L2 / 2, R.fore, 0.035);
    R.wrist = grp(R.fore, 0, 0, R.L2); mesh(new THREE.SphereGeometry(0.06, 14, 10), C.joint, 0, 0, 0, R.wrist);
    R.flange = grp(R.wrist, 0, 0, 0.08); cyl(0.06, 0.05, C.accent, 0, 0, 0, R.flange).rotation.x = Math.PI / 2;
    const tool = (len, build) => { const t = grp(R.flange); build(t); t.userData.len = len; t.visible = false; return shadowed(t); };
    R.tools = {
      spray: tool(0.3, t => { rbox(0.08, 0.1, 0.18, C.accent, 0, 0, 0.1, t, 0.02); cyl(0.015, 0.12, C.steel, 0, 0, 0.24, t).rotation.x = Math.PI / 2; }),
      gripper: tool(0.17, t => { bx(0.05, 0.05, 0.12, C.joint, 0, 0, 0.06, t); bx(0.9, 0.04, 0.04, C.steel, 0, 0, 0.13, t); bx(0.04, 0.6, 0.04, C.steel, 0, 0, 0.13, t);
        for (const [x, y] of [[-0.4, 0.27], [0.4, 0.27], [-0.4, -0.27], [0.4, -0.27]]) cyl(0.05, 0.03, C.rubber, x, y, 0.16, t).rotation.x = Math.PI / 2; }),
      screw: tool(0.26, t => { rbox(0.07, 0.07, 0.2, C.joint, 0, 0, 0.1, t, 0.02); cyl(0.006, 0.06, C.steel, 0, 0, 0.23, t).rotation.x = Math.PI / 2; }),
      router: tool(0.21, t => { cyl(0.045, 0.16, C.accent, 0, 0, 0.08, t).rotation.x = Math.PI / 2; cyl(0.008, 0.05, C.steel, 0, 0, 0.19, t).rotation.x = Math.PI / 2; }),
      sander: tool(0.16, t => { bx(0.06, 0.06, 0.12, C.joint, 0, 0, 0.06, t); cyl(0.13, 0.04, C.accent, 0, 0, 0.14, t).rotation.x = Math.PI / 2; }),
    };
    return R;
  }
  const r2 = robot2();
  function r2Tool(name) { for (const [k, t] of Object.entries(r2.tools)) t.visible = k === name; r2.toolName = name; }
  // Inverse kinematics: put the tool tip at `target` (world) pointing 'fwd', 'up' or 'down'.
  // The column rises so the shoulder stays a little below the wrist; a 2-link solve places the elbow.
  function r2Reach(target, dir = 'fwd') {
    root.updateMatrixWorld(true);
    const len = (r2.tools[r2.toolName]?.userData.len ?? 0.2) + 0.08;
    const wAbs = dir === 'up' ? Math.PI / 2 : dir === 'down' ? -Math.PI / 2 : 0;
    const local = r2.g.worldToLocal(target.clone());
    const fwd = Math.hypot(local.x, local.z);
    const wy = local.y - Math.sin(wAbs) * len, wz = fwd - Math.cos(wAbs) * len;
    r2.lift.position.y = clamp(wy - 0.53, 0.75, 1.75);
    const dy = wy - (r2.lift.position.y + 0.18), D = clamp(Math.hypot(wz, dy), 0.1, r2.L1 + r2.L2 - 0.02);
    const th1 = Math.atan2(dy, wz) + Math.acos(clamp((r2.L1 ** 2 + D ** 2 - r2.L2 ** 2) / (2 * r2.L1 * D), -1, 1));
    const th2 = th1 - (Math.PI - Math.acos(clamp((r2.L1 ** 2 + r2.L2 ** 2 - D ** 2) / (2 * r2.L1 * r2.L2), -1, 1)));
    r2.yaw.rotation.y = Math.atan2(local.x, local.z); r2.upper.rotation.x = -th1; r2.fore.rotation.x = th1 - th2; r2.wrist.rotation.x = th2 - wAbs;
  }
  function r2Legs(k) { r2.legs.forEach(l => { const u = l.userData; l.rotation.y = u.stow + u.swing * k; u.foot.position.y = -0.12 - 0.05 * k; }); }

  // ---------------------------------------------------------------- machines run by people + the laser level
  function concreteTruck() {
    const g = grp(); rbox(2.4, 1.0, 8, C.truck, 0, 1.0, 0, g, 0.1); rbox(2.4, 1.6, 2.1, C.truck, 0, 1.6, 3.2, g, 0.15); rbox(2.2, 0.8, 1.9, C.glass, 0, 2.0, 3.3, g, 0.1);
    for (const [x, z] of [[-1.1, 2.7], [1.1, 2.7], [-1.1, -2.4], [1.1, -2.4], [-1.1, -1.2], [1.1, -1.2]]) cyl(0.5, 0.4, C.rubber, x, 0.5, z, g).rotation.z = Math.PI / 2;
    const drum = grp(g, 0, 2.4, -0.8); drum.rotation.x = -0.22;
    mesh(new THREE.CylinderGeometry(0.9, 1.25, 4.4, 24), C.drum, 0, 0, 0, drum).rotation.x = Math.PI / 2;
    rbox(0.4, 0.12, 2.2, C.steel, 0, 1.6, -4.6, g, 0.03).rotation.x = 0.35;
    return { g, drum };
  }
  const truck = concreteTruck();
  const laser = grp(root, -11.5, 0, -2.5);
  for (let i = 0; i < 3; i++) bx(0.03, 1.5, 0.03, C.joint, Math.cos(i * 2.1) * 0.25, 0.7, Math.sin(i * 2.1) * 0.25, laser).rotation.set(Math.sin(i * 2.1) * 0.18, 0, -Math.cos(i * 2.1) * 0.18);
  rbox(0.2, 0.2, 0.2, C.accent, 0, 1.5, 0, laser, 0.04);
  const beamSpin = grp(laser);
  const beam = mesh(new THREE.BoxGeometry(30, 0.008, 0.008), C.laser, 15, 1.5, 0, beamSpin); beam.castShadow = false;

  // ---------------------------------------------------------------- the ground: lot, trenches, gravel, slab
  const PAD = { x0: -11, x1: 15, z0: -1.8, z1: 12 };
  const terr = (() => {
    const geo = new THREE.PlaneGeometry(40, 32, 160, 128); geo.rotateX(-Math.PI / 2); geo.translate(2, 0, 8);
    const pos = geo.attributes.position, n = pos.count, base = new Float32Array(n), done = new Float32Array(n), cols = new Float32Array(n * 3).fill(1);
    for (let i = 0; i < n; i++) {        // bumps sit above the dirt pad everywhere, and fade out toward the sidewalk and fence
      const x = pos.getX(i), z = pos.getZ(i), edge = clamp(Math.min(x + 18, 22 - x, z + 8, 24 - z) / 2.5);
      base[i] = edge * (0.2 + 0.5 * (0.16 * Math.sin(0.7 * x + 1) * Math.cos(0.5 * z) + 0.1 * Math.sin(1.3 * z + 0.4 * x) + 0.05 * Math.sin(3.1 * x - 2.3 * z))) - 0.06 * (1 - edge);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: TEX.tile('grass', 16, 13), vertexColors: true, roughness: 1 }));
    m.receiveShadow = true; root.add(m);
    const inPad = (x, z) => clamp(Math.min(x - PAD.x0, PAD.x1 - x, z - PAD.z0, PAD.z1 - z) / 1.5 + 1);
    return {
      m, reset() { done.fill(0); this.apply(); },
      grade(x, z, w) { for (let i = 0; i < n; i++) { const px = pos.getX(i), pz = pos.getZ(i); if (Math.abs(pz - z) < w / 2 && Math.abs(px - x) < 0.6) done[i] = Math.max(done[i], inPad(px, pz)); } },
      finish() { for (let i = 0; i < n; i++) done[i] = Math.max(done[i], inPad(pos.getX(i), pos.getZ(i))); this.apply(); },
      apply() {
        for (let i = 0; i < n; i++) { const d = done[i]; pos.setY(i, lerp(base[i], -0.095, d)); cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = lerp(1, 0.85, d); }
        pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
      },
    };
  })();
  // bare graded soil just under the lawn: it shows wherever the blade has cut the grass down below it
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(PAD.x1 - PAD.x0, PAD.z1 - PAD.z0), tex('dirt', (PAD.x1 - PAD.x0) / 3, (PAD.z1 - PAD.z0) / 3, { roughness: 1 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set((PAD.x0 + PAD.x1) / 2, -0.078, (PAD.z0 + PAD.z1) / 2); pad.receiveShadow = true; root.add(pad);
  const trench = grp();
  const trenchList = ext.map(s => ({ s, m: along(s.axis, s.c, s.a - 0.25, s.b + 0.25, -0.5, -0.06, 0.5, C.dirt, trench), ang: angleOf(...midOf(s)) }));
  const piles = [[-13.5, -3], [-13.5, 13], [15.5, 13]].map(([x, z]) => { const p = mesh(new THREE.ConeGeometry(1.7, 1.2, 18), C.dirt, x, 0.5, z); p.scale.setScalar(0.01); return p; });
  const gravel = rects.map(r => { const g = bx(r.size[0], 0.12, r.size[1], C.gravel, r.origin[0] + r.size[0] / 2, -0.128, r.origin[1] + r.size[1] / 2); g.scale.y = 0.01; return g; });
  const holes = [-12, -6, 0, 6, 12].map(x => { const h = cyl(0.17, 0.05, std({ color: '#2a2018', roughness: 1 }), x, -0.04, 23.5); h.scale.setScalar(0.01); return h; });
  const slabs = rects.map(r => {        // one mesh per room rectangle; wet bumps until the screed passes
    const geo = new THREE.PlaneGeometry(r.size[0], r.size[1], Math.ceil(r.size[0] / 0.25), Math.ceil(r.size[1] / 0.25));
    geo.rotateX(-Math.PI / 2); geo.translate(r.origin[0] + r.size[0] / 2, 0, r.origin[1] + r.size[1] / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(0.75), 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: TEX.tile('concrete', r.size[0] / 2, r.size[1] / 2), vertexColors: true, roughness: 0.6 }));
    m.receiveShadow = true; root.add(m); return m;
  });
  function pourScreed(pz, sz) {         // poured up to z = pz, screeded flat up to z = sz
    for (const m of slabs) {
      const pos = m.geometry.attributes.position, col = m.geometry.attributes.color;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), rough = 0.05 * Math.sin(x * 5.1 + z * 3.3) * Math.cos(z * 4.7 - x * 1.9) + 0.025;
        pos.setY(i, z > pz ? -0.5 : z > sz ? -0.045 + rough : -0.04);
        const c = z > sz ? 0.55 : 0.85; col.setXYZ(i, c, c, c);
      }
      pos.needsUpdate = col.needsUpdate = true; m.geometry.computeVertexNormals();
    }
  }

  // ---------------------------------------------------------------- framing: stud walls (one instanced mesh each)
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  function framePanel(s) {
    const g = new THREE.Group(), D = 0.089, boxes = [], cuts = s.cuts;
    const add = (a, b, y0, y1) => { if (b - a > 1e-3 && y1 - y0 > 1e-3) boxes.push([a, b, y0, y1]); };
    const doorish = k => k.d.sill == null && k.d.type !== 'opening', open = k => k.d.type === 'opening', win = k => k.d.sill != null;
    const solid = (lo, hi, test) => { const out = []; let cur = lo; for (const k of cuts.filter(test)) { if (k.lo > cur) out.push([cur, Math.min(k.lo, hi)]); cur = Math.max(cur, k.hi); } if (cur < hi) out.push([cur, hi]); return out; };
    for (const [a, b] of solid(s.a, s.b, k => doorish(k) || open(k))) add(a, b, 0, 0.038);
    for (const [a, b] of solid(s.a, s.b, open)) { add(a, b, H2 - 0.076, H2 - 0.038); add(a, b, H2 - 0.038, H2); }
    const studs = new Set([s.a + 0.02, s.b - 0.02]);
    for (let p = s.a + 0.406; p < s.b - 0.05; p += 0.406) studs.add(+p.toFixed(3));
    for (const k of cuts) { studs.add(+(k.lo - 0.02).toFixed(3)); studs.add(+(k.hi + 0.02).toFixed(3)); }
    for (const p of studs) {
      if (p < s.a || p > s.b) continue;
      const k = cuts.find(q => p > q.lo + 1e-3 && p < q.hi - 1e-3);
      if (k && open(k)) continue;
      if (k && doorish(k)) { add(p - 0.019, p + 0.019, (k.d.height || meta.door_height) + 0.24, H2 - 0.076); continue; }
      if (k && win(k)) { add(p - 0.019, p + 0.019, 0.038, k.d.sill - 0.04); add(p - 0.019, p + 0.019, k.d.sill + k.d.height + 0.24, H2 - 0.076); continue; }
      add(p - 0.019, p + 0.019, 0.038, H2 - 0.076);
    }
    for (const k of cuts) {
      const lo = Math.max(k.lo, s.a), hi = Math.min(k.hi, s.b), dh = k.d.height || meta.door_height;
      if (doorish(k)) add(lo - 0.04, hi + 0.04, dh, dh + 0.24);
      if (win(k)) { add(lo - 0.04, hi + 0.04, k.d.sill + k.d.height, k.d.sill + k.d.height + 0.24); add(lo, hi, k.d.sill - 0.04, k.d.sill); }
    }
    const [mx, mz] = midOf(s), im = new THREE.InstancedMesh(unitBox, C.wood, boxes.length), M4 = new THREE.Matrix4(), q0 = new THREE.Quaternion();
    boxes.forEach(([a, b, y0, y1], i) => {
      const c = (a + b) / 2, len = b - a;
      M4.compose(s.axis === 'x' ? V(c - mx, (y0 + y1) / 2, 0) : V(0, (y0 + y1) / 2, c - mz), q0, s.axis === 'x' ? V(len, y1 - y0, D) : V(D, y1 - y0, len));
      im.setMatrixAt(i, M4);
    });
    im.castShadow = im.receiveShadow = true; g.add(im);
    g.position.set(mx, -0.05, mz); g.userData = { axis: s.axis }; g.visible = false; root.add(g);
    return g;
  }
  const panels = [...ext.map(framePanel), ...inner.map(framePanel)];
  const tilt = (p, e) => { p.visible = e > 0; const a = (1 - e) * Math.PI / 2; if (p.userData.axis === 'x') p.rotation.set(a, 0, 0); else p.rotation.set(0, 0, -a); };
  const stackRooms = ['living', 'primary', 'bed2', 'bed3', 'kitchen', 'dining'].map(id => H.rooms.find(r => r.id === id)).filter(Boolean);
  const stacks = stackRooms.map(r => {
    const st = rbox(1.22, 0.24, 2.44, C.drywall, 0, 0, 0, root, 0.01), lr = r.id === 'living';
    st.userData.final = V(r.origin[0] + r.size[0] / 2 + (lr ? 0.6 : 0), 0.07, r.origin[1] + r.size[1] / 2 - (lr ? 0.4 : 0)); st.visible = false; return st;
  });
  const truckBed = V(10, 1.6, -6);

  // ---------------------------------------------------------------- roof
  const main = { x0: -9.0, x1: 6.8 }, gar = { z0: 0.5, z1: 6.6 };
  const OH = 0.45, RISE = 1.67, GRISE = 1.0;
  function truss(span, rise) {
    const g = new THREE.Group(), ang = Math.atan2(rise, span / 2), run = span / 2 + OH, L = run / Math.cos(ang);
    bx(0.045, 0.09, span, C.wood, 0, 0.045, 0, g);
    for (const sgn of [-1, 1]) bx(0.045, 0.09, L, C.wood, 0, (rise - OH * Math.tan(ang)) / 2 + 0.05, sgn * run / 2, g).rotation.x = sgn * ang;
    bx(0.045, rise, 0.09, C.wood, 0, rise / 2 + 0.05, 0, g);
    for (const sgn of [-1, 1]) bx(0.04, 0.08, Math.hypot(span / 4, rise / 2), C.wood, 0, rise / 4 + 0.05, sgn * span / 8, g).rotation.x = -sgn * Math.atan2(rise / 2, span / 4);
    return g;
  }
  const trusses = [];
  for (let x = main.x0 + 0.1; x <= main.x1 - 0.05; x += 0.6) { const t = truss(10, RISE); t.position.set(x, H2 - 0.05, 5); root.add(t); t.userData.final = t.position.clone(); trusses.push(t); }
  for (let z = gar.z0 + 0.1; z <= gar.z1 - 0.05; z += 0.6) { const t = truss(6.1, GRISE); t.rotation.y = Math.PI / 2; t.position.set(9.85, H2 - 0.05, z); root.add(t); t.userData.final = t.position.clone(); trusses.push(t); }
  function roofSlope(len, run, rise, alongX, cx, cz, sgn) {
    const ang = Math.atan2(rise, run), h = run + OH, slope = h / Math.cos(ang), g = grp();
    const w = alongX ? len + 2 * OH : slope, d = alongX ? slope : len + 2 * OH;
    bx(w, 0.03, d, tex('osb', w / 2.4, d / 1.2), 0, 0, 0, g);
    const shingles = bx(w + 0.02, 0.05, d + 0.02, tex('shingles', w / 1.2, d / 1.2, { roughness: 0.85 }), 0, 0.04, 0, g);
    const y = H2 + rise - Math.tan(ang) * h / 2 + 0.08;
    if (alongX) { g.position.set(cx, y, cz + sgn * h / 2); g.rotation.x = sgn * ang; } else { g.position.set(cx + sgn * h / 2, y, cz); g.rotation.z = -sgn * ang; }
    g.userData = { shingles, len: w }; return g;
  }
  const slopes = [roofSlope(15.8, 5, RISE, true, -1.1, 5, -1), roofSlope(15.8, 5, RISE, true, -1.1, 5, 1),
                  roofSlope(6.1, 3.05, GRISE, false, 9.85, 3.55, -1), roofSlope(6.1, 3.05, GRISE, false, 9.85, 3.55, 1)];
  const shingleProgress = (s, e) => { const sh = s.userData.shingles; sh.scale.x = Math.max(0.01, e); sh.position.x = -(1 - e) * s.userData.len / 2; };
  const triGeo = (w, h) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); };
  const gables = [mesh(triGeo(10, RISE), C.siding, main.x0 - 0.16, H2, 5), mesh(triGeo(10, RISE), C.siding, main.x1 + 0.06, H2, 5), mesh(triGeo(6.1, GRISE), C.siding, 9.85, H2, gar.z0 - 0.16)];
  gables[0].rotation.y = gables[1].rotation.y = Math.PI / 2;

  // ---------------------------------------------------------------- outside finish: siding, windows, trim, gutters, doors
  const siding = [];
  for (const s of ext) {
    const off = s.outside * (WT / 2 + 0.03), pieces = [];
    let cur = s.a - WT / 2 - 0.03;
    for (const k of s.cuts) {
      const lo = Math.max(k.lo, s.a), hi = Math.min(k.hi, s.b);
      pieces.push([cur, lo, 0, H2]);
      if (k.d.sill != null) pieces.push([lo, hi, 0, k.d.sill], [lo, hi, k.d.sill + k.d.height, H2]);
      else if (k.d.type !== 'opening') pieces.push([lo, hi, k.d.height || meta.door_height, H2]);
      cur = hi;
    }
    pieces.push([cur, s.b + WT / 2 + 0.03, 0, H2]);
    for (const [a, b, y0, y1] of pieces) {
      const m = along(s.axis, s.c, a, b, y0, y1, 0.035, tex('siding', (b - a) / 1.2, (y1 - y0) / 1.2), root, off);
      if (m) siding.push({ m, at: s.axis === 'x' ? V((a + b) / 2, 0, s.c) : V(s.c, 0, (a + b) / 2), y: (y0 + y1) / 2 });
    }
  }
  siding.sort((p, q) => angleOf(p.at.x, p.at.z) - angleOf(q.at.x, q.at.z));
  const panes = [], trims = [];
  for (const w of H.windows || []) {
    const s = segs.find(q => q.cuts.some(k => k.d === w)); if (!s) continue;
    const p = s.axis === 'x' ? w.position[0] : w.position[1], off = s.outside * (WT / 2 + 0.06), hw = w.width / 2;
    panes.push(along(s.axis, s.c, p - hw, p + hw, w.sill, w.sill + w.height, 0.02, C.pane, root));
    for (const [a, b, y0, y1] of [[p - hw - 0.08, p + hw + 0.08, w.sill - 0.08, w.sill], [p - hw - 0.08, p + hw + 0.08, w.sill + w.height, w.sill + w.height + 0.08],
                                   [p - hw - 0.08, p - hw, w.sill, w.sill + w.height], [p + hw, p + hw + 0.08, w.sill, w.sill + w.height]])
      trims.push({ t: along(s.axis, s.c, a, b, y0, y1, 0.05, C.trim, root, off), at: V(s.axis === 'x' ? p : s.c + off, (y0 + y1) / 2, s.axis === 'x' ? s.c + off : p) });
  }
  const gutters = [[main.x0 - OH, main.x1 + OH, -OH - 0.05], [main.x0 - OH, main.x1 + OH, 10 + OH + 0.05]].map(([a, b, z]) => {
    const g = bx(b - a, 0.12, 0.13, C.gutter, (a + b) / 2, H2 + 0.02, z); g.userData = { a, len: b - a }; return g;
  });
  const gutterProgress = (g, e) => { g.visible = e > 0; g.scale.x = Math.max(0.01, e); g.position.x = g.userData.a + g.userData.len * e / 2; };
  const frontDoor = bx(0.915, 2.04, 0.05, C.navy, 0, 1.02, -0.03);
  const garageDoor = grp(root, 9.85, 0, 0.45); bx(4.88, 2.13, 0.05, C.trim, 0, 1.065, 0, garageDoor); for (let i = 1; i < 4; i++) bx(4.88, 0.02, 0.06, C.steel, 0, i * 0.53, 0, garageDoor);

  // ---------------------------------------------------------------- inside: the living-room demo
  const LR = H.rooms.find(r => r.id === 'living');
  const eastX = LR.origin[0] + LR.size[0] - WT / 2 - 0.007;
  const sheetsZ = [0.66, 1.88, 3.1, 4.32];
  const sheets = sheetsZ.map(z => bx(0.0127, 2.44, 1.22, C.drywall.clone(), eastX, 1.22, z));
  const ceilSheet = bx(2.44, 0.0127, 1.22, C.drywall, 4.6, H2 - 0.04, 2.6);
  const cav = [];      // insulation in the stud bays of the living room's front (outside) wall
  { const s = ext.find(q => q.axis === 'x' && Math.abs(q.c) < 1e-3 && q.a <= LR.origin[0] + 0.1 && q.b >= LR.origin[0] + 1);
    if (s) for (let x = LR.origin[0] + 0.25; x < LR.origin[0] + LR.size[0] - 0.2; x += 0.406) {
      const k = s.cuts.find(q => x + 0.2 > q.lo && x + 0.2 < q.hi);
      const spans = k ? [[0.04, k.d.sill - 0.04], [k.d.sill + k.d.height + 0.24, H2 - 0.08]] : [[0.04, H2 - 0.08]];
      for (const [y0, y1] of spans) { const m = bx(0.36, y1 - y0, 0.085, C.insulation, x + 0.2, (y0 + y1) / 2, 0); m.userData.h = y1 - y0; cav.push(m); }
    } }
  const seams = [1.27, 2.49, 3.71].map(z => bx(0.004, 2.4, 0.16, C.mud, eastX - 0.013, 1.22, z));
  const outlets = [1.3, 3.5].map(z => bx(0.005, 0.11, 0.07, C.joint, eastX - 0.013, 0.35, z));
  const lrStack = stacks[0], paintColor = new THREE.Color('#efe7d4');

  // ---------------------------------------------------------------- moving machines smoothly
  function drive(obj, pts, k, dt, turn = 6) {        // along a polyline, eased at both ends; heading follows the path
    const L = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); L.push(d); tot += d; }
    let d = ease(clamp(k)) * tot, i = 0; while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
    const a = pts[i], b = pts[i + 1] ?? pts[i], f = L[i] ? d / L[i] : 1;
    obj.position.lerpVectors(a, b, f);
    if (b.distanceTo(a) > 1e-3 && k < 1) turnTo(obj, Math.atan2(b.x - a.x, b.z - a.z), dt, turn);
  }
  function turnTo(obj, yaw, dt, rate = 6) { const d = Math.atan2(Math.sin(yaw - obj.rotation.y), Math.cos(yaw - obj.rotation.y)); obj.rotation.y += d * Math.min(1, dt * rate); }
  const faceTo = (obj, p, dt) => turnTo(obj, Math.atan2(p.x - obj.position.x, p.z - obj.position.z), dt);
  const follow = (obj, p, dt, rate = 3) => obj.position.lerp(p, Math.min(1, dt * rate));
  let workClock = 0;
  function safeStep(dt) {            // robot 1 pauses while anyone is inside its 3.5 m safety field
    const near = crew.some(w => w.g.visible && w.g.position.distanceTo(r1.g.position) < 3.5);
    C.ring.color.set(near ? '#ff3b30' : '#3a7bd5'); C.ring.opacity = near ? 0.45 : 0.22;
    return near ? 0 : dt;
  }
  // Each Robot 1 step opens with a visit to the tool rack: set the old tool down, pick up the new one, drive to work.
  function chapterDrive(tool, k, dt, workStart, swapEnd = 0.22) {
    if (k < swapEnd) {
      if (r1._tool !== tool) {
        const slot = rackPos[tool];
        r1._path = [r1.g.position.clone(), V(slot.x - 3.2, 0, slot.z), V(slot.x - 1.9, 0, slot.z), V(slot.x - 3.6, 0, slot.z + (slot.z > 4 ? -1.5 : 1.5)), workStart];
        r1._tool = tool;
      }
      const sub = k / swapEnd;
      drive(r1.g, r1._path, sub, dt);
      if (sub > 0.42 && r1.tool !== tools[tool]) equip(tool);
      r1.arms.rotation.x = -0.1 + Math.sin(Math.PI * clamp((sub - 0.3) / 0.25)) * 0.2;
      return false;
    }
    if (r1.tool !== tools[tool]) equip(tool);
    return true;
  }
  const dust = (obj, off) => fx('dust', obj.localToWorld(off).toArray(), 0.2);

  // ---------------------------------------------------------------- chapters
  const CH = [
    { title: 'Meet the two robots', dur: 9,
      body: 'Robot 1 works outside: a compact track loader with an autonomy kit (GPS, lidar, cameras) and swappable tools on the rack behind it. Robot 2 works inside: a 0.65 m wide base, a lift column and a 6-axis arm with a tool changer.',
      real: 'Both build on things sold today: autonomous excavation kits, laser screeds and drywall-finishing robots.',
      enter() { parkTools(); r1.g.position.set(13, 0, -4.5); r1.g.rotation.y = -Math.PI / 2; r1.arms.rotation.x = 0; r2.g.visible = true; r2.g.position.set(10.3, 0, -5.8); r2.g.rotation.y = -Math.PI / 2.4; r2Tool('spray'); r2Legs(0); },
      update(k) { r2Reach(r2.g.localToWorld(V(0.2, 1.5 + 0.3 * Math.sin(S.anim), 0.7))); r1.arms.rotation.x = 0.15 * Math.sin(S.anim * 0.8); },
      cam: k => [V(lerp(4, 7.5, k), 2.6, lerp(-10.5, -11.5, k)), V(12, 1, -4.6)] },
    { title: 'Robot 1 · grading blade: level the ground', dur: 16,
      body: 'With a laser-guided grading blade it levels the building pad to the plans. When a person walks into its safety field (the blue ring turns red) it stops until they leave.',
      real: 'Laser and GPS grade control is standard on earthmoving equipment today.',
      enter() { r2.g.visible = false; crew[0].g.visible = true; crew[0].g.position.set(-15, 0, 4); },
      update(k, dt) {
        beamSpin.rotation.y += dt * 6;
        if (!chapterDrive('blade', k, dt, V(PAD.x0, 0, PAD.z0 + 1))) return;
        workClock += safeStep(dt) / (this.dur * 0.72);
        const passes = 7, w = (PAD.z1 - PAD.z0) / passes, p = clamp(workClock) * passes, i = Math.min(passes - 1, Math.floor(p)), f = p - i;
        follow(r1.g, V(i % 2 ? lerp(PAD.x1, PAD.x0, f) : lerp(PAD.x0, PAD.x1, f), 0, PAD.z0 + w * (i + 0.5)), dt, 5);
        turnTo(r1.g, i % 2 ? -Math.PI / 2 : Math.PI / 2, dt, 4);
        r1.arms.rotation.x = 0.18;
        terr.grade(r1.g.position.x + Math.sin(r1.g.rotation.y) * 2.3, r1.g.position.z, w + 0.4); terr.apply();
        if (Math.abs(Math.sin(S.anim * 3)) > 0.7) dust(r1.g, V(0, 0.2, 2.4));
        if (k > 0.42) walkTo(crew[0], k < 0.66 ? V(r1.g.position.x + Math.sin(r1.g.rotation.y) * 3.2, 0, r1.g.position.z + 2.2) : V(-16, 0, 16), dt, 1.4);
      },
      cam: k => [V(lerp(-16, 4, k), 10, -15), V(1, 0, 5)] },
    { title: 'Robot 1 · bucket: dig the footing trenches', dur: 14,
      body: 'It swaps to a bucket and digs the foundation trenches along every outside wall straight from the digital plans, piling the soil for later.',
      real: 'Autonomous excavation kits (e.g. Built Robotics) already dig trenches on real jobs.',
      enter() { terr.finish(); trench.visible = true; crew[0].g.visible = false; },
      update(k, dt) {
        const loop = [V(-10.6, 0, -1.6), V(14.5, 0, -1.6), V(14.5, 0, 11.6), V(-10.6, 0, 11.6), V(-10.6, 0, -1.4)];
        if (!chapterDrive('bucket', k, dt, loop[0])) return;
        const w = seg01(k, 0.22, 1); drive(r1.g, loop, w, dt, 3);
        const a0 = angleOf(loop[0].x, loop[0].z), rel = x => (x - a0 + Math.PI * 4) % (Math.PI * 2), ra = rel(angleOf(r1.g.position.x, r1.g.position.z));
        trenchList.forEach(t => { const e = w > 0.98 ? 1 : clamp((ra - rel(t.ang)) * 3); t.m.scale.y = Math.max(0.01, e); t.m.position.y = -0.06 - 0.22 * t.m.scale.y; });
        piles.forEach((p, i) => p.scale.setScalar(Math.max(0.01, ease(clamp(w * 3 - i)))));
        r1.arms.rotation.x = 0.05 + 0.18 * Math.sin(S.anim * 2.4); r1.tool.rotation.x = 0.4 * Math.sin(S.anim * 2.4 + 1);
        if (Math.sin(S.anim * 2.4) > 0.6) dust(r1.coupler, V(0, -0.3, 0.5));
      },
      cam: k => [V(lerp(-17, 2, k), 11, lerp(-12, -15, k)), V(1, 0, 4)] },
    { title: 'Robot 1 · compactor + auger: firm base, post holes', dur: 13,
      body: 'A plate compactor packs the soil and gravel base, then an auger drills the holes for the back fence posts.',
      real: 'Plate compactors and augers are ordinary loader attachments; driving them autonomously is what is new.',
      enter() { trenchList.forEach(t => { t.m.scale.y = 1; t.m.position.y = -0.28; }); piles.forEach(p => p.scale.setScalar(1)); gravel.forEach(g => { g.visible = true; }); },
      update(k, dt) {
        if (k < 0.62) {
          if (!chapterDrive('compactor', k / 0.62, dt, V(PAD.x0 + 1, 0, 0.5))) return;
          const w = seg01(k, 0.14, 0.6), rows = 5, p = w * rows, i = Math.min(rows - 1, Math.floor(p)), f = p - i;
          follow(r1.g, V(i % 2 ? lerp(13, -9.5, f) : lerp(-9.5, 13, f), 0, 0.8 + i * 2.1), dt, 4); turnTo(r1.g, i % 2 ? -Math.PI / 2 : Math.PI / 2, dt, 4);
          gravel.forEach(g => { g.scale.y = Math.max(0.01, clamp((r1.g.position.z + 1.5 - (g.position.z - 2)) / 3)); });
          r1.tool.position.y = 0.02 * Math.sin(S.anim * 40); dust(r1.coupler, V(0, -0.35, 0.5));
        } else {
          if (!chapterDrive('auger', (k - 0.62) / 0.38, dt, V(-12, 0, 21.5), 0.4)) return;
          const w = seg01(k, 0.78, 1), i = Math.min(holes.length - 1, Math.floor(w * holes.length)), f = w * holes.length - i;
          follow(r1.g, V(holes[i].position.x, 0, 21.5), dt); turnTo(r1.g, 0, dt, 4);
          const bit = r1.tool.userData.bit; bit.rotation.y += dt * 12; bit.position.y = -0.15 - 0.5 * Math.sin(Math.PI * f);
          holes.forEach((h, j) => h.scale.setScalar(j < i || (j === i && f > 0.5) ? 1 : 0.01));
          if (Math.sin(Math.PI * f) > 0.5) fx('dust', [holes[i].position.x, 0.1, 23.4], 0.2);
        }
      },
      cam: k => [V(-18, 11, lerp(-2, 10, k)), V(1, 0, lerp(5, 12, k))] },
    { title: 'People pour, Robot 1 screeds the slab', dur: 15,
      body: 'A crew pours concrete from the truck; Robot 1 follows with a laser screed head that strikes the wet concrete off flat to a few millimetres.',
      real: 'Laser screeds are a proven technology on commercial slabs.',
      enter() { gravel.forEach(g => { g.scale.y = 1; }); holes.forEach(h => h.scale.setScalar(1)); truck.g.visible = true; truck.g.position.set(-4, 0, -6.5);
               crew[0].g.position.set(-2, 0, -1); crew[1].g.position.set(-1, 0, -1.5); crew[0].g.visible = crew[1].g.visible = true; pourScreed(-1, -1); slabs.forEach(m => { m.visible = true; }); },
      update(k, dt) {
        truck.drum.rotation.z += dt * 2; beamSpin.rotation.y += dt * 6;
        const pz = lerp(-0.5, 10.5, seg01(k, 0.05, 0.7)), sz = lerp(-0.5, 10.5, seg01(k, 0.3, 0.98)), hoseX = lerp(-8, 12, (Math.sin(S.anim * 0.9) + 1) / 2);
        pourScreed(pz, sz);
        if (pz > 0 && pz < 10.4) fx('concrete', [hoseX, 0.6, pz], 0.2);
        walkTo(crew[0], V(hoseX - 1.2, 0, pz - 0.8), dt, 2); walkTo(crew[1], V(-10.6, 0, pz), dt, 2);
        if (!chapterDrive('screed', k, dt, V(1.9, 0, -2.4), 0.25)) return;
        follow(r1.g, V(1.9, 0, sz - 1.9), dt, 4); turnTo(r1.g, 0, dt, 4);
        r1.arms.rotation.x = 0.33; r1.tool.position.y = 0.01 * Math.sin(S.anim * 30);
      },
      cam: k => [V(-15, 7, lerp(-8, 4, k)), V(2, 0, lerp(2, 7, k))] },
    { title: 'People frame the walls; Robot 1 drops the drywall in', dur: 15,
      body: 'Framing stays with people in our design: the crew tilts up the stud walls. Before the roof closes the rooms in, Robot 1’s boom sets a stack of drywall in each one, so Robot 2 never carries sheets through doorways.',
      real: 'Telehandler booms lift pallets like this every day; here it is driven autonomously.',
      enter() { pourScreed(11, 11); slabs.forEach(m => { m.geometry.attributes.color.array.fill(1); m.geometry.attributes.color.needsUpdate = true; });
               truck.g.visible = false; crew.forEach(w => { w.g.visible = true; }); },
      update(k, dt) {
        const n = panels.length;
        panels.forEach((p, i) => tilt(p, ease(clamp((k / 0.62 - i / n) * n / 3))));
        const active = panels[Math.min(n - 1, Math.floor(clamp(k / 0.62) * n))];
        crew.forEach((w, i) => walkTo(w, active.position.clone().add(V((i - 1) * 1.1, 0, (active.userData.axis === 'x' ? 1 : 0) * 1.2 + 0.4)), dt, 2.2));
        if (k < 0.5) { r1.g.position.set(15.5, 0, -2); r1.g.rotation.y = -Math.PI / 2; return; }
        if (!chapterDrive('boom', (k - 0.5) / 0.5, dt, V(4, 0, -2.6), 0.3)) return;
        const w = seg01(k, 0.68, 1), i = Math.min(stacks.length - 1, Math.floor(w * stacks.length)), f = w * stacks.length - i;
        const st = stacks[i], fin = st.userData.final;
        const pos = V(lerp(truckBed.x, fin.x, ease(f)), lerp(truckBed.y, fin.y, ease(f)) + Math.sin(Math.PI * f) * 3.8, lerp(truckBed.z, fin.z, ease(f)));
        stacks.forEach((s2, j) => { s2.visible = j <= i; if (j < i) s2.position.copy(s2.userData.final); }); st.position.copy(pos);
        follow(r1.g, V(clamp(fin.x, -8, 12), 0, -2.6), dt, 2); faceTo(r1.g, pos, dt); r1.arms.rotation.x = -0.35; aimBoom(pos);
      },
      cam: k => [V(lerp(-14, 8, k), 10, -15), V(2, 0.8, 4)] },
    { title: 'Robot 1 · boom + arm: trusses, sheathing, shingles', dur: 17,
      body: 'Its 6 m boom reaches every part of the roof from the ground, so it never climbs up. It sets each truss, then lays sheathing and shingles, working the front slope and then the back.',
      real: 'A 4.5–5.5 m roof peak is within reach of a 6 m boom from the ground.',
      enter() { panels.forEach(p => tilt(p, 1)); stacks.forEach(s => { s.visible = true; s.position.copy(s.userData.final); }); crew.forEach(w => { w.g.visible = false; }); },
      update(k, dt) {
        if (!chapterDrive('boom', k, dt, V(-8, 0, -2.6), 0.08)) return;
        const n = trusses.length, a = seg01(k, 0.08, 0.6), i = Math.min(n - 1, Math.floor(a * n)), f = a * n - i;
        let target;
        if (a < 1) {
          trusses.forEach((t, j) => { t.visible = j <= i; if (j < i) t.position.copy(t.userData.final); });
          const t = trusses[i], fin = t.userData.final;
          target = V(fin.x, lerp(4.3, fin.y, ease(f)), lerp(-1, fin.z, ease(f))); t.position.copy(target);
          follow(r1.g, V(clamp(fin.x, -9, 13), 0, -3.1), dt);
        } else {
          trusses.forEach(t => { t.visible = true; t.position.copy(t.userData.final); });
          const b = seg01(k, 0.6, 1), front = b < 0.5, e = front ? b * 2 : b * 2 - 1, x = lerp(-9, 7, e);
          slopes.forEach((s, j) => { s.visible = j !== 1 || !front; });
          shingleProgress(slopes[front ? 0 : 1], e); if (!front) shingleProgress(slopes[0], 1);
          shingleProgress(slopes[2], clamp(b * 3)); shingleProgress(slopes[3], clamp(b * 3 - 1));
          target = V(x, 3.6, front ? 2.4 : 7.6);
          follow(r1.g, V(x, 0, front ? -3.2 : 13.2), dt, 2.5);
        }
        faceTo(r1.g, target, dt); r1.arms.rotation.x = -0.35; aimBoom(target);
      },
      cam: k => [V(lerp(-15, 15, k), 11, lerp(-13, -10, k)), V(2, 2, 5)] },
    { title: 'Robot 1 · siding, gutters, trim paint', dur: 15,
      body: 'The crew sets the windows. Robot 1’s arm installs siding panel by panel around the house, hangs the gutters along the eaves, then spray-paints the window trim.',
      real: 'Same boom and arm with different end tools: a vacuum lifter, a gutter clamp and a paint sprayer.',
      enter() { trusses.forEach(t => { t.visible = true; t.position.copy(t.userData.final); }); slopes.forEach(s => { s.visible = true; shingleProgress(s, 1); });
               panes.forEach(p => { p.visible = true; }); gables.forEach(g => { g.visible = true; }); },
      update(k, dt) {
        if (!chapterDrive('boom', k, dt, V(-12, 0, -1), 0.06)) return;
        const a = seg01(k, 0.06, 0.62), n = siding.length, i = Math.min(n - 1, Math.floor(a * n));
        siding.forEach((p, j) => { p.m.visible = j <= i; });
        let target;
        if (a < 1) { const p = siding[i]; target = p.at.clone().setY(p.y); follow(r1.g, p.at.clone().add(p.at.clone().sub(center).setY(0).normalize().multiplyScalar(3.4)).setY(0), dt, 2.5); }
        else {
          const b = seg01(k, 0.62, 0.82), c = seg01(k, 0.82, 1);
          gutterProgress(gutters[0], clamp(b * 2)); gutterProgress(gutters[1], clamp(b * 2 - 1));
          frontDoor.visible = garageDoor.visible = b > 0.3;
          if (b < 1) { const front = b < 0.5, e = front ? b * 2 : b * 2 - 1; target = V(lerp(-9.4, 7.2, e), H2 + 0.1, front ? -0.5 : 10.5); follow(r1.g, V(target.x, 0, front ? -3.4 : 13.4), dt); }
          else {
            const j = Math.min(trims.length - 1, Math.floor(c * trims.length)); trims.forEach((q, m) => { q.t.visible = m <= j; });
            target = trims[j].at.clone(); const out = V(target.x, 0, target.z).sub(center).normalize();
            follow(r1.g, V(target.x, 0, target.z).add(out.clone().multiplyScalar(3.2)), dt);
            fx('spray', target.toArray(), 0.2, out.clone().negate().toArray());
          }
        }
        faceTo(r1.g, target, dt); r1.arms.rotation.x = -0.35; aimBoom(target.clone().add(V(0, -0.6, 0)));
      },
      cam: k => [V(lerp(-16, 16, k), 6, lerp(-10, -12, k)), V(2, 1.6, 4)] },
    { title: 'Robot 2 rolls in: scan, then spray insulation', dur: 13,
      body: 'At 0.65 m wide it drives straight through the front door. Its lidar scans the room against the plans, then it sprays insulation into the outside-wall cavities.',
      real: 'Spray-foam and blown-in insulation rigs exist; the robot automates the aiming.',
      enter() { siding.forEach(p => { p.m.visible = true; }); gutters.forEach(g => gutterProgress(g, 1)); trims.forEach(q => { q.t.visible = true; });
               frontDoor.visible = false; garageDoor.visible = true; r2.g.visible = true; r2.g.position.set(0, -0.05, -3); r2.g.rotation.y = 0; r2Tool('spray'); r2Legs(0);
               r1.g.position.set(15.5, 0, -2); r1.g.rotation.y = -Math.PI / 2; },
      update(k, dt) {
        drive(r2.g, [V(0, -0.05, -3), V(0, -0.05, 2.0), V(3.0, -0.05, 2.0), V(3.8, -0.05, 1.3)], seg01(k, 0, 0.32), dt);
        r2.lidar.rotation.y += dt * 12;
        if (k < 0.3) r2Reach(r2.g.localToWorld(V(0, 1.1, 0.4)));
        else if (k < 0.45) { turnTo(r2.g, Math.PI, dt, 3); fx('sparkle', [lerp(1.2, 6.6, (Math.sin(S.anim * 3) + 1) / 2), 1.2 + Math.sin(S.anim * 5) * 0.8, 0.1], 0.2); r2Reach(r2.g.localToWorld(V(0, 1.6, 0.5))); }
        else {
          turnTo(r2.g, Math.PI, dt, 3);
          const n = cav.length, w = seg01(k, 0.45, 0.98), i = Math.min(n - 1, Math.floor(w * n)), f = w * n - i, c = cav[i];
          cav.forEach((m, j) => { m.visible = j <= i; const e = j < i ? 1 : Math.max(0.01, f); m.scale.z = e; m.position.z = -0.0425 * (1 - e); });
          follow(r2.g, V(c.position.x, -0.05, 1.3), dt, 2);
          const tip = V(c.position.x, c.position.y + (f - 0.5) * c.userData.h * 0.8, 0.3); r2Reach(tip); fx('spray', tip.toArray(), 0.2, [0, 0, -1]);
        }
      },
      cam: k => [V(5.8, 1.9, 4.6), V(3.4, 1.0, 0.8)] },
    { title: 'Robot 2 · drywall: walls, then the ceiling', dur: 18,
      body: 'The suction gripper lifts a 25 kg sheet off the stack and sets it on the studs; the screw gun fastens it. Ceilings are the hardest part: it puts its outrigger legs down and holds the sheet flat overhead while it screws.',
      real: 'Prototypes can hang ceiling drywall today, but slowly. A 40 kg payload covers 5/8" fire-rated sheets too.',
      enter() { cav.forEach(m => { m.visible = true; m.scale.z = 1; m.position.z = 0; }); r2.g.position.set(5.6, -0.05, 2.6); r2.g.rotation.y = Math.PI / 2; },
      update(k, dt) {
        const per = 0.68 / sheets.length, idx = Math.min(sheets.length - 1, Math.floor(k / per)), f = clamp((k - idx * per) / per);
        sheets.forEach((s, j) => { s.visible = j < idx || k >= 0.68; s.position.set(eastX, 1.22, sheetsZ[j]); s.rotation.set(0, 0, 0); });
        if (k < 0.68) {
          const s = sheets[idx], z = sheetsZ[idx];
          follow(r2.g, V(5.55, -0.05, z), dt); turnTo(r2.g, Math.PI / 2, dt, 4); r2Legs(0);
          if (f < 0.55) {          // lift from the stack, stand it up, carry it to the studs
            r2Tool('gripper'); const g = seg01(f, 0, 0.55);
            const from = V(lrStack.position.x, 0.25, lrStack.position.z), to = V(eastX - 0.02, 1.22, z);
            const p = V(lerp(from.x, to.x, ease(g)), lerp(from.y, to.y, ease(g)) + Math.sin(Math.PI * g) * 0.6, lerp(from.z, to.z, ease(g)));
            s.visible = g > 0.12; s.position.copy(p); s.rotation.set(0, 0, (1 - ease(clamp(g * 1.6))) * Math.PI / 2);
            r2Reach(p.clone().add(V(-0.03, 0, 0)), g < 0.3 ? 'down' : 'fwd');
            lrStack.scale.y = 1 - (idx + g) / sheets.length * 0.6;
          } else {                 // screws: 3 columns x 4 rows
            s.visible = true; r2Tool('screw'); const sf = seg01(f, 0.55, 1), j = Math.min(11, Math.floor(sf * 12));
            const tip = V(eastX - 0.01, 0.25 + (j % 4) * 0.62, z - 0.5 + Math.floor(j / 4) * 0.5); r2Reach(tip);
            if ((sf * 12) % 1 > 0.6) fx('sparkle', tip.toArray(), 0.1);
          }
        } else {
          const c = seg01(k, 0.68, 1);
          follow(r2.g, V(4.6, -0.05, 3.1), dt); turnTo(r2.g, 0, dt, 4); r2Legs(clamp(c * 4));
          ceilSheet.visible = c > 0.15;
          if (c < 0.5) { r2Tool('gripper'); ceilSheet.position.set(4.6, lerp(0.4, H2 - 0.04, ease(seg01(c, 0.15, 0.5))), 2.6); r2Reach(ceilSheet.position.clone().add(V(0, -0.03, 0)), 'up'); }
          else { r2Tool('screw'); ceilSheet.position.set(4.6, H2 - 0.04, 2.6); const sf = seg01(c, 0.5, 1), j = Math.floor(sf * 10);
                 const tip = V(3.6 + (j % 5) * 0.5, H2 - 0.05, 2.2 + Math.floor(j / 5) * 0.8); r2Reach(tip, 'up'); if ((sf * 10) % 1 > 0.6) fx('sparkle', tip.toArray(), 0.1); }
        }
      },
      cam: k => [V(2.3, 1.8, 0.7), V(5.6, 1.5, 2.9)] },
    { title: 'Robot 2 · router, mud, sander, paint', dur: 17,
      body: 'It routs the outlet holes from its scan, sprays joint compound on the seams, sands them with the vacuum hood catching the dust, then sprays the paint.',
      real: 'Commercial drywall-finishing robots already spray and sand joint compound (e.g. Canvas in San Francisco).',
      enter() { sheets.forEach((s, j) => { s.visible = true; s.position.set(eastX, 1.22, sheetsZ[j]); s.rotation.set(0, 0, 0); }); ceilSheet.visible = true; ceilSheet.position.set(4.6, H2 - 0.04, 2.6); r2Legs(0); lrStack.visible = false; },
      update(k, dt) {
        turnTo(r2.g, Math.PI / 2, dt, 4); r2Legs(0);
        outlets[0].visible = k > 0.045; outlets[1].visible = k > 0.135;
        if (k < 0.18) {
          r2Tool('router'); const o = outlets[k < 0.09 ? 0 : 1], f = (k % 0.09) / 0.09;
          follow(r2.g, V(5.6, -0.05, o.position.z), dt);
          const tip = o.position.clone().add(V(0, Math.sin(f * 6.28) * 0.04, Math.cos(f * 6.28) * 0.03)); r2Reach(tip); fx('dust', tip.toArray(), 0.1);
        } else if (k < 0.42) {
          r2Tool('spray'); const w = seg01(k, 0.18, 0.42), i = Math.min(2, Math.floor(w * 3)), f = w * 3 - i, sm = seams[i];
          seams.forEach((m, j) => { m.visible = j <= i; const e = j < i ? 1 : Math.max(0.01, f); m.scale.y = e; m.position.y = 1.22 * e + 0.01; });
          follow(r2.g, V(5.6, -0.05, sm.position.z), dt);
          const tip = V(eastX - 0.15, 0.1 + 2.3 * f, sm.position.z); r2Reach(tip); fx('spray', tip.toArray(), 0.1, [1, 0, 0]);
        } else if (k < 0.66) {
          r2Tool('sander'); const w = seg01(k, 0.42, 0.66), i = Math.min(2, Math.floor(w * 3)), f = w * 3 - i, sm = seams[i];
          seams.forEach((m, j) => { m.visible = true; m.scale.y = 1; m.position.y = 1.22; m.material = j < i || (j === i && f > 0.9) ? C.drywall : C.mud; });
          follow(r2.g, V(5.6, -0.05, sm.position.z), dt);
          const tip = V(eastX - 0.01, 0.2 + 2.1 * (0.5 - 0.5 * Math.cos(f * Math.PI * 2)), sm.position.z + Math.sin(S.anim * 8) * 0.04); r2Reach(tip);
          fx('dust', tip.toArray(), 0.1, [-1, -0.3, 0]);
        } else {
          r2Tool('spray'); const w = seg01(k, 0.66, 1), z = lerp(0.1, 4.9, w);
          follow(r2.g, V(5.4, -0.05, clamp(z, 0.6, 4.4)), dt);
          const tip = V(eastX - 0.35, 1.2 + Math.sin(S.anim * 3) * 1.0, z); r2Reach(tip);
          sheets.forEach(s => { if (s.position.z - 0.61 < z) s.material.color.lerp(paintColor, Math.min(1, dt * 2)); });
          seams.forEach(m => { m.visible = false; }); fx('spray', tip.toArray(), 0.1, [1, 0, 0]);
        }
      },
      cam: k => [V(2.6, 1.7, lerp(0.8, 1.6, k)), V(6.4, 1.2, lerp(1.6, 3.0, k))] },
    { title: 'Room by room, then move-in', dur: 10,
      body: 'Robot 2 repeats the routine in every room while people finish the plumbing, electrical and inspections. Then the floors go in.',
      real: '',
      enter() { sheets.forEach(s => { s.material.color.copy(paintColor); }); r2Tool('spray'); r2.g.position.set(4.5, -0.05, 4.2); panes.forEach(p => { p.visible = false; }); },
      update(k, dt) {
        drive(r2.g, [V(4.5, -0.05, 4.2), V(0, -0.05, 4.3), V(-4, -0.05, 4.33), V(-7.8, -0.05, 4.33)], k, dt);
        r2Reach(r2.g.localToWorld(V(0.3, 1.5, 0.5)));
        const P = houseParts(), x = r2.g.position.x;
        P.walls.forEach(w => { w.visible = true; w.children.forEach(c => { c.visible = c.position.x > x - 0.8 || k > 0.98; }); });
        P.floorsM.forEach(f => { f.visible = f.position.x > x - 1 || k > 0.98; });
        [...sheets, ceilSheet].forEach(s => { s.visible = false; });
      },
      cam: k => [V(-14, 6, lerp(-12, -10, k)), V(-1, 1, 4)] },
    { title: 'Done: who did what', dur: 9,
      body: 'Robots: grading, trenching, compaction, screeding, roof, siding, gutters, trim, insulation, drywall, finishing and paint. People: design, framing, the concrete pour, windows, plumbing, electrical, inspections, and supervising the robots.',
      real: '',
      enter() { const P = houseParts(); P.walls.forEach(w => { w.visible = true; w.children.forEach(c => { c.visible = true; }); }); P.floorsM.forEach(f => { f.visible = true; });
               r2.g.visible = false; r1.g.position.set(17, 0, -1); r1.g.rotation.y = -Math.PI / 2; crew.forEach(w => { w.g.visible = false; });
               // landscaping: the graded lot becomes lawn again, the fence goes up on the auger's post holes
               site.fence.visible = site.lawn.visible = site.plinth.visible = site.garden.visible = true; terr.m.visible = pad.visible = trench.visible = false; slabs.forEach(m => { m.visible = false; }); gravel.forEach(g => { g.visible = false; }); piles.forEach(p => { p.visible = false; }); },
      cam: k => [V(lerp(-15, 15, k), 3.2, lerp(-14, -15, k)), V(2, 1.6, 4)] },
    { title: 'Now cut it open: the robots that run the home', dur: 11,
      body: 'Same house, roof off and walls cut down. Inside, a bed-making robot, a cleaning robot, a laundry robot and a kitchen robot are waiting for someone to press their button.',
      real: '',
      enter() { houseParts().fixtures.forEach(f => { f.visible = true; f.scale.setScalar(0.001); }); frontDoor.visible = false; r1.g.visible = false; Object.values(tools).forEach(t => { t.visible = false; }); },
      update(k) {
        const a = ease(seg01(k, 0, 0.4)), b = ease(seg01(k, 0.3, 0.65)), c = seg01(k, 0.55, 0.95);
        roofLift.forEach(([o, y]) => { o.position.y = y + a * 9; o.visible = a < 0.98; });
        const squash = lerp(1, meta.dollhouse_wall_height / H2, b);
        houseParts().walls.forEach(w => { w.scale.y = squash; });
        outsideSkin.forEach(o => { o.scale.y = squash; o.position.y = o.userData.y0 * squash; });
        panels.forEach(p => { p.visible = b < 0.05; });
        const fixtures = houseParts().fixtures, n = fixtures.length;
        fixtures.forEach((f, i) => f.scale.setScalar(Math.max(0.001, ease(clamp(c * 2.2 - i / n * 1.2)))));
      },
      cam: k => [V(lerp(-14, -11, k), lerp(5, 15, ease(k)), lerp(-14, -9, k)), V(2, lerp(1, 0, k), lerp(4, 5.5, k))] },
  ];
  const roofLift = [...slopes, ...trusses, ...gables, ...gutters].map(o => [o, o.position.y]);
  const outsideSkin = [...siding.map(p => p.m), ...trims.map(q => q.t), ...panes];
  outsideSkin.forEach(o => { o.userData.y0 = o.position.y; });

  // ---------------------------------------------------------------- driver
  function houseParts() {
    const out = { floorsM: [], walls: [], fixtures: [], labels: [], other: [] };
    for (const F of Object.values(floors)) for (const o of F.group.children) {
      if (o === F.walls) out.walls.push(o); else if (o.userData.room) out.floorsM.push(o); else if (o.userData.isLabel) out.labels.push(o);
      else if (o.userData.fixture) out.fixtures.push(o); else out.other.push(o);
    }
    return out;
  }
  const ui = ctx.ui;
  let active = false, ch = 0, t = 0, freeLook = false, saved = null;
  controls.addEventListener('start', () => { if (active) freeLook = true; });
  function resetAll() {
    terr.reset(); terr.m.visible = pad.visible = true; piles.forEach(p => { p.visible = true; }); trench.visible = false; trenchList.forEach(q => { q.m.scale.y = 0.01; }); piles.forEach(p => p.scale.setScalar(0.01));
    gravel.forEach(g => { g.scale.y = 0.01; g.visible = false; }); holes.forEach(h => h.scale.setScalar(0.01)); pourScreed(-1, -1); slabs.forEach(m => { m.visible = false; });
    panels.forEach(p => { p.visible = false; }); stacks.forEach(s => { s.visible = false; s.scale.y = 1; });
    roofLift.forEach(([o, y]) => { o.position.y = y; o.visible = false; }); trusses.forEach(q => q.position.copy(q.userData.final));
    slopes.forEach(s => shingleProgress(s, 0));
    outsideSkin.forEach(o => { o.visible = false; o.scale.y = 1; o.position.y = o.userData.y0; });
    frontDoor.visible = garageDoor.visible = false;
    sheets.forEach(s => { s.visible = false; s.material.color.set('#ffffff'); }); ceilSheet.visible = false; cav.forEach(m => { m.visible = false; });
    seams.forEach(m => { m.visible = false; m.material = C.mud; }); outlets.forEach(o => { o.visible = false; }); lrStack.visible = true; lrStack.scale.y = 1;
    crew.forEach(w => { w.g.visible = false; }); truck.g.visible = false;
    r1.g.visible = r2.g.visible = true; Object.values(tools).forEach(t2 => { t2.visible = true; }); parkTools(); r1._tool = null;
    site.plinth.visible = site.lawn.visible = site.fence.visible = site.garden.visible = false;
    S.full = true; ctx.rebuildWalls();
    const P = houseParts();
    [...P.floorsM, ...P.labels, ...P.fixtures, ...P.other].forEach(o => { o.visible = false; });
    P.walls.forEach(w => { w.visible = false; w.scale.y = 1; });
  }
  function enterChapter(i, cut = true) {
    ch = i; t = 0; freeLook = false; r1._tool = null; workClock = 0;
    CH[i].enter?.call(CH[i]);
    ui.caption(CH[i], i, CH.length);
    if (cut) {                 // clean cut straight to the new shot
      const [p, tg] = CH[i].cam(0); camera.position.copy(p); controls.target.copy(tg);
    }
  }
  function settle(c) { for (let s = 1; s <= 6; s++) c.update?.call(c, s / 6, 0.5); }   // fast-forward a chapter to its end state
  function jumpTo(i, cut = true) { resetAll(); for (let j = 0; j < i; j++) { enterChapter(j, false); settle(CH[j]); } enterChapter(i, cut); }
  function start() {
    saved = { full: S.full, mult: S.mult };
    active = true; root.visible = true; ctx.setInteractive(false); ctx.ensureFurnished();
    S.mult = 1; scene.fog = new THREE.Fog(0xcfdde8, 70, 220);
    jumpTo(0); ui.show(true); lastPos = sheet.sequence.position = 0;
  }
  function finish() {
    active = false; root.visible = false; scene.fog = null;
    site.plinth.visible = site.lawn.visible = site.fence.visible = site.garden.visible = true;
    const P = houseParts(); P.fixtures.forEach(f => { f.scale.setScalar(1); f.visible = true; });
    [...P.floorsM, ...P.other].forEach(o => { o.visible = true; });
    S.full = saved.full; S.mult = saved.mult;
    ctx.rebuildWalls(); ctx.setInteractive(true); ui.show(false);
  }
  // ---------------------------------------------------------------- Theatre.js: timeline + camera
  // The whole story is one Theatre sequence (seconds). A "Camera" object on it is either automatic (the shots
  // coded per chapter) or keyframed in Theatre Studio (open the page with ?edit). Saved keyframes load from
  // story-theatre.json, so the team can choreograph the shots without touching code.
  const starts = []; let total = 0; for (const c of CH) { starts.push(total); total += c.dur; }
  const blank = { sheetsById: { Story: { staticOverrides: { byObject: {} }, sequence: { subUnitsPerUnit: 30, length: Math.ceil(total), type: 'PositionalSequence', tracksByObject: {} } } },
                  definitionVersion: '0.4.0', revisionHistory: ['story'] };
  const project = getProject('BASES construction story', { state: ctx.theatreState || blank });
  const sheet = project.sheet('Story');
  const xyz = (x, y, z) => types.compound({ x: types.number(x, { nudgeMultiplier: 0.1 }), y: types.number(y, { nudgeMultiplier: 0.1 }), z: types.number(z, { nudgeMultiplier: 0.1 }) });
  const camObj = sheet.object('Camera', {
    mode: types.stringLiteral('auto', { auto: 'Automatic (coded shots)', keyframes: 'Keyframed here' }),
    position: xyz(-15, 9, -14), target: xyz(2, 1, 5), fov: types.number(45, { range: [15, 90] }),
  });
  let camVals = camObj.value; camObj.onValuesChange(v => { camVals = v; });
  const editing = !!ctx.studio;
  let lastPos = 0;
  const storyTime = () => starts[ch] + t;
  // Move the story to time p: replay earlier chapters to their end state, then step the current one forward.
  function seek(p) {
    p = clamp(p, 0, total - 1e-3);
    let i = 0; while (i < CH.length - 1 && p >= starts[i + 1]) i++;
    const k = (p - starts[i]) / CH[i].dur;
    if (i !== ch || p < storyTime() - 1e-3) { jumpTo(i, false); for (let s2 = 1; s2 <= 4; s2++) CH[i].update?.call(CH[i], k * s2 / 4, 0.25); }
    else CH[i].update?.call(CH[i], k, p - storyTime());
    t = p - starts[i];
  }
  onChange(sheet.sequence.pointer.position, p => { if (active && editing && Math.abs(p - lastPos) > 1e-3) { lastPos = p; seek(p); } });
  function applyCamera(c, k, dt) {
    if (freeLook) return;
    if (camVals.mode === 'keyframes') {
      camera.position.set(camVals.position.x, camVals.position.y, camVals.position.z);
      controls.target.set(camVals.target.x, camVals.target.y, camVals.target.z);
    } else { const [p, tg] = c.cam(k), s2 = 1 - Math.exp(-dt * 2.2); camera.position.lerp(p, s2); controls.target.lerp(tg, s2); }   // camera rides a spring
    if (camera.fov !== camVals.fov) { camera.fov = camVals.fov; camera.updateProjectionMatrix(); }
  }
  function tick(dt) {
    if (!active) return;
    dt = Math.min(dt, 0.1);
    const c = CH[ch];
    if (!editing) {                   // normal playback: the story clock drives the Theatre sequence
      t += dt;
      const k = clamp(t / c.dur);
      c.update?.call(c, k, dt);
      lastPos = sheet.sequence.position = storyTime();
      if (k >= 1) { if (ch < CH.length - 1) enterChapter(ch + 1); else finish(); }
    }
    applyCamera(CH[ch], clamp(t / CH[ch].dur), dt);
    ui.progress(storyTime() / total);
  }
  // Edit mode: store the current orbit view as a camera keyframe at the playhead.
  function captureView() {
    if (!ctx.studio) return;
    const p = camera.position, g = controls.target;
    ctx.studio.transaction(({ set }) => {
      set(camObj.props.mode, 'keyframes');
      set(camObj.props.position, { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
      set(camObj.props.target, { x: +g.x.toFixed(2), y: +g.y.toFixed(2), z: +g.z.toFixed(2) });
    });
    freeLook = false;
  }
  const goTo = i => { if (editing) { lastPos = sheet.sequence.position = starts[i]; seek(starts[i]); } else { jumpTo(i); } };

  return {
    start, tick, captureView, get active() { return active; },
    next() { if (!active) return; if (ch === CH.length - 1) return finish(); if (editing) return goTo(ch + 1); settle(CH[ch]); enterChapter(ch + 1); },
    prev() { if (active) goTo(Math.max(0, ch - 1)); },
    exit() { if (!active) return; jumpTo(CH.length - 1); settle(CH[ch]); finish(); },
  };
}
