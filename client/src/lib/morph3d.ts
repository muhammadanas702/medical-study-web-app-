// Procedural, schematic 3D morphology models for pathogens that have no openly licensed scanned/structural model.
// Shapes follow textbook morphology (arrangement, shape, flagella, spores, capsules, life-cycle stages);
// colors are illustrative (not Gram-stain colors) and sizes are not to scale between organisms.
import * as THREE from "three";

export type MorphPart = { name: string; desc: string; color: string };
export type MorphModel = { group: THREE.Group; parts: MorphPart[]; caption: string };

type Ctx = { g: THREE.Group; parts: Map<string, MorphPart> };
const ctx = (): Ctx => ({ g: new THREE.Group(), parts: new Map() });

function mat(color: string, opacity = 1, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.04, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide, ...extra });
}
function add(c: Ctx, geo: THREE.BufferGeometry, part: string, desc: string, color: string, opacity = 1, at?: THREE.Vector3, rot?: THREE.Euler, scale?: THREE.Vector3) {
  const m = new THREE.Mesh(geo, mat(color, opacity));
  m.name = part;
  if (at) m.position.copy(at);
  if (rot) m.rotation.copy(rot);
  if (scale) m.scale.copy(scale);
  c.g.add(m);
  if (!c.parts.has(part)) c.parts.set(part, { name: part, desc, color });
  return m;
}
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const E = (x = 0, y = 0, z = 0) => new THREE.Euler(x, y, z);
// deterministic pseudo-random so the model is identical on every load
function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
const sphere = (r: number, d = 32) => new THREE.SphereGeometry(r, d, Math.round(d * 0.75));
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 8, 24);
function tube(points: THREE.Vector3[], r: number, seg = 64) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, 8, false); }
function wavy(from: THREE.Vector3, dir: THREE.Vector3, len: number, amp: number, waves: number, phase = 0) {
  const d = dir.clone().normalize();
  const n1 = new THREE.Vector3(0, 1, 0); if (Math.abs(d.dot(n1)) > 0.9) n1.set(1, 0, 0);
  const a = new THREE.Vector3().crossVectors(d, n1).normalize(); const b = new THREE.Vector3().crossVectors(d, a).normalize();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40; const ang = t * waves * Math.PI * 2 + phase;
    pts.push(from.clone().add(d.clone().multiplyScalar(t * len)).add(a.clone().multiplyScalar(Math.sin(ang) * amp * Math.min(1, t * 4))).add(b.clone().multiplyScalar(Math.cos(ang) * amp * 0.6 * Math.min(1, t * 4))));
  }
  return pts;
}
// align a Y-axis primitive to a direction
function alignY(m: THREE.Object3D, dir: THREE.Vector3) { m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); }

const FLAG = "#e9c46a";
const FLAG_DESC = "Flagellum: whip-like motility organelle built from flagellin (H antigen in Enterobacteriaceae).";

function rod(c: Ctx, at: THREE.Vector3, dir: THREE.Vector3, r: number, len: number, part: string, desc: string, color: string) {
  const m = add(c, capsule(r, len), part, desc, color, 1, at); alignY(m, dir); return m;
}
function peritrichous(c: Ctx, at: THREE.Vector3, dir: THREE.Vector3, r: number, len: number, n: number, seed: number) {
  const R = rng(seed); const d = dir.clone().normalize();
  for (let i = 0; i < n; i++) {
    const t = (R() - 0.5) * len; const ang = R() * Math.PI * 2;
    const n1 = new THREE.Vector3(0, 0, 1); if (Math.abs(d.dot(n1)) > 0.9) n1.set(1, 0, 0);
    const a = new THREE.Vector3().crossVectors(d, n1).normalize(); const b = new THREE.Vector3().crossVectors(d, a).normalize();
    const out = a.clone().multiplyScalar(Math.cos(ang)).add(b.clone().multiplyScalar(Math.sin(ang)));
    const start = at.clone().add(d.clone().multiplyScalar(t)).add(out.clone().multiplyScalar(r * 0.95));
    const fdir = out.clone().add(d.clone().multiplyScalar(-0.8 + R() * 0.3));
    add(c, tube(wavy(start, fdir, len * 1.6, r * 0.35, 3, R() * 6), r * 0.05), "Flagella", FLAG_DESC.replace("Flagellum", "Peritrichous flagella"), FLAG);
  }
}
function polar(c: Ctx, at: THREE.Vector3, dir: THREE.Vector3, r: number, len: number, n: number, seed: number, label = "Polar flagellum") {
  const R = rng(seed); const d = dir.clone().normalize();
  const tip = at.clone().add(d.clone().multiplyScalar(-(len / 2 + r * 0.9)));
  for (let i = 0; i < n; i++) {
    const jitter = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.5);
    add(c, tube(wavy(tip, d.clone().negate().add(jitter), len * 2.2, r * 0.4, 2.5, R() * 6), r * 0.06), label, FLAG_DESC.replace("Flagellum", label), FLAG);
  }
}

