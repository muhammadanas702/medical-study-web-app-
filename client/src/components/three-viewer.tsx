import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type ViewerHandle = {
  load: (key: string, url: string, style: ((name: string) => { color: string; opacity?: number }) | null) => Promise<THREE.Object3D>;
  unload: (key: string) => void;
  setVisible: (key: string, v: boolean) => void;
  select: (names: string[], frame?: boolean) => void;
  isolate: (names: string[] | null) => void;
  setGroupOpacity: (key: string, opacity: number) => void;
  hideMeshes: (names: string[]) => void;
  reset: () => void;
  frameAll: () => void;
  setAutoRotate: (v: boolean) => void;
};

type Props = { onPick?: (name: string | null) => void; background?: string; className?: string; testId?: string };

const HL = new THREE.Color("#f5b301");

export const ThreeViewer = forwardRef<ViewerHandle, Props>(function ThreeViewer({ onPick, className, testId }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
    groups: Map<string, THREE.Object3D>; meshes: Map<string, THREE.Mesh>; base: Map<THREE.Mesh, { color: THREE.Color; opacity: number }>;
    selected: Set<string>; hidden: Set<string>; isolated: Set<string> | null; raf: number; dirty: boolean;
  } | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, el.clientWidth / Math.max(1, el.clientHeight), 0.005, 100);
    camera.position.set(0, 0.1, 3.4);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1.5, 2, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(-2, 1, -2); scene.add(rim);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.target.set(0, 0, 0);
    controls.autoRotateSpeed = 1.2;
    const s = { renderer, scene, camera, controls, groups: new Map(), meshes: new Map(), base: new Map(), selected: new Set<string>(), hidden: new Set<string>(), isolated: null as Set<string> | null, raf: 0, dirty: true };
    st.current = s;
    controls.addEventListener("change", () => (s.dirty = true));
    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      const moved = controls.update();
      if (moved || s.dirty || controls.autoRotate) { renderer.render(scene, camera); s.dirty = false; }
    };
    loop();
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix(); s.dirty = true;
    });
    ro.observe(el);
    // click (not drag) to pick
    let down: { x: number; y: number } | null = null;
    const ray = new THREE.Raycaster();
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const vis = Array.from(s.meshes.values()).filter((m) => m.visible && isShown(m));
      const hit = ray.intersectObjects(vis, false).find((h) => ((h.object as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity > 0.5) || ray.intersectObjects(vis, false)[0];
      pickRef.current?.(hit ? hit.object.name : null);
    };
    const isShown = (m: THREE.Object3D) => { let o: THREE.Object3D | null = m; while (o) { if (!o.visible) return false; o = o.parent; } return true; };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(s.raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, []);

  const paint = () => {
    const s = st.current!;
    s.meshes.forEach((m, name) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      const b = s.base.get(m)!;
      const sel = s.selected.has(name);
      mat.color.copy(sel ? HL : b.color);
      mat.emissive.set(sel ? "#5a3d00" : "#000000");
      const op = sel ? 1 : b.opacity;
      mat.opacity = op; mat.transparent = op < 1; mat.depthWrite = op >= 1;
      m.visible = !s.hidden.has(name) && (!s.isolated || s.isolated.has(name));
    });
    s.dirty = true;
  };

  const frame = (objs: THREE.Object3D[]) => {
    const s = st.current!;
    const box = new THREE.Box3();
    objs.forEach((o) => box.expandByObject(o));
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = Math.max(0.15, size / (2 * Math.tan((s.camera.fov * Math.PI) / 360))) * 1.1;
    const dir = s.camera.position.clone().sub(s.controls.target).normalize();
    s.controls.target.copy(c);
    s.camera.position.copy(c.clone().add(dir.multiplyScalar(dist)));
    s.camera.near = dist / 200; s.camera.far = dist * 50; s.camera.updateProjectionMatrix();
    s.dirty = true;
  };

  useImperativeHandle(ref, () => ({
    async load(key, url, style) {
      const s = st.current!;
      if (s.groups.has(key)) { s.groups.get(key)!.visible = true; s.dirty = true; return s.groups.get(key)!; }
      const gltf = await new GLTFLoader().loadAsync(url);
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const nm = m.name || m.parent?.name || "";
        m.name = nm;
        if (!style) {
          // keep the author's original materials (pathogen models)
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mt) => { (mt as THREE.MeshStandardMaterial).side = THREE.DoubleSide; });
          return;
        }
        const sty = style(nm);
        const mat = new THREE.MeshStandardMaterial({ color: sty.color, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
        const op = sty.opacity ?? 1;
        mat.opacity = op; mat.transparent = op < 1; mat.depthWrite = op >= 1;
        m.material = mat;
        if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
        s.meshes.set(nm, m);
        s.base.set(m, { color: new THREE.Color(sty.color), opacity: op });
      });
      s.scene.add(root);
      s.groups.set(key, root);
      if (style) paint(); else { frame([root]); }
      return root;
    },
    unload(key) {
      const s = st.current!; const g = s.groups.get(key); if (!g) return;
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { s.meshes.delete(m.name); s.base.delete(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
      s.scene.remove(g); s.groups.delete(key); s.dirty = true;
    },
    setVisible(key, v) { const s = st.current!; const g = s.groups.get(key); if (g) { g.visible = v; s.dirty = true; } },
    select(names, doFrame) {
      const s = st.current!; s.selected = new Set(names); paint();
      if (doFrame) { const objs = names.map((n) => s.meshes.get(n)).filter(Boolean) as THREE.Object3D[]; if (objs.length) frame(objs); }
    },
    isolate(names) { const s = st.current!; s.isolated = names ? new Set(names) : null; paint(); if (names) frame(names.map((n) => s.meshes.get(n)).filter(Boolean) as THREE.Object3D[]); },
    setGroupOpacity(key, opacity) {
      const s = st.current!; const g = s.groups.get(key); if (!g) return;
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) s.base.get(m)!.opacity = opacity; });
      paint();
    },
    hideMeshes(names) { const s = st.current!; s.hidden = new Set(names); paint(); },
    reset() {
      const s = st.current!; s.selected.clear(); s.isolated = null; s.hidden.clear(); paint();
      s.controls.target.set(0, 0, 0); s.camera.position.set(0, 0.1, 3.4); s.camera.near = 0.005; s.camera.far = 100; s.camera.updateProjectionMatrix(); s.dirty = true;
    },
    frameAll() { const s = st.current!; frame(Array.from(s.groups.values()).filter((g) => g.visible)); },
    setAutoRotate(v) { st.current!.controls.autoRotate = v; },
  }));

  return <div ref={host} className={className} data-testid={testId} style={{ touchAction: "none" }} />;
});
