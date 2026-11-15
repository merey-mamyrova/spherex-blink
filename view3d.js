// 3D view of a SPHEREx frame: brightness becomes height, the surface turns through 360°.
// Real data only: every vertex is one pixel of the aligned SPHEREx stack shown in the 2D view.
import * as THREE from "./vendor/three.module.js";

let renderer, scene, camera, mesh, geo, marker, host, raf = 0, N = 0;
let angle = 0.6, tilt = 0.85, auto = true, drag = null, lastT = 0;

function init(el) {
  host = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x02040a, 1);
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(2, 4, 3); scene.add(sun);
  const grid = new THREE.GridHelper(2.2, 22, 0x1c2a4a, 0x111a2e); grid.position.y = -0.002; scene.add(grid);
  marker = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.045, 48), new THREE.MeshBasicMaterial({ color: 0xffb454, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
  const c = renderer.domElement;
  c.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, a: angle, t: tilt }; auto = false; c.setPointerCapture(e.pointerId); });
  c.addEventListener("pointermove", e => { if (!drag) return; angle = drag.a - (e.clientX - drag.x) * 0.01; tilt = Math.max(0.25, Math.min(1.45, drag.t + (e.clientY - drag.y) * 0.006)); });
  c.addEventListener("pointerup", () => { drag = null; });
  c.addEventListener("dblclick", () => { auto = !auto; });
}

function build(n) {
  N = n;
  if (mesh) { scene.remove(mesh); geo.dispose(); }
  geo = new THREE.PlaneGeometry(2, 2, n - 1, n - 1);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
  mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, flatShading: false }));
  scene.add(mesh);
}

// vals: Float32Array N*N in 0..1 (or −1..1 for a difference), rows top→bottom as in the 2D view
function update(vals, n, opt) {
  if (!renderer) return;
  if (n !== N) build(n);
  const pos = geo.attributes.position.array, col = geo.attributes.color.array, H = 0.55, t = opt.tint || [0.85, 0.92, 1];
  for (let i = 0; i < n * n; i++) {
    const v = vals[i];
    // PlaneGeometry vertex order is row-major from the top-left after rotateX, matching the image
    pos[3 * i + 1] = opt.diff ? v * H : v * H;
    if (opt.diff) {
      const a = Math.min(1, Math.abs(v));
      if (v > 0) { col[3 * i] = 0.1 + a; col[3 * i + 1] = 0.1 + a * 0.71; col[3 * i + 2] = 0.12 + a * 0.33; }
      else { col[3 * i] = 0.1 + a * 0.49; col[3 * i + 1] = 0.1 + a * 0.77; col[3 * i + 2] = 0.14 + a; }
    } else {
      const w = Math.max(0, v - 0.6) * 0.9;
      col[3 * i] = 0.05 + v * t[0] + w; col[3 * i + 1] = 0.06 + v * t[1] + w; col[3 * i + 2] = 0.1 + v * t[2] + w;
    }
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
  if (opt.mark) { marker.visible = true; marker.position.set(opt.mark[0] * 2 - 1, (opt.markH || 0) * H + 0.02, opt.mark[1] * 2 - 1); }
  else marker.visible = false;
}

function size() {
  if (!host) return;
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px";
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

function loop(t) {
  raf = requestAnimationFrame(loop);
  const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0; lastT = t;
  if (auto) angle += dt * 0.45;               // one full turn in about 14 s
  const r = 3.0;
  camera.position.set(Math.sin(angle) * Math.cos(tilt) * r, Math.sin(tilt) * r, Math.cos(angle) * Math.cos(tilt) * r);
  camera.lookAt(0, 0.12, 0);
  renderer.render(scene, camera);
}

window.SPX3D = {
  start(el) { if (!renderer) init(el); size(); if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); } },
  stop() { cancelAnimationFrame(raf); raf = 0; },
  update, size,
  spin(on) { auto = on; }
};
window.dispatchEvent(new Event("spx3d-ready"));