// ── bacteria ──
const B = {
  cluster(c: Ctx, o: { color: string; part: string; desc: string; capsule?: string }) {
    const R = rng(7); const pts: THREE.Vector3[] = [V()];
    while (pts.length < 22) {
      const base = pts[Math.floor(R() * pts.length)];
      const p = base.clone().add(new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(0.36));
      if (pts.every((q) => q.distanceTo(p) > 0.33)) pts.push(p);
    }
    pts.forEach((p) => add(c, sphere(0.19), o.part, o.desc, o.color, 1, p));
    return "Gram-positive cocci in grape-like clusters (division in multiple planes).";
  },
  chain(c: Ctx, o: { color: string; part: string; desc: string; capsuleDesc?: string }) {
    const pts = wavy(V(-1.4, 0, 0), V(1, 0, 0), 2.8, 0.25, 0.7);
    for (let i = 0; i <= 40; i += 3) add(c, sphere(0.12), o.part, o.desc, o.color, 1, pts[i], undefined, V(1, 0.92, 0.92));
    if (o.capsuleDesc) for (let i = 0; i <= 40; i += 3) add(c, sphere(0.155), "Hyaluronic acid capsule", o.capsuleDesc, "#9ad1d4", 0.22, pts[i]);
    return "Gram-positive cocci in chains (division in one plane).";
  },
  lancet(c: Ctx, o: { color: string }) {
    const pairs = [[V(-0.7, 0.3, 0), 0.3], [V(0.6, -0.2, 0.3), -0.5], [V(0, 0.6, -0.6), 1.2]] as const;
    pairs.forEach(([p, a]) => {
      const g = new THREE.Group(); g.position.copy(p); g.rotation.set(0, 0, a);
      [-1, 1].forEach((s) => {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 24), mat(o.color)); m.name = "Lancet-shaped coccus";
        m.position.set(s * 0.25, 0, 0); m.rotation.set(0, 0, s * Math.PI / 2); g.add(m);
        const cap = new THREE.Mesh(sphere(0.29), mat("#9ad1d4", 0.2)); cap.name = "Polysaccharide capsule"; cap.position.set(s * 0.22, 0, 0); cap.scale.set(1.15, 0.8, 0.8); g.add(cap);
      });
      c.g.add(g);
    });
    c.parts.set("Lancet-shaped coccus", { name: "Lancet-shaped coccus", desc: "Gram-positive, lancet-shaped diplococci; alpha-hemolytic, optochin-sensitive, bile-soluble.", color: o.color });
    c.parts.set("Polysaccharide capsule", { name: "Polysaccharide capsule", desc: "Main virulence factor (antiphagocytic, >90 serotypes); target of the PCV and PPSV vaccines; Quellung reaction positive.", color: "#9ad1d4" });
    return "Lancet-shaped Gram-positive diplococci surrounded by a polysaccharide capsule.";
  },
  kidney(c: Ctx, o: { color: string; desc: string; capsule?: string }) {
    const R = rng(3);
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group(); g.position.set((R() - 0.5) * 1.6, (R() - 0.5) * 1.2, (R() - 0.5) * 0.8); g.rotation.set(R() * 3, R() * 3, R() * 3);
      [-1, 1].forEach((s) => {
        const m = new THREE.Mesh(sphere(0.2), mat(o.color)); m.name = "Kidney-bean diplococcus"; m.scale.set(0.62, 1, 1); m.position.set(s * 0.15, 0, 0); g.add(m);
        if (o.capsule) { const cap = new THREE.Mesh(sphere(0.26), mat("#9ad1d4", 0.2)); cap.name = "Polysaccharide capsule"; cap.scale.set(0.75, 1, 1); cap.position.set(s * 0.15, 0, 0); g.add(cap); }
      });
      c.g.add(g);
    }
    c.parts.set("Kidney-bean diplococcus", { name: "Kidney-bean diplococcus", desc: o.desc, color: o.color });
    if (o.capsule) c.parts.set("Polysaccharide capsule", { name: "Polysaccharide capsule", desc: o.capsule, color: "#9ad1d4" });
    return "Gram-negative diplococci with flattened adjacent sides (kidney-bean / coffee-bean pairs).";
  },
  rods(c: Ctx, o: { color: string; part: string; desc: string; flag?: "peri" | "polar" | "none"; n?: number; r?: number; len?: number; spore?: "central" | "terminal" | "subterminal"; chain?: boolean; club?: boolean; capsule?: string }) {
    const r = o.r ?? 0.14, len = o.len ?? 0.6, n = o.n ?? 4; const R = rng(11);
    for (let i = 0; i < n; i++) {
      const at = o.chain ? V(-((n - 1) * (len + 2 * r + 0.03)) / 2 + i * (len + 2 * r + 0.03), 0, 0) : V((R() - 0.5) * 2, (R() - 0.5) * 1.6, (R() - 0.5) * 1);
      const dir = o.chain ? V(1, 0, 0) : V(R() - 0.5, R() - 0.5, R() - 0.5);
      if (o.club) {
        const m = add(c, capsule(r, len), o.part, o.desc, o.color, 1, at); alignY(m, dir);
        const knob = add(c, sphere(r * 1.25), o.part, o.desc, o.color, 1, at.clone().add(dir.clone().normalize().multiplyScalar(len / 2 + r * 0.2))); void knob;
        [-0.2, 0.15].forEach((t) => add(c, sphere(r * 0.5), "Metachromatic (Babes-Ernst) granules", "Polyphosphate granules that stain red-purple with methylene blue (Albert/Loeffler stain).", "#b5179e", 1, at.clone().add(dir.clone().normalize().multiplyScalar(t * len))));
      } else rod(c, at, dir, r, len, o.part, o.desc, o.color);
      if (o.capsule) { const cm = add(c, capsule(r * 1.45, len * 1.05), "Capsule", o.capsule, "#9ad1d4", 0.2, at); alignY(cm, dir); }
      if (o.spore) {
        const off = o.spore === "central" ? 0 : o.spore === "terminal" ? len / 2 + r * 0.6 : len * 0.32;
        const sr = o.spore === "terminal" ? r * 1.6 : r * 1.05;
        add(c, sphere(sr), "Endospore", "Dormant, heat- and disinfectant-resistant spore (dipicolinic acid, keratin-like coat); killed by autoclaving, not by alcohol hand rubs.", "#f1faee", 1, at.clone().add(dir.clone().normalize().multiplyScalar(off)));
      }
      if (o.flag === "peri") peritrichous(c, at, dir, r, len, 8, 20 + i);
      if (o.flag === "polar") polar(c, at, dir, r, len, 1, 40 + i);
    }
    return "";
  },
  comma(c: Ctx, o: { color: string }) {
    const R = rng(5);
    for (let i = 0; i < 4; i++) {
      const at = V((R() - 0.5) * 2, (R() - 0.5) * 1.4, (R() - 0.5) * 0.8);
      const g = new THREE.Group(); g.position.copy(at); g.rotation.set(R() * 3, R() * 3, R() * 3);
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 16, 40, Math.PI * 0.75), mat(o.color)); m.name = "Comma-shaped rod"; g.add(m);
      const end = V(0.42, 0, 0);
      const f = new THREE.Mesh(tube(wavy(end, V(0.2, -1, 0), 1.1, 0.06, 2.5), 0.012), mat(FLAG)); f.name = "Polar flagellum"; g.add(f);
      c.g.add(g);
    }
    c.parts.set("Comma-shaped rod", { name: "Comma-shaped rod", desc: "Curved Gram-negative rod; oxidase-positive, grows in alkaline media (TCBS agar, yellow colonies).", color: o.color });
    c.parts.set("Polar flagellum", { name: "Polar flagellum", desc: "Single sheathed polar flagellum gives darting ('shooting star') motility.", color: FLAG });
    return "Comma-shaped Gram-negative rods with a single polar flagellum.";
  },
  helical(c: Ctx, o: { color: string; part: string; desc: string; turns: number; r: number; len: number; tuft?: boolean; n?: number }) {
    const R = rng(9);
    for (let i = 0; i < (o.n ?? 3); i++) {
      const at = V((R() - 0.5) * 1.6, (R() - 0.5) * 1.6, (R() - 0.5) * 0.6); const dir = V(R() - 0.5, R() - 0.5, (R() - 0.5) * 0.3);
      const pts = wavy(at.clone().sub(dir.clone().normalize().multiplyScalar(o.len / 2)), dir, o.len, o.r * 2.5, o.turns);
      add(c, tube(pts, o.r, 160), o.part, o.desc, o.color);
      if (o.tuft) for (let k = 0; k < 5; k++) add(c, tube(wavy(pts[pts.length - 1], dir.clone().add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.6)), 0.7, 0.04, 2), 0.012), "Lophotrichous flagella", "Tuft of 4-6 sheathed unipolar flagella; corkscrew motility through gastric mucus.", FLAG);
    }
    return "";
  },
  elementary(c: Ctx) {
    add(c, sphere(1.1), "Host cell inclusion", "Membrane-bound intracytoplasmic inclusion where reticulate bodies replicate; seen on Giemsa stain as an inclusion body.", "#cdb4db", 0.25);
    const R = rng(4);
    for (let i = 0; i < 40; i++) { const p = V(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(R() * 0.85); add(c, sphere(i % 3 ? 0.07 : 0.13), i % 3 ? "Elementary body" : "Reticulate body", i % 3 ? "Small (about 0.3 um), infectious, metabolically inactive extracellular form; enters cells by endocytosis ('Elementary is Enfectious')." : "Larger (about 1 um), non-infectious, replicating intracellular form that divides by binary fission ('Reticulate Replicates').", i % 3 ? "#e63946" : "#457b9d", 1, p); }
    return "Obligate intracellular bacteria: elementary bodies (infectious) and reticulate bodies (replicating) inside a host cell inclusion.";
  },
};

