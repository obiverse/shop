// The Showroom: product cut-outs on a turntable you spin like a game wheel. Drag with momentum, snap to a
// product, tap to open it. Unlit cut-outs (the photos are already graded), a mirrored floor, blob shadows
// and drifting sparkles. Quality follows the fufu engine's rule: never drop below ~45 fps; shed resolution
// first, then sparkles. Only loaded on devices that pass the gate on the home page.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, PerspectiveCamera,
  PlaneGeometry, Points, PointsMaterial, Raycaster, Scene, SRGBColorSpace, Texture, TextureLoader, Vector2, WebGLRenderer,
} from "three";

export type ShowItem = { img: string; url: string };

const H = 1.9; // item height in world units
const R = 3; // turntable radius

function gradientTexture(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 128) {
  const c = Object.assign(document.createElement("canvas"), { width: size, height: size });
  draw(c.getContext("2d")!, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function mount(host: HTMLElement, items: ShowItem[], onFocus: (i: number) => void) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  let dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 1.25, 10.1);
  camera.lookAt(0, 0.3, 0); // aim low: the product sits above the price card, its reflection just visible

  // floor glow + per-item blob shadows + reflection fade, all from tiny canvas gradients
  const glow = gradientTexture((g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  const blob = gradientTexture((g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(30,15,5,.45)"); r.addColorStop(1, "rgba(30,15,5,0)");
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  const fade = gradientTexture((g, s) => {
    const l = g.createLinearGradient(0, 0, 0, s); // canvas top = texture v1 = the far end of the mirrored image
    l.addColorStop(0, "#000"); l.addColorStop(0.55, "#000"); l.addColorStop(1, "#fff");
    g.fillStyle = l; g.fillRect(0, 0, s, s);
  }, 64);

  const floor = new Mesh(new PlaneGeometry(11, 11), new MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ring = new Group();
  scene.add(ring);
  const step = (Math.PI * 2) / items.length;
  const loader = new TextureLoader();
  type Slot = { item: Mesh; mirror: Mesh; shadow: Mesh; mat: MeshBasicMaterial; mmat: MeshBasicMaterial; theta: number };
  const slots: Slot[] = items.map((it, i) => {
    const geo = new PlaneGeometry(1, H);
    geo.translate(0, H / 2, 0); // stand on the floor
    const mat = new MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 });
    const mmat = new MeshBasicMaterial({ transparent: true, depthWrite: false, alphaMap: fade, opacity: 0 });
    const item = new Mesh(geo, mat);
    const mirror = new Mesh(geo, mmat);
    mirror.scale.y = -1;
    const shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    const theta = i * step;
    for (const m of [item, mirror, shadow]) { m.position.x = Math.sin(theta) * R; m.position.z = Math.cos(theta) * R; ring.add(m); }
    shadow.position.y = 0.01;
    item.userData.i = i;
    loader.load(it.img, (t: Texture) => {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const aspect = (t.image as HTMLImageElement).width / (t.image as HTMLImageElement).height;
      const w = Math.min(H * aspect, 2.3);
      const h = w / aspect;
      for (const m of [item, mirror]) { m.scale.x = w; m.scale.y = (m === mirror ? -1 : 1) * (h / H); }
      shadow.scale.set(w * 1.05, w * 0.32, 1);
      mat.map = t; mmat.map = t; mat.needsUpdate = mmat.needsUpdate = true;
    });
    return { item, mirror, shadow, mat, mmat, theta };
  });

  // sparkles drifting up through the scene
  const N_SPARK = matchMedia("(pointer: coarse)").matches ? 40 : 80;
  const pos = new Float32Array(N_SPARK * 3);
  for (let i = 0; i < N_SPARK; i++) { const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4; pos.set([Math.cos(a) * r, Math.random() * 3.2, Math.sin(a) * r - 1], i * 3); }
  const sparkGeo = new BufferGeometry();
  sparkGeo.setAttribute("position", new BufferAttribute(pos, 3));
  const sparkMat = new PointsMaterial({ color: 0xffd27a, size: 0.06, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
  const sparks = new Points(sparkGeo, sparkMat);
  scene.add(sparks);

  // ── spin physics: drag → velocity → friction → spring-snap to the nearest product
  let rot = 0, target = 0, vel = 0, dragging = false, lastX = 0, lastT = 0, moved = 0, lastTouch = performance.now(), active = -1;
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const nearest = (r: number) => Math.round(r / step) * step;
  const indexAt = (r: number) => ((Math.round(-r / step) % items.length) + items.length) % items.length;
  const el = renderer.domElement;
  el.style.touchAction = "pan-y";
  el.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastT = e.timeStamp; moved = 0; vel = 0; lastTouch = performance.now(); el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dt = Math.max(1, e.timeStamp - lastT);
    const k = (Math.PI * 1.1) / host.clientWidth;
    rot += dx * k; vel = (dx * k) / (dt / 1000); moved += Math.abs(dx);
    lastX = e.clientX; lastT = e.timeStamp;
  });
  const ray = new Raycaster(), ndc = new Vector2();
  el.addEventListener("pointerup", (e) => {
    dragging = false;
    lastTouch = performance.now();
    if (moved < 8) { // a tap: open the front product, or bring a side one round
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(slots.map((s) => s.item))[0];
      if (!hit) { target = nearest(rot); return; }
      const i = hit.object.userData.i as number;
      if (i === active) { location.href = items[i].url; return; }
      target = rot + wrap(-slots[i].theta - rot);
      return;
    }
    target = nearest(rot + Math.max(-2.5, Math.min(2.5, vel)) * 0.32); // throw it, then snap
  });
  el.addEventListener("pointercancel", () => { dragging = false; target = nearest(rot); });

  // ── loop, with dynamic resolution and offscreen pause
  let visible = true, raf = 0, prev = performance.now(), ema = 16, slowFor = 0;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); });
  io.observe(host);
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.position.z = w / h < 0.9 ? 10.6 : 10.1; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host);
  resize();

  function frame(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    ema = ema * 0.92 + dt * 1000 * 0.08;
    if (ema > 22) slowFor += dt; else slowFor = Math.max(0, slowFor - dt);
    if (slowFor > 1.5) { slowFor = 0; if (dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); } else sparks.visible = false; }

    if (!dragging) {
      if (now - lastTouch > 4200) { target = nearest(rot) - step; lastTouch = now - 1000; } // idle: next product every ~3s
      rot += (target - rot) * (1 - Math.exp(-dt * 7));
    }
    ring.rotation.y = rot;
    const front = indexAt(rot);
    if (front !== active) { active = front; onFocus(front); }

    for (const s of slots) {
      const f = (Math.cos(s.theta + rot) + 1) / 2; // 1 at the front, 0 at the back
      const face = -rot; // billboard: always face the camera
      s.item.rotation.y = s.mirror.rotation.y = face;
      s.mat.opacity += ((s.mat.map ? 0.06 + 0.94 * f ** 3 : 0) - s.mat.opacity) * 0.2;
      s.mmat.opacity = s.mat.opacity * 0.3;
      (s.shadow.material as MeshBasicMaterial).opacity = f ** 2;
      const lift = s.theta === slots[active].theta ? Math.sin(now / 600) * 0.04 + 0.05 : 0; // the chosen one floats
      s.item.position.y = lift;
    }
    if (sparks.visible) {
      const p = sparkGeo.attributes.position as BufferAttribute;
      for (let i = 0; i < N_SPARK; i++) { let y = p.getY(i) + dt * (0.12 + (i % 5) * 0.03); if (y > 3.4) y = 0; p.setY(i, y); }
      p.needsUpdate = true;
      sparkMat.opacity = 0.6 + Math.sin(now / 500) * 0.25;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } });
  raf = requestAnimationFrame(frame);

  return {
    go(d: number) { lastTouch = performance.now(); target = nearest(rot) - d * step; },
    get active() { return active; },
  };
}