// ── viruses ──
function spikes(c: Ctx, r: number, n: number, part: string, desc: string, color: string, len = 0.12, seed = 1) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, th = R() * Math.PI * 2; const d = V(Math.sqrt(1 - u * u) * Math.cos(th), u, Math.sqrt(1 - u * u) * Math.sin(th));
    const m = add(c, new THREE.CylinderGeometry(0.025, 0.018, len, 8), part, desc, color, 1, d.clone().multiplyScalar(r + len / 2)); alignY(m, d);
    add(c, sphere(0.045, 12), part, desc, color, 1, d.clone().multiplyScalar(r + len));
  }
}
const Vz = {
  herpes(c: Ctx) {
    add(c, sphere(1.0, 48), "Envelope", "Lipid envelope derived from the host nuclear membrane; makes the virion sensitive to drying and detergents.", "#f4a261", 0.25);
    spikes(c, 1.0, 70, "Envelope glycoproteins", "Glycoproteins (gB, gC, gD, gH/gL) mediate attachment and fusion; targets of neutralizing antibodies.", "#e76f51", 0.14, 3);
    add(c, sphere(0.86, 40), "Tegument", "Protein layer between capsid and envelope (e.g. VP16, VHS) delivered into the cell on entry.", "#ffd6a5", 0.35);
    add(c, new THREE.IcosahedronGeometry(0.6, 1), "Icosahedral capsid", "T=16 icosahedral capsid of 162 capsomeres (about 125 nm), assembled in the nucleus.", "#2a9d8f", 1, undefined, undefined, undefined).geometry.computeVertexNormals();
    add(c, sphere(0.34), "Linear dsDNA genome", "Large linear double-stranded DNA genome (about 125-235 kb); establishes lifelong latency.", "#264653");
    return "Enveloped icosahedral dsDNA virion (Herpesviridae): envelope with glycoproteins, tegument, capsid and genome. Schematic, not to scale.";
  },
  enveloped(c: Ctx, o: { spikeName: string; spikeDesc: string; core: string; coreDesc: string; genome: string; genomeDesc: string; caption: string; pleo?: boolean; color?: string }) {
    const env = add(c, sphere(1, 48), "Envelope", "Host-derived lipid bilayer envelope; inactivated by detergents and alcohol.", o.color ?? "#f4a261", 0.35);
    if (o.pleo) env.scale.set(1.15, 0.9, 1);
    spikes(c, 1, 90, o.spikeName, o.spikeDesc, "#e76f51", 0.16, 5);
    add(c, o.core.includes("helical") ? new THREE.TorusKnotGeometry(0.45, 0.07, 160, 12, 3, 7) : new THREE.IcosahedronGeometry(0.55, 1), o.core, o.coreDesc, "#2a9d8f");
    add(c, sphere(0.2), o.genome, o.genomeDesc, "#264653");
    return o.caption;
  },
  bullet(c: Ctx) {
    const pts: THREE.Vector2[] = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(t < 0.25 ? 0.38 * Math.sin((t / 0.25) * Math.PI / 2) : 0.38, -1.1 + t * 2.2)); }
    add(c, new THREE.LatheGeometry(pts, 40), "Envelope", "Bullet-shaped lipid envelope (about 75 x 180 nm), one end rounded, one end flat.", "#f4a261", 0.35);
    const R = rng(2);
    for (let i = 0; i < 120; i++) { const y = -1.0 + R() * 2.0; const a = R() * Math.PI * 2; const d = V(Math.cos(a), 0, Math.sin(a)); const rr = y > 0.55 ? 0.38 * Math.sin(((1.1 - y) / 0.55) * Math.PI / 2) : 0.38; if (rr < 0.05) continue; const m = add(c, new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), "G glycoprotein spikes", "Trimeric G protein binds the nicotinic acetylcholine receptor (and others) at the neuromuscular junction; target of rabies vaccine antibodies.", "#e76f51", 1, V(d.x * (rr + 0.06), y, d.z * (rr + 0.06))); alignY(m, d); }
    add(c, new THREE.TorusKnotGeometry(0.2, 0.06, 200, 10, 2, 13), "Helical nucleocapsid", "Tightly coiled helical ribonucleoprotein (N, P and L polymerase) around the negative-sense ssRNA genome.", "#2a9d8f", 1, V(0, -0.1, 0), undefined, V(1, 3.4, 1));
    return "Bullet-shaped enveloped (-)ssRNA virion (Rhabdoviridae). Schematic, not to scale.";
  },
  adeno(c: Ctx) {
    const ico = new THREE.IcosahedronGeometry(0.9, 0); add(c, ico, "Icosahedral capsid (hexons)", "Non-enveloped T=25 capsid of 240 hexon trimers (about 90 nm); resistant to many disinfectants.", "#2a9d8f");
    const pos = ico.attributes.position; const verts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) { const v = V(pos.getX(i), pos.getY(i), pos.getZ(i)); if (!verts.some((w) => w.distanceTo(v) < 1e-3)) verts.push(v); }
    verts.forEach((v) => {
      add(c, sphere(0.1, 16), "Penton bases", "Penton base proteins at the 12 vertices bind integrins to trigger endocytosis.", "#e9c46a", 1, v);
      const d = v.clone().normalize(); const m = add(c, new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), "Fibers", "Antenna-like fiber proteins at each vertex bind CAR (coxsackie-adenovirus receptor); act as hemagglutinin.", "#e76f51", 1, v.clone().add(d.clone().multiplyScalar(0.28))); alignY(m, d);
      add(c, sphere(0.06, 12), "Fibers", "", "#e76f51", 1, v.clone().add(d.clone().multiplyScalar(0.58)));
    });
    add(c, sphere(0.35), "Linear dsDNA genome", "Linear dsDNA (about 36 kb) with terminal protein covalently attached to each 5' end.", "#264653");
    return "Non-enveloped icosahedral dsDNA virion with fibers at the 12 vertices (Adenoviridae). Schematic, not to scale.";
  },
};

// ── fungi & parasites ──
const F = {
  candida(c: Ctx) {
    const R = rng(8);
    for (let i = 0; i < 6; i++) { const p = V((R() - 0.5) * 2.2, (R() - 0.5) * 1.4 + 0.6, (R() - 0.5)); add(c, sphere(0.2), "Budding yeast cells", "Oval budding yeast (blastoconidia) 4-6 um; the commensal form.", "#f6bd60", 1, p, undefined, V(1, 1.3, 1)); add(c, sphere(0.09), "Budding yeast cells", "", "#f6bd60", 1, p.clone().add(V(0.15, 0.25, 0))); }
    let p = V(-1.4, -0.7, 0); const d = V(1, 0.15, 0).normalize();
    for (let i = 0; i < 6; i++) { const m = add(c, capsule(0.08, 0.32), "Pseudohyphae", "Chains of elongated buds with constrictions at the septa (no true parallel walls) - the invasive tissue form.", "#f28482", 1, p.clone().add(d.clone().multiplyScalar(0.25))); alignY(m, d); p = p.clone().add(d.clone().multiplyScalar(0.5)); d.applyAxisAngle(V(0, 0, 1), (R() - 0.5) * 0.5); }
    const m = add(c, capsule(0.06, 1.0), "Germ tube", "True hypha emerging from a yeast cell within 2-3 h in serum at 37 C (germ tube test, presumptive C. albicans).", "#84a59d", 1, V(0.9, -0.5, 0.3)); alignY(m, V(0.3, -1, 0));
    add(c, sphere(0.2), "Budding yeast cells", "", "#f6bd60", 1, V(0.75, 0.05, 0.3), undefined, V(1, 1.3, 1));
    return "Dimorphic yeast: budding yeast cells, pseudohyphae and a germ tube.";
  },
  aspergillus(c: Ctx) {
    const R = rng(12);
    const branch = (from: THREE.Vector3, dir: THREE.Vector3, depth: number) => {
      let p = from.clone();
      for (let i = 0; i < 4; i++) {
        const m = add(c, new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), "Septate hyphae", "Narrow (3-6 um) hyphae with regular septa and acute (about 45 degree) dichotomous branching; angioinvasive.", "#90be6d", 1, p.clone().add(dir.clone().multiplyScalar(0.15))); alignY(m, dir);
        add(c, new THREE.CylinderGeometry(0.05, 0.05, 0.018, 10), "Septa", "Cross-walls dividing hyphae into compartments - separates Aspergillus from the broad, non-septate Mucorales.", "#43aa8b", 1, p.clone().add(dir.clone().multiplyScalar(0.3)), undefined).quaternion.setFromUnitVectors(V(0, 1, 0), dir);
        p = p.clone().add(dir.clone().multiplyScalar(0.31));
      }
      if (depth > 0) [-1, 1].forEach((s) => branch(p, dir.clone().applyAxisAngle(V(0, 0, 1), s * Math.PI / 8).add(V(0, 0, (R() - 0.5) * 0.2)).normalize(), depth - 1));
    };
    branch(V(-1.6, -0.6, 0), V(1, 0.25, 0).normalize(), 2);
    const top = V(-0.2, 1.1, 0);
    const st = add(c, new THREE.CylinderGeometry(0.05, 0.05, 1.2, 10), "Conidiophore", "Aerial stalk ending in a swollen vesicle.", "#90be6d", 1, V(-0.2, 0.5, 0));
    void st;
    add(c, sphere(0.2), "Vesicle", "Swollen tip of the conidiophore bearing phialides (seen in culture, not usually in tissue).", "#577590", 1, top);
    for (let i = 0; i < 60; i++) { const u = R() * 0.9 + 0.1, th = R() * Math.PI * 2; const d = V(Math.sqrt(1 - u * u) * Math.cos(th), u, Math.sqrt(1 - u * u) * Math.sin(th)); add(c, sphere(0.045, 10), "Conidia (spores)", "Inhaled airborne conidia (2-3 um) in radiating chains; cause disease in neutropenia or pre-existing cavities.", "#f9c74f", 1, top.clone().add(d.multiplyScalar(0.3 + R() * 0.25))); }
    return "Mould: septate hyphae with acute-angle branching and a conidiophore with vesicle and conidia.";
  },
  crypto(c: Ctx) {
    const R = rng(13);
    [[V(-0.5, 0, 0), 0.35], [V(0.6, 0.3, 0.2), 0.3], [V(0.1, -0.6, -0.3), 0.25]].forEach(([p, r]) => {
      const pp = p as THREE.Vector3, rr = r as number;
      add(c, sphere(rr), "Yeast cell", "Round yeast 4-10 um with narrow-based budding.", "#f8961e", 1, pp);
      add(c, sphere(rr * 1.9), "Polysaccharide capsule", "Thick glucuronoxylomannan capsule - clear halo on India ink; detected by cryptococcal antigen (CrAg) test; mucicarmine stains it red.", "#bde0fe", 0.2, pp);
    });
    add(c, sphere(0.13), "Yeast cell", "", "#f8961e", 1, V(-0.5, 0.42, 0)); void R;
    return "Encapsulated budding yeast with a wide polysaccharide capsule (India ink halo).";
  },
  pneumocystis(c: Ctx) {
    const R = rng(14);
    for (let i = 0; i < 7; i++) { const p = V((R() - 0.5) * 2, (R() - 0.5) * 1.5, (R() - 0.5) * 0.8); const m = add(c, new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.72), "Cysts (asci)", "Cup- or crushed-ping-pong-ball-shaped cysts 4-7 um, seen on methenamine silver stain of BAL fluid.", "#adb5bd", 1, p, E(R() * 3, R() * 3, 0)); void m; for (let k = 0; k < 4; k++) add(c, sphere(0.05, 10), "Intracystic bodies", "Up to 8 ascospores inside each mature cyst.", "#6d597a", 1, p.clone().add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.25))); }
    add(c, sphere(1.6), "Alveolar foamy exudate", "Organisms fill alveoli with a foamy eosinophilic exudate; causes diffuse interstitial pneumonia when CD4 < 200/uL.", "#ffcad4", 0.12);
    return "Cup-shaped cysts in a foamy alveolar exudate (silver stain appearance), schematic.";
  },
  histo(c: Ctx) {
    add(c, sphere(1.1), "Macrophage", "Alveolar macrophage; Histoplasma survives inside phagolysosomes and spreads through the reticuloendothelial system.", "#ffcad4", 0.3);
    add(c, sphere(0.35), "Macrophage nucleus", "", "#9d4edd", 1, V(-0.45, 0.3, 0)); 
    const R = rng(15);
    for (let i = 0; i < 26; i++) add(c, sphere(0.07, 12), "Intracellular yeasts", "Small (2-4 um) oval yeasts packed inside macrophages - the tissue form at 37 C.", "#f8961e", 1, V(R() - 0.4, R() - 0.5, R() - 0.5).multiplyScalar(1.3));
    return "Dimorphic fungus: tiny yeasts inside a macrophage (tissue form).";
  },
  plasmodium(c: Ctx) {
    const rbc = (p: THREE.Vector3, name: string, desc: string) => {
      const m = add(c, new THREE.TorusGeometry(0.32, 0.18, 24, 48), "Red blood cell", "Biconcave erythrocyte; P. falciparum infects RBCs of any age, producing high parasitemia.", "#e5383b", 0.9, p); m.scale.set(1, 1, 0.6);
      add(c, sphere(0.3, 32), "Red blood cell", "", "#e5383b", 0.75, p, undefined, V(1, 1, 0.22));
      const ring = add(c, new THREE.TorusGeometry(0.12, 0.022, 10, 32), name, desc, "#7b2cbf", 1, p.clone().add(V(0.05, 0.05, 0.1))); void ring;
      add(c, sphere(0.04, 12), "Chromatin dot", "Red chromatin dot(s) of the ring form; double dots and appliqué forms suggest falciparum.", "#c9184a", 1, p.clone().add(V(0.17, 0.05, 0.1)));
    };
    [V(-0.9, 0.5, 0), V(0.2, 0.7, 0.1), V(0.9, -0.1, 0), V(-0.3, -0.5, 0.1)].forEach((p) => rbc(p, "Ring trophozoite", "Delicate ring (signet-ring) form - the earliest stage inside the RBC."));
    const g = add(c, new THREE.TorusGeometry(0.55, 0.13, 16, 40, Math.PI * 0.8), "Banana-shaped gametocyte", "Crescent (banana) gametocyte - specific for P. falciparum; taken up by the Anopheles mosquito.", "#5a189a", 1, V(0.1, -1.0, 0.1), E(0, 0, Math.PI * 0.1)); void g;
    return "Thin-smear view in 3D: RBCs with ring trophozoites and a banana-shaped gametocyte (P. falciparum).";
  },
  toxo(c: Ctx) {
    const R = rng(16);
    for (let i = 0; i < 6; i++) {
      const p = V((R() - 0.5) * 2, (R() - 0.5) * 1.4, (R() - 0.5) * 0.6);
      const m = add(c, new THREE.TorusGeometry(0.38, 0.1, 16, 40, Math.PI * 0.7), "Tachyzoite", "Crescent-shaped rapidly dividing form (4-8 x 2-3 um) of acute infection; crosses the placenta.", "#4361ee", 1, p, E(R() * 3, R() * 3, R() * 3)); void m;
      add(c, sphere(0.06, 12), "Nucleus", "Central nucleus.", "#f72585", 1, p);
    }
    add(c, sphere(0.55), "Tissue cyst (bradyzoites)", "Cyst full of slowly dividing bradyzoites in brain and muscle; reactivates when CD4 < 100/uL (ring-enhancing brain lesions).", "#a5a58d", 0.45, V(1.3, 0.8, 0));
    for (let i = 0; i < 18; i++) add(c, sphere(0.06, 10), "Tissue cyst (bradyzoites)", "", "#4895ef", 1, V(1.3, 0.8, 0).add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.7)));
    return "Crescent tachyzoites and a tissue cyst containing bradyzoites.";
  },
  giardia(c: Ctx) {
    const body = add(c, sphere(0.8, 48), "Trophozoite body", "Pear-shaped, bilaterally symmetric trophozoite (10-20 um); the 'face' appearance on stained stool.", "#80ed99", 0.9); body.scale.set(0.75, 1.1, 0.35);
    add(c, sphere(0.42, 32), "Ventral adhesive disc", "Sucking disc that attaches to duodenal/jejunal villi, causing malabsorption (no invasion).", "#38a3a5", 0.8, V(0, 0.25, 0.22), undefined, V(1, 0.95, 0.15));
    [-0.22, 0.22].forEach((x) => add(c, sphere(0.13), "Two nuclei", "Two nuclei with central karyosomes ('eyes').", "#22577a", 1, V(x, 0.35, 0.26), undefined, V(1, 1.1, 0.5)));
    [-0.08, 0.08].forEach((x) => add(c, new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8), "Axostyle / median bodies", "Paired axonemes run down the midline; median bodies look like a 'smile'.", "#57cc99", 1, V(x, -0.25, 0.2)));
    const flag = (from: THREE.Vector3, dir: THREE.Vector3) => add(c, tube(wavy(from, dir, 1.0, 0.05, 2), 0.016), "Four pairs of flagella", "Eight flagella (four pairs) - falling-leaf motility.", FLAG);
    flag(V(-0.3, 0.6, 0), V(-1, 0.4, 0)); flag(V(0.3, 0.6, 0), V(1, 0.4, 0)); flag(V(-0.4, 0, 0), V(-1, -0.5, 0)); flag(V(0.4, 0, 0), V(1, -0.5, 0)); flag(V(-0.25, -0.5, 0), V(-0.6, -1, 0)); flag(V(0.25, -0.5, 0), V(0.6, -1, 0)); flag(V(-0.05, -0.85, 0), V(-0.2, -1, 0)); flag(V(0.05, -0.85, 0), V(0.2, -1, 0));
    return "Pear-shaped binucleate trophozoite with a ventral sucking disc and four pairs of flagella.";
  },
  entamoeba(c: Ctx) {
    const geo = sphere(1, 64); const pos = geo.attributes.position; const R = rng(17);
    const bumps = Array.from({ length: 6 }, () => V(R() - 0.5, R() - 0.5, R() - 0.5).normalize());
    for (let i = 0; i < pos.count; i++) { const v = V(pos.getX(i), pos.getY(i), pos.getZ(i)); let k = 1; bumps.forEach((b) => { k += 0.35 * Math.pow(Math.max(0, v.dot(b)), 8); }); v.multiplyScalar(k); pos.setXYZ(i, v.x, v.y * 0.7, v.z * 0.6); }
    geo.computeVertexNormals();
    add(c, geo, "Trophozoite with pseudopodia", "Motile trophozoite (15-30 um) with finger-like pseudopodia; invades the colonic mucosa (flask-shaped ulcers).", "#c77dff", 0.55);
    add(c, sphere(0.2), "Nucleus (central karyosome)", "Single nucleus with a small central karyosome and evenly distributed peripheral chromatin.", "#3c096c", 1, V(-0.3, 0.1, 0));
    for (let i = 0; i < 4; i++) add(c, new THREE.TorusGeometry(0.1, 0.06, 12, 24), "Ingested red blood cells", "Erythrophagocytosis is diagnostic of pathogenic E. histolytica (vs non-pathogenic E. dispar).", "#e5383b", 1, V(0.2 + R() * 0.4, (R() - 0.5) * 0.6, (R() - 0.5) * 0.3));
    add(c, sphere(0.38), "Quadrinucleate cyst", "Infective cyst with up to 4 nuclei and chromatoid bodies; ingested with contaminated water.", "#e0aaff", 0.6, V(1.6, 0.6, 0));
    for (let i = 0; i < 4; i++) add(c, sphere(0.07, 10), "Quadrinucleate cyst", "", "#3c096c", 1, V(1.6 + (i % 2 ? 0.12 : -0.12), 0.6 + (i < 2 ? 0.12 : -0.12), 0.1));
    return "Amoeboid trophozoite with ingested RBCs, and a quadrinucleate cyst.";
  },
  trypo(c: Ctx) {
    const pts = wavy(V(-1.3, 0, 0), V(1, 0, 0), 2.4, 0.4, 0.5);
    add(c, tube(pts, 0.11, 80), "Trypomastigote body", "C- or U-shaped extracellular blood form (about 20 um) seen on blood smear in acute Chagas disease.", "#4cc9f0");
    add(c, sphere(0.1), "Nucleus", "Central nucleus.", "#3a0ca3", 1, pts[20]);
    add(c, sphere(0.09), "Kinetoplast", "Large subterminal kinetoplast (mitochondrial DNA) - prominent in T. cruzi.", "#f72585", 1, pts[5]);
    const fl = pts.slice(5).map((p, i) => p.clone().add(V(0, 0.16 + 0.04 * Math.sin(i), 0.04 * Math.cos(i * 1.3))));
    fl.push(fl[fl.length - 1].clone().add(V(0.5, 0.1, 0)));
    add(c, tube(fl, 0.018, 120), "Flagellum and undulating membrane", "Flagellum runs along an undulating membrane and exits anteriorly as a free flagellum.", FLAG);
    add(c, sphere(0.9), "Amastigotes in myocyte (pseudocyst)", "Intracellular amastigotes multiply in cardiac muscle, enteric ganglia and smooth muscle (dilated cardiomyopathy, megaesophagus, megacolon).", "#ffadad", 0.25, V(1.2, -1.1, 0));
    const R = rng(18); for (let i = 0; i < 20; i++) add(c, sphere(0.06, 10), "Amastigotes in myocyte (pseudocyst)", "", "#7209b7", 1, V(1.2, -1.1, 0).add(V(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(1.1)));
    return "Trypomastigote (blood form) with kinetoplast and undulating membrane, plus a myocyte pseudocyst of amastigotes.";
  },
  leish(c: Ctx) {
    add(c, sphere(1.1), "Macrophage", "Host macrophage of the reticuloendothelial system (spleen, liver, bone marrow in visceral leishmaniasis).", "#ffcad4", 0.3);
    add(c, sphere(0.38), "Macrophage nucleus", "", "#9d4edd", 1, V(-0.5, 0.3, 0));
    const R = rng(19);
    for (let i = 0; i < 18; i++) { const p = V(R() - 0.3, R() - 0.5, R() - 0.5).multiplyScalar(1.2); add(c, sphere(0.1, 14), "Amastigotes (Leishman-Donovan bodies)", "Oval 2-4 um amastigotes, each with a nucleus and rod-shaped kinetoplast.", "#7209b7", 1, p, undefined, V(1, 0.75, 0.75)); add(c, capsule(0.015, 0.05), "Kinetoplast", "Rod-shaped kinetoplast next to the nucleus.", "#f72585", 1, p.clone().add(V(0.06, 0.04, 0.06))); }
    return "Macrophage packed with amastigotes (Leishman-Donovan bodies).";
  },
  schisto(c: Ctx) {
    const pts = wavy(V(-1.6, 0, 0), V(1, 0, 0), 3.2, 0.25, 0.7);
    add(c, tube(pts, 0.16, 120), "Male worm", "Shorter, thicker male (about 1 cm) folds into a gynecophoral canal that holds the female; pairs live in mesenteric or vesical venules.", "#ffb703");
    const fp = pts.map((p) => p.clone().add(V(0, 0.08, 0.1))); fp[0].add(V(-0.3, 0, 0)); fp[fp.length - 1].add(V(0.3, 0, 0));
    add(c, tube(fp, 0.06, 120), "Female worm", "Longer slender female lays eggs that cause granulomatous inflammation and fibrosis.", "#fb8500");
    add(c, sphere(0.08, 14), "Oral and ventral suckers", "Anterior suckers attach to the vein wall.", "#8ecae6", 1, pts[1]);
    add(c, sphere(0.08, 14), "Oral and ventral suckers", "", "#8ecae6", 1, pts[4]);
    const egg = (p: THREE.Vector3, spine: "lateral" | "terminal", name: string, desc: string) => { add(c, sphere(0.2), name, desc, "#d4a373", 1, p, undefined, V(1.5, 1, 1)); const s = add(c, new THREE.ConeGeometry(0.05, 0.18, 10), name, desc, "#bc6c25", 1, spine === "lateral" ? p.clone().add(V(0.05, 0.24, 0)) : p.clone().add(V(0.36, 0, 0))); if (spine === "terminal") s.rotation.set(0, 0, -Math.PI / 2); };
    egg(V(-0.7, -0.9, 0), "lateral", "Egg with lateral spine (S. mansoni)", "S. mansoni egg (lateral spine) in stool; periportal 'pipe-stem' fibrosis, portal hypertension.");
    egg(V(0.7, -0.9, 0), "terminal", "Egg with terminal spine (S. haematobium)", "S. haematobium egg (terminal spine) in urine; hematuria, bladder squamous cell carcinoma.");
    return "Adult male and female schistosomes in copula, with diagnostic eggs.";
  },
};

type Builder = (c: Ctx) => string;
const BUILD: Record<string, Builder> = {
  "staphylococcus-aureus": (c) => B.cluster(c, { color: "#7b2cbf", part: "Coccus", desc: "Gram-positive coccus about 1 um; catalase-positive and coagulase-positive (vs CoNS). Golden colonies; beta-hemolytic." }),
  "streptococcus-pyogenes": (c) => B.chain(c, { color: "#5a189a", part: "Coccus", desc: "Gram-positive coccus; catalase-negative, beta-hemolytic, bacitracin-sensitive (group A, Lancefield).", capsuleDesc: "Hyaluronic acid capsule is non-immunogenic (identical to host tissue) and antiphagocytic; M protein is the main virulence factor." }),
  "streptococcus-pneumoniae": (c) => B.lancet(c, { color: "#5a189a" }),
  "neisseria-meningitidis": (c) => B.kidney(c, { color: "#e5383b", desc: "Gram-negative diplococcus; oxidase-positive, ferments maltose and glucose; LOS endotoxin.", capsule: "Polysaccharide capsule (serogroups A, B, C, W, Y) - main virulence factor and vaccine target." }),
  "neisseria-gonorrhoeae": (c) => B.kidney(c, { color: "#e5383b", desc: "Gram-negative diplococcus often seen inside neutrophils; oxidase-positive, ferments glucose only; no capsule; pili undergo antigenic variation." }),
  "mycobacterium-tuberculosis": (c) => { B.rods(c, { color: "#e63946", part: "Acid-fast bacillus", desc: "Slender rod 2-4 um with a mycolic-acid-rich waxy wall: acid-fast (red on Ziehl-Neelsen). Cord factor makes cells align in serpentine cords.", flag: "none", n: 6, r: 0.07, len: 0.6 }); return "Slender acid-fast rods (no flagella, no spores); schematic, colours illustrative."; },
  "escherichia-coli": (c) => { B.rods(c, { color: "#e76f51", part: "Gram-negative rod", desc: "Gram-negative rod, lactose fermenter (pink on MacConkey), indole-positive; K1 capsule in neonatal meningitis.", flag: "peri", n: 3, r: 0.17, len: 0.55 }); return "Gram-negative rods with peritrichous flagella."; },
  "vibrio-cholerae": (c) => B.comma(c, { color: "#e76f51" }),
  "clostridioides-difficile": (c) => { B.rods(c, { color: "#7b2cbf", part: "Gram-positive rod", desc: "Large Gram-positive anaerobic rod; toxins A (enterotoxin) and B (cytotoxin) cause pseudomembranous colitis.", flag: "peri", n: 3, r: 0.14, len: 0.75, spore: "subterminal" }); return "Spore-forming Gram-positive anaerobic rods with subterminal spores and peritrichous flagella."; },
  "clostridium-tetani": (c) => { B.rods(c, { color: "#7b2cbf", part: "Gram-positive rod", desc: "Slender Gram-positive obligate anaerobe; tetanospasmin blocks GABA and glycine release from Renshaw cells.", flag: "peri", n: 4, r: 0.08, len: 0.9, spore: "terminal" }); return "Drumstick (tennis-racket) appearance: slender rods with a round terminal spore."; },
  "clostridium-botulinum": (c) => { B.rods(c, { color: "#7b2cbf", part: "Gram-positive rod", desc: "Gram-positive anaerobic rod; botulinum toxin cleaves SNARE proteins and blocks acetylcholine release.", flag: "peri", n: 3, r: 0.14, len: 0.8, spore: "subterminal" }); return "Spore-forming Gram-positive anaerobic rods with oval subterminal spores."; },
  "corynebacterium-diphtheriae": (c) => { B.rods(c, { color: "#7b2cbf", part: "Club-shaped rod", desc: "Gram-positive, club-shaped rods in V and L 'Chinese letter' arrangements; toxin encoded by a beta-prophage (lysogenic conversion).", flag: "none", n: 5, r: 0.09, len: 0.55, club: true }); return "Club-shaped Gram-positive rods with metachromatic granules."; },
  "bacillus-anthracis": (c) => { B.rods(c, { color: "#7b2cbf", part: "Gram-positive rod", desc: "Large Gram-positive aerobic rod, non-motile; medusa-head colonies; lethal and edema toxins.", flag: "none", n: 5, r: 0.15, len: 0.6, spore: "central", chain: true, capsule: "Unique poly-D-glutamate (protein) capsule - antiphagocytic; the only bacterium with a polypeptide capsule." }); return "Boxcar-shaped Gram-positive rods in chains with central spores and a polypeptide capsule."; },
  "pseudomonas-aeruginosa": (c) => { B.rods(c, { color: "#e76f51", part: "Gram-negative rod", desc: "Aerobic Gram-negative rod, oxidase-positive, non-lactose fermenter; blue-green pyocyanin, grape-like odor; alginate biofilm in cystic fibrosis.", flag: "polar", n: 3, r: 0.13, len: 0.6 }); return "Gram-negative rods with a single polar flagellum."; },
  "helicobacter-pylori": (c) => { B.helical(c, { color: "#e76f51", part: "Curved/spiral rod", desc: "Microaerophilic, curved Gram-negative rod; urease-positive (urea breath test), oxidase- and catalase-positive.", turns: 1.4, r: 0.1, len: 1.2, tuft: true }); return "Spiral Gram-negative rods with a tuft of polar (lophotrichous) flagella."; },
  "treponema-pallidum": (c) => { B.helical(c, { color: "#06d6a0", part: "Spirochete", desc: "Thin, tightly coiled spirochete (6-15 um x 0.15 um) with endoflagella in the periplasm; too thin for Gram stain - seen by dark-field microscopy.", turns: 8, r: 0.035, len: 2.2, n: 3 }); return "Tightly coiled spirochetes with periplasmic endoflagella (dark-field appearance)."; },
  "chlamydia-trachomatis": (c) => B.elementary(c),
  "listeria-monocytogenes": (c) => { B.rods(c, { color: "#7b2cbf", part: "Gram-positive rod", desc: "Short Gram-positive rod, facultative intracellular; grows at 4 C (cold enrichment); actin-rocket motility in cells and tumbling motility at 25 C.", flag: "peri", n: 4, r: 0.12, len: 0.35 }); return "Short Gram-positive rods (tumbling motility via flagella at room temperature)."; },
  "salmonella-typhi": (c) => { B.rods(c, { color: "#e76f51", part: "Gram-negative rod", desc: "Gram-negative rod, non-lactose fermenter, H2S-positive; Vi capsule; facultative intracellular in macrophages.", flag: "peri", n: 3, r: 0.15, len: 0.55, capsule: "Vi (virulence) capsular antigen - antiphagocytic; basis of the Vi polysaccharide vaccine." }); return "Encapsulated Gram-negative rods with peritrichous flagella."; },
  vzv: (c) => Vz.herpes(c), ebv: (c) => Vz.herpes(c), cmv: (c) => Vz.herpes(c),
  "hepatitis-c": (c) => Vz.enveloped(c, { spikeName: "E1/E2 envelope glycoproteins", spikeDesc: "E1/E2 heterodimers bind CD81, SR-B1 and claudin-1 on hepatocytes; hypervariable regions in E2 drive immune escape.", core: "Icosahedral core", coreDesc: "Core protein capsid (pleomorphic, about 50 nm virion).", genome: "(+)ssRNA genome", genomeDesc: "Linear positive-sense ssRNA about 9.6 kb with an IRES; single polyprotein cleaved by NS3/4A protease (target of '-previr' drugs).", caption: "Enveloped (+)ssRNA virion (Flaviviridae, Hepacivirus). Schematic, not to scale." }),
  rsv: (c) => Vz.enveloped(c, { spikeName: "F and G glycoproteins", spikeDesc: "F (fusion) protein causes syncytia - target of nirsevimab, palivizumab and RSV vaccines; G attaches to cells.", core: "helical nucleocapsid", coreDesc: "Helical nucleocapsid of N protein around the genome.", genome: "(-)ssRNA genome", genomeDesc: "Non-segmented negative-sense ssRNA (about 15 kb).", caption: "Pleomorphic enveloped (-)ssRNA virion (Pneumoviridae). Schematic, not to scale.", pleo: true }),
  rabies: (c) => Vz.bullet(c),
  dengue: (c) => Vz.enveloped(c, { spikeName: "E (envelope) protein", spikeDesc: "E glycoprotein dimers lie flat on the mature virion (smooth surface); mediates fusion. Non-neutralizing antibodies from a prior serotype enhance entry into Fc-receptor cells (antibody-dependent enhancement).", core: "Capsid (C protein) core", coreDesc: "Nucleocapsid of C protein around the genome (virion about 50 nm).", genome: "(+)ssRNA genome", genomeDesc: "Positive-sense ssRNA about 11 kb encoding one polyprotein (3 structural + 7 non-structural proteins incl. NS1, the antigen used in rapid tests).", caption: "Enveloped (+)ssRNA flavivirus with E protein on the surface. Schematic, not to scale.", color: "#90e0ef" }),
  "bacteriophage-t4": (c) => {
    const head = add(c, new THREE.IcosahedronGeometry(0.5, 0), "Prolate icosahedral head", "Elongated icosahedral capsid packed with about 169 kb linear dsDNA.", "#2a9d8f", 1, V(0, 1.05, 0)); head.scale.set(1, 1.45, 1);
    add(c, new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), "Collar", "Neck/collar joining head and tail.", "#e9c46a", 1, V(0, 0.38, 0));
    add(c, new THREE.CylinderGeometry(0.13, 0.13, 1.0, 24), "Contractile tail sheath", "Sheath contracts to drive the inner tail tube through the cell envelope and inject DNA.", "#e76f51", 1, V(0, -0.2, 0));
    add(c, new THREE.CylinderGeometry(0.34, 0.34, 0.08, 6), "Baseplate", "Hexagonal baseplate that triggers sheath contraction after attachment.", "#f4a261", 1, V(0, -0.74, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const p1 = V(Math.cos(a) * 0.32, -0.74, Math.sin(a) * 0.32); const p2 = V(Math.cos(a) * 0.8, -0.5, Math.sin(a) * 0.8); const p3 = V(Math.cos(a) * 0.95, -1.25, Math.sin(a) * 0.95); add(c, tube([p1, p2, p3], 0.022, 24), "Tail fibers", "Six long tail fibers recognise receptors (LPS, OmpC) on E. coli; model organism for transduction and the lytic cycle.", "#264653"); }
    return "Bacteriophage T4: head, collar, contractile tail, baseplate and tail fibers. Schematic.";
  },
  adenovirus: (c) => Vz.adeno(c),
  "candida-albicans": (c) => F.candida(c),
  "aspergillus-fumigatus": (c) => F.aspergillus(c),
  "cryptococcus-neoformans": (c) => F.crypto(c),
  "pneumocystis-jirovecii": (c) => F.pneumocystis(c),
  "histoplasma-capsulatum": (c) => F.histo(c),
  "plasmodium-falciparum": (c) => F.plasmodium(c),
  "toxoplasma-gondii": (c) => F.toxo(c),
  "giardia-lamblia": (c) => F.giardia(c),
  "entamoeba-histolytica": (c) => F.entamoeba(c),
  "trypanosoma-cruzi": (c) => F.trypo(c),
  "leishmania-donovani": (c) => F.leish(c),
  schistosoma: (c) => F.schisto(c),
};

export const hasMorph = (id: string) => id in BUILD;

export function buildMorph(id: string): MorphModel | null {
  const b = BUILD[id]; if (!b) return null;
  const c = ctx(); const caption = b(c);
  // centre and normalise to about 3 units across
  const box = new THREE.Box3().setFromObject(c.g); const ctr = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3()).length();
  c.g.children.forEach((ch) => ch.position.sub(ctr));
  c.g.scale.setScalar(3 / Math.max(0.01, sz));
  return { group: c.g, parts: Array.from(c.parts.values()).filter((p) => p.desc), caption };
}
