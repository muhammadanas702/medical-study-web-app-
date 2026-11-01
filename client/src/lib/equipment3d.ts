// Schematic 3D models of clinical devices and laboratory equipment, built procedurally with three.js.
// Each part is clickable and carries an exam-relevant explanation. Proportions are simplified; colors follow
// real conventions where they carry meaning (cannula gauge colors, blood tube caps).
import * as THREE from "three";

export type EqPart = { name: string; desc: string; color: string };
export type EqItem = {
  id: string; name: string; category: "Clinical" | "Airway" | "Laboratory"; summary: string;
  facts: string[]; build: (c: Ctx) => void; mesh?: string;
};
type Ctx = { g: THREE.Group; parts: Map<string, EqPart> };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function mat(color: string, opacity = 1, metal = 0.05, rough = 0.45) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });
}
const STEEL = "#c0c7cf", BLACK = "#2b2d31", CLEAR = "#dbeafe";
function put(c: Ctx, geo: THREE.BufferGeometry, part: string, desc: string, color: string, o: { at?: THREE.Vector3; rot?: [number, number, number]; scale?: [number, number, number]; opacity?: number; metal?: number } = {}) {
  const m = new THREE.Mesh(geo, mat(color, o.opacity ?? 1, o.metal ?? (color === STEEL ? 0.8 : 0.05), color === STEEL ? 0.3 : 0.45));
  m.name = part;
  if (o.at) m.position.copy(o.at);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale) m.scale.set(...o.scale);
  c.g.add(m);
  if (desc && !c.parts.has(part)) c.parts.set(part, { name: part, desc, color });
  return m;
}
const cyl = (r1: number, r2: number, h: number, seg = 32, open = false) => new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
const sph = (r: number) => new THREE.SphereGeometry(r, 32, 24);
const tube = (pts: THREE.Vector3[], r: number, seg = 80) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 12, false);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const torus = (R: number, r: number, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, 16, 48, arc);
const H = Math.PI / 2;

export const EQUIPMENT: EqItem[] = [
  {
    id: "stethoscope", name: "Stethoscope", category: "Clinical", mesh: "Stethoscopes",
    summary: "Acoustic stethoscope with a dual-head chest piece (diaphragm and bell).",
    facts: [
      "Diaphragm, pressed firmly: high-pitched sounds - S1, S2, aortic and mitral regurgitation, pericardial rub, breath sounds.",
      "Bell, held lightly: low-pitched sounds - S3, S4 and the diastolic rumble of mitral stenosis (pressing hard turns it into a diaphragm).",
      "Earpieces point forward (toward the nose) to follow the ear canals.",
      "Mitral stenosis rumble is best heard with the bell at the apex, patient in left lateral decubitus.",
    ],
    build(c) {
      put(c, cyl(0.42, 0.42, 0.12), "Diaphragm", "Flat membrane side of the chest piece; filters out low frequencies and transmits high-pitched sounds. Press firmly.", "#e2e8f0", { at: V(0, -1.5, 0), rot: [H, 0, 0] });
      put(c, torus(0.42, 0.04), "Diaphragm", "", STEEL, { at: V(0, -1.5, 0.06) });
      put(c, cyl(0.24, 0.3, 0.2), "Bell", "Hollow cup side; best for low-pitched sounds (S3, S4, mitral stenosis). Rest it lightly on the skin.", STEEL, { at: V(0, -1.5, -0.17), rot: [H, 0, 0] });
      put(c, cyl(0.07, 0.07, 0.45), "Stem", "Rotating stem that opens either the bell or the diaphragm side (indexed valve).", STEEL, { at: V(0, -1.12, 0) });
      put(c, tube([V(0, -0.9, 0), V(0.1, -0.3, 0.1), V(-0.1, 0.3, 0), V(0, 0.7, 0)], 0.07), "Tubing", "Thick-walled tubing that conducts sound; shorter tubing transmits sound with less loss.", "#1e3a8a");
      put(c, tube([V(0, 0.7, 0), V(-0.4, 1.0, 0), V(-0.55, 1.6, 0), V(-0.45, 2.1, 0.25)], 0.04), "Binaurals (headset)", "Metal ear tubes joined by a tension spring.", STEEL);
      put(c, tube([V(0, 0.7, 0), V(0.4, 1.0, 0), V(0.55, 1.6, 0), V(0.45, 2.1, 0.25)], 0.04), "Binaurals (headset)", "", STEEL);
      put(c, sph(0.1), "Ear tips", "Soft ear tips; angled forward so sound enters along the ear canal.", BLACK, { at: V(-0.45, 2.12, 0.3) });
      put(c, sph(0.1), "Ear tips", "", BLACK, { at: V(0.45, 2.12, 0.3) });
    },
  },
  {
    id: "syringe", name: "Syringe and hypodermic needle", category: "Clinical", mesh: "Syringes",
    summary: "Luer-lock syringe with a hypodermic needle.",
    facts: [
      "Needle gauge is inverse to diameter: 18G is wider than 25G.",
      "Typical choices: intramuscular 21-23G, subcutaneous 25-27G, intradermal (PPD/Mantoux) 26-27G with the bevel up at 5-15 degrees.",
      "Never recap a used needle; dispose of it directly in a sharps container (needlestick: HBV risk about 30%, HCV about 1.8%, HIV about 0.3%).",
      "Read the volume at the edge of the rubber stopper nearest the tip.",
    ],
    build(c) {
      put(c, cyl(0.28, 0.28, 2.2, 40, true), "Barrel", "Transparent barrel with printed graduations (mL); read the dose at the leading edge of the stopper.", CLEAR, { opacity: 0.35 });
      for (let i = 0; i < 9; i++) put(c, box(0.02, 0.012, 0.16), "Graduations", "Volume markings printed on the barrel.", BLACK, { at: V(0, -0.8 + i * 0.2, 0.27) });
      put(c, cyl(0.3, 0.3, 0.06), "Finger flange", "Flange for the index and middle fingers.", CLEAR, { at: V(0, 1.1, 0), scale: [2, 1, 1.1], opacity: 0.6 });
      put(c, cyl(0.26, 0.26, 0.16), "Rubber stopper (plunger seal)", "Seals the barrel; its leading edge marks the measured volume.", BLACK, { at: V(0, -0.2, 0) });
      put(c, box(0.06, 2.0, 0.3), "Plunger", "Plunger rod: pull to aspirate (check for blood before IM injection when indicated), push to inject.", "#f1f5f9", { at: V(0, 0.8, 0) });
      put(c, box(0.06, 2.0, 0.3), "Plunger", "", "#f1f5f9", { at: V(0, 0.8, 0), rot: [0, H, 0] });
      put(c, cyl(0.32, 0.32, 0.05), "Thumb press", "Thumb rest at the end of the plunger.", "#f1f5f9", { at: V(0, 1.82, 0) });
      put(c, cyl(0.12, 0.08, 0.3), "Luer-lock tip", "Threaded tip that locks the needle hub (Luer-slip tips push on instead).", CLEAR, { at: V(0, -1.25, 0), opacity: 0.8 });
      put(c, cyl(0.12, 0.1, 0.3), "Needle hub", "Color-coded plastic hub (ISO 6009); e.g. green 21G, blue 23G, orange 25G.", "#16a34a", { at: V(0, -1.55, 0) });
      put(c, cyl(0.02, 0.02, 1.3, 12), "Needle shaft (cannula)", "Stainless steel shaft; gauge = outer diameter (higher gauge = thinner), length in mm or inches.", STEEL, { at: V(0, -2.35, 0) });
      put(c, new THREE.ConeGeometry(0.02, 0.12, 12), "Bevel", "Slanted cutting tip; inserted bevel up for venipuncture and intradermal injection.", STEEL, { at: V(0, -3.06, 0), rot: [Math.PI, 0, 0.3] });
    },
  },
  {
    id: "iv-cannula", name: "Peripheral IV cannula", category: "Clinical", mesh: "Catheterization, Peripheral",
    summary: "Over-the-needle peripheral intravenous catheter; hub color identifies the gauge.",
    facts: [
      "Gauge colors (ISO 10555-5): 14G orange, 16G grey, 18G green, 20G pink, 22G blue, 24G yellow, 26G violet.",
      "Flow follows Poiseuille's law (proportional to radius to the fourth power, inversely to length): short wide cannulas are fastest for resuscitation - use two large-bore (14-16G or at least 18G) lines in trauma.",
      "Approximate gravity flow (varies by brand): 14G about 240-300 mL/min, 16G about 150-200, 18G about 90-100, 20G about 60, 22G about 35 mL/min.",
      "18G is typically needed for rapid blood transfusion or CT contrast; 22-24G for children and fragile veins.",
    ],
    build(c) {
      put(c, cyl(0.05, 0.04, 1.6, 20), "Catheter (cannula)", "Flexible plastic (PTFE/polyurethane) tube that stays in the vein after the needle is withdrawn.", "#f8fafc", { at: V(0, -1.2, 0), opacity: 0.8 });
      put(c, cyl(0.025, 0.025, 1.9, 12), "Introducer needle", "Steel needle that pierces the vein; withdrawn once the catheter is advanced. Never re-insert it into the catheter (risk of shearing a catheter embolus).", STEEL, { at: V(0, -1.15, 0) });
      put(c, cyl(0.16, 0.12, 0.5), "Color-coded hub", "Hub color shows the gauge (green here = 18G).", "#16a34a", { at: V(0, -0.15, 0) });
      put(c, box(0.9, 0.04, 0.35), "Wings", "Flexible wings for gripping and securing the cannula with dressing.", "#16a34a", { at: V(0, -0.1, 0) });
      put(c, cyl(0.07, 0.07, 0.25), "Injection port", "Valved top port for bolus injections; cap closed when not in use.", "#16a34a", { at: V(0, 0.05, 0.22), rot: [H, 0, 0] });
      put(c, cyl(0.12, 0.12, 0.55), "Flashback chamber", "Transparent chamber that fills with blood when the needle tip enters the vein - confirms placement.", "#fecaca", { at: V(0, 0.4, 0), opacity: 0.7 });
      put(c, cyl(0.1, 0.1, 0.35), "Vented plug", "Filter cap at the end of the flashback chamber that lets air out but not blood.", "#94a3b8", { at: V(0, 0.83, 0) });
    },
  },
  {
    id: "foley", name: "Foley urinary catheter", category: "Clinical", mesh: "Urinary Catheters",
    summary: "Two-way indwelling urethral catheter held in the bladder by an inflatable balloon.",
    facts: [
      "Size in French (Fr) = outer diameter in mm x 3; adults usually 12-16 Fr.",
      "Inflate the balloon only after urine flows, using sterile water (commonly 10 mL) - inflating in the urethra causes trauma.",
      "Catheter-associated UTI is a leading hospital-acquired infection: remove catheters as soon as they are no longer needed.",
      "Contraindicated when urethral injury is suspected (blood at the meatus, high-riding prostate) until a retrograde urethrogram is done.",
    ],
    build(c) {
      put(c, tube([V(0, 1.6, 0), V(0, 0.6, 0), V(0.2, -0.5, 0), V(0.6, -1.5, 0)], 0.07), "Catheter shaft", "Latex or silicone shaft with two lumens (drainage and balloon inflation).", "#fde68a");
      put(c, new THREE.CapsuleGeometry(0.07, 0.15, 8, 16), "Rounded tip", "Closed rounded tip that passes up the urethra into the bladder.", "#fde68a", { at: V(0, 1.75, 0) });
      put(c, sph(0.25), "Retention balloon", "Inflated with sterile water inside the bladder to stop the catheter slipping out.", "#fcd34d", { at: V(0, 1.35, 0), scale: [1, 0.8, 1], opacity: 0.75 });
      put(c, sph(0.04), "Drainage eyes", "Side holes above the balloon through which urine enters.", BLACK, { at: V(0.06, 1.65, 0.03) });
      put(c, sph(0.04), "Drainage eyes", "", BLACK, { at: V(-0.06, 1.6, -0.03) });
      put(c, tube([V(0.6, -1.5, 0), V(0.8, -2.0, 0), V(0.85, -2.6, 0)], 0.11), "Drainage funnel", "Connects to the closed drainage bag (keep the bag below bladder level).", "#fde68a");
      put(c, tube([V(0.6, -1.5, 0), V(0.25, -1.9, 0), V(0.15, -2.4, 0)], 0.05), "Balloon inflation port", "Valved side arm used to inflate/deflate the balloon with a syringe.", "#fb7185");
      put(c, cyl(0.08, 0.08, 0.18), "Balloon inflation port", "", "#fb7185", { at: V(0.15, -2.45, 0) });
    },
  },
  {
    id: "sphygmomanometer", name: "Sphygmomanometer (aneroid)", category: "Clinical", mesh: "Sphygmomanometers",
    summary: "Cuff, inflation bulb, valve and gauge for auscultatory blood pressure measurement.",
    facts: [
      "Bladder length should be about 80% and width about 40% of the arm circumference; a cuff that is too small overestimates BP.",
      "Inflate about 20-30 mmHg above the point where the radial pulse disappears, then deflate at 2-3 mmHg per second.",
      "Systolic = Korotkoff phase I (first tapping sounds); diastolic = phase V (disappearance of sounds).",
      "Arm should be supported at heart level, patient seated with back supported and feet flat after 5 minutes of rest.",
    ],
    build(c) {
      put(c, cyl(0.62, 0.62, 1.3, 40, true), "Cuff with bladder", "Fabric cuff with an inflatable bladder centred over the brachial artery (artery marker).", "#1e40af", { opacity: 0.95 });
      put(c, box(0.08, 0.5, 0.02), "Artery marker", "Align this marker with the brachial artery, 2-3 cm above the antecubital fossa.", "#f8fafc", { at: V(0, -0.2, 0.63) });
      put(c, tube([V(0.3, -0.6, 0.5), V(0.6, -1.2, 0.8), V(1.0, -1.7, 0.9)], 0.04), "Rubber tubing", "Connects bladder, bulb and gauge.", BLACK);
      put(c, sph(0.32), "Inflation bulb", "Squeeze to inflate the bladder.", BLACK, { at: V(1.15, -2.05, 0.95), scale: [1, 1.35, 1] });
      put(c, cyl(0.07, 0.07, 0.22), "Release valve", "Screw valve controlling deflation (aim for 2-3 mmHg per second).", STEEL, { at: V(1.1, -1.65, 0.93) });
      put(c, tube([V(-0.3, 0.5, 0.5), V(-0.6, 0.9, 0.8), V(-0.8, 1.3, 0.9)], 0.04), "Rubber tubing", "", BLACK);
      put(c, cyl(0.42, 0.42, 0.14), "Aneroid gauge", "Dial manometer in mmHg; check it reads zero and calibrate periodically against a reference.", "#f8fafc", { at: V(-0.85, 1.6, 0.9), rot: [H, 0, 0] });
      put(c, torus(0.42, 0.04), "Aneroid gauge", "", STEEL, { at: V(-0.85, 1.6, 0.98) });
      put(c, box(0.02, 0.33, 0.01), "Aneroid gauge", "", "#dc2626", { at: V(-0.85, 1.7, 0.99), rot: [0, 0, -0.7] });
    },
  },
  {
    id: "pulse-oximeter", name: "Pulse oximeter", category: "Clinical", mesh: "Oximetry",
    summary: "Finger-clip sensor that estimates arterial oxygen saturation (SpO2) from light absorption.",
    facts: [
      "Two wavelengths: red (about 660 nm, absorbed more by deoxyhemoglobin) and infrared (about 940 nm, absorbed more by oxyhemoglobin); only the pulsatile (arterial) signal is analysed.",
      "Carbon monoxide poisoning: SpO2 reads falsely normal because carboxyhemoglobin looks like oxyhemoglobin - use co-oximetry.",
      "Methemoglobinemia: SpO2 tends toward about 85% regardless of true saturation.",
      "Poor perfusion, motion, nail polish and darker skin pigmentation can reduce accuracy (overestimation of saturation in darker skin).",
    ],
    build(c) {
      put(c, box(1.4, 0.35, 0.8), "Upper housing with display", "Top half houses the display (SpO2 and pulse rate) and the light-emitting diodes.", "#0ea5e9", { at: V(0, 0.38, 0) });
      put(c, box(0.9, 0.02, 0.5), "Display", "Shows SpO2 (%) and pulse rate; a good plethysmographic waveform indicates a reliable reading.", "#0f172a", { at: V(0, 0.56, 0) });
      put(c, box(1.4, 0.3, 0.8), "Lower housing (photodetector)", "Bottom half holds the photodiode that measures transmitted light.", "#e2e8f0", { at: V(0, -0.38, 0) });
      put(c, cyl(0.06, 0.06, 0.05), "Red and infrared LEDs", "Emit red (about 660 nm) and infrared (about 940 nm) light through the fingertip.", "#ef4444", { at: V(0.1, 0.19, 0) });
      put(c, cyl(0.06, 0.06, 0.05), "Photodetector", "Measures light that passes through; the ratio of pulsatile red/infrared absorption gives SpO2.", BLACK, { at: V(0.1, -0.21, 0) });
      put(c, new THREE.CapsuleGeometry(0.2, 0.9, 8, 20), "Fingertip", "Place the nail bed facing the LEDs; remove dark nail polish.", "#f4c7a1", { at: V(-0.25, 0, 0), rot: [0, 0, H] });
      put(c, cyl(0.06, 0.06, 0.7), "Spring hinge", "Spring keeps the sensor gently clamped; too much pressure blanches the finger.", STEEL, { at: V(0.72, 0, 0), rot: [H, 0, 0] });
    },
  },
  {
    id: "otoscope", name: "Otoscope", category: "Clinical", mesh: "Otoscopes",
    summary: "Illuminated, magnifying instrument for examining the external ear canal and tympanic membrane.",
    facts: [
      "In adults pull the pinna up and back; in children pull it down and back to straighten the canal.",
      "Normal tympanic membrane: pearly grey, translucent, with a cone of light at 5 o'clock (right ear) / 7 o'clock (left ear).",
      "Acute otitis media: bulging, erythematous, immobile tympanic membrane on pneumatic otoscopy.",
      "Pneumatic otoscopy (insufflation bulb) tests membrane mobility - reduced in middle-ear effusion.",
    ],
    build(c) {
      put(c, cyl(0.22, 0.22, 2.0), "Handle (battery)", "Contains the batteries; the rheostat ring adjusts brightness.", BLACK, { at: V(0, -1.2, 0) });
      put(c, cyl(0.24, 0.24, 0.12), "Rheostat ring", "Turn to switch on and set light intensity.", STEEL, { at: V(0, -0.15, 0) });
      put(c, cyl(0.35, 0.35, 0.6), "Head with light", "Contains the bulb/LED and fibre-optic ring that lights the canal.", "#334155", { at: V(0, 0.25, 0), rot: [H, 0, 0] });
      put(c, cyl(0.3, 0.3, 0.05), "Magnifying lens", "Swivel lens (about 3x) for viewing; swing it aside to pass instruments.", CLEAR, { at: V(0, 0.25, 0.32), rot: [H, 0, 0], opacity: 0.5 });
      put(c, cyl(0.12, 0.05, 0.7), "Disposable speculum", "Use the largest speculum that fits comfortably; single-use to avoid cross-infection.", "#f8fafc", { at: V(0, 0.25, -0.62), rot: [H, 0, 0] });
      put(c, cyl(0.04, 0.04, 0.3), "Insufflation port", "Attach a rubber bulb for pneumatic otoscopy (tympanic membrane mobility).", STEEL, { at: V(0.33, 0.3, 0), rot: [0, 0, H] });
    },
  },
  {
    id: "tuning-fork", name: "Tuning fork and reflex hammer", category: "Clinical", mesh: "Hearing Tests",
    summary: "512 Hz tuning fork for Rinne and Weber tests and a Taylor reflex hammer.",
    facts: [
      "Use a 512 Hz fork for hearing tests and a 128 Hz fork for vibration sense.",
      "Rinne: air conduction louder than bone conduction is normal (positive) and also seen in sensorineural loss; bone louder than air = conductive loss in that ear.",
      "Weber (fork on the vertex): lateralises to the affected ear in conductive loss and to the normal ear in sensorineural loss.",
      "Reflex roots: biceps C5-C6, brachioradialis C6, triceps C7, patellar L3-L4, Achilles S1.",
    ],
    build(c) {
      put(c, box(0.12, 1.5, 0.1), "Tines (prongs)", "Strike on a soft surface (knee or rubber) - never on a hard surface - to avoid overtones.", STEEL, { at: V(-0.15, 0.55, 0) });
      put(c, box(0.12, 1.5, 0.1), "Tines (prongs)", "", STEEL, { at: V(0.15, 0.55, 0) });
      put(c, torus(0.15, 0.06, Math.PI), "Tines (prongs)", "", STEEL, { at: V(0, -0.2, 0), rot: [0, 0, Math.PI] });
      put(c, cyl(0.05, 0.05, 0.8), "Stem", "Hold by the stem only - touching the tines damps vibration.", STEEL, { at: V(0, -0.75, 0) });
      put(c, cyl(0.1, 0.1, 0.08), "Footplate", "Place on the mastoid (Rinne, bone conduction) or vertex/forehead (Weber).", STEEL, { at: V(0, -1.18, 0) });
      put(c, cyl(0.04, 0.03, 2.2), "Hammer handle", "Hold loosely and let the hammer swing like a pendulum.", STEEL, { at: V(1.4, -0.2, 0) });
      put(c, new THREE.ConeGeometry(0.3, 0.2, 3), "Hammer head (Taylor)", "Triangular rubber head: broad edge for large tendons (patellar), point for small ones (biceps over your thumb).", "#ef4444", { at: V(1.4, 1.0, 0), rot: [H, 0, 0], scale: [1, 1, 3] });
    },
  },
  {
    id: "scalpel", name: "Scalpel handles and blades", category: "Clinical", mesh: "Surgical Instruments",
    summary: "Reusable Bard-Parker handles with detachable blades.",
    facts: [
      "No. 3 handle takes small blades (10, 11, 15); No. 4 handle takes large blades (20-24).",
      "No. 10: large curved blade for skin incisions; No. 11: pointed triangular blade for stab incisions (incision and drainage of abscess, arterial cut-down); No. 15: small curved blade for precise short incisions.",
      "Attach and remove blades with a needle holder, never with fingers; use a blade remover where available.",
    ],
    build(c) {
      put(c, box(0.18, 2.2, 0.06), "No. 3 handle", "Flat steel handle with a fitting for small blades (10, 11, 15).", STEEL, { at: V(-0.7, -0.6, 0) });
      const b10 = new THREE.Shape(); b10.moveTo(0, 0); b10.lineTo(0.16, 0); b10.quadraticCurveTo(0.24, 0.6, 0.02, 0.85); b10.lineTo(0, 0.5); b10.lineTo(0, 0);
      put(c, new THREE.ExtrudeGeometry(b10, { depth: 0.02, bevelEnabled: false }), "No. 10 blade", "Large curved cutting edge for skin incisions.", STEEL, { at: V(-0.78, 0.5, -0.01) });
      put(c, box(0.18, 2.4, 0.07), "No. 4 handle", "Larger handle for blades 20-24 (deep or long incisions).", STEEL, { at: V(0.7, -0.6, 0) });
      const b11 = new THREE.Shape(); b11.moveTo(0, 0); b11.lineTo(0.16, 0); b11.lineTo(0.03, 0.9); b11.lineTo(0, 0);
      put(c, new THREE.ExtrudeGeometry(b11, { depth: 0.02, bevelEnabled: false }), "No. 11 blade", "Pointed, straight-edged blade for stab incisions (abscess drainage, arteriotomy).", STEEL, { at: V(0.62, 0.6, -0.01) });
      put(c, box(0.04, 2.2, 0.03), "Grip ridges", "Textured grip; the scalpel is held like a table knife (long incisions) or a pen (fine work).", "#94a3b8", { at: V(-0.7, -0.6, 0.04) });
    },
  },
  {
    id: "chest-tube", name: "Chest tube (tube thoracostomy)", category: "Clinical", mesh: "Chest Tubes",
    summary: "Large-bore pleural drain with side holes, connected to an underwater-seal drainage system.",
    facts: [
      "Insert in the 'triangle of safety': 4th-5th intercostal space, just anterior to the mid-axillary line (lateral border of pectoralis major, anterior border of latissimus dorsi).",
      "Pass over the upper border of the lower rib - the intercostal neurovascular bundle (vein, artery, nerve; VAN) runs in the costal groove below each rib.",
      "The sentinel hole (gap in the radiopaque line) must lie inside the pleural space on chest X-ray.",
      "Tension pneumothorax: immediate needle/finger decompression first (2nd ICS midclavicular or 4th-5th ICS anterior axillary line in adults), then a chest tube.",
    ],
    build(c) {
      put(c, tube([V(0, 2, 0), V(0, 0.5, 0), V(0.3, -0.8, 0), V(0.9, -2, 0)], 0.16, 100), "Drain tube", "Clear PVC/silicone tube (adult trauma commonly 28-32 Fr; small-bore 10-14 Fr for simple pneumothorax or effusion).", CLEAR, { opacity: 0.55 });
      put(c, tube([V(0.12, 2, 0.08), V(0.12, 0.5, 0.08), V(0.42, -0.8, 0.08), V(1.02, -2, 0.08)], 0.025, 100), "Radiopaque stripe", "Line visible on X-ray; it is interrupted at the most proximal (sentinel) drainage hole.", "#0f172a");
      [1.9, 1.6, 1.3, 1.0].forEach((y) => put(c, sph(0.07), "Drainage holes", "Multiple side holes near the tip allow air/fluid to drain if one hole blocks.", "#020617", { at: V(-0.15, y, 0.05) }));
      put(c, sph(0.08), "Sentinel hole", "Most proximal hole; must be inside the pleural cavity or air will leak into the subcutaneous tissue.", "#f59e0b", { at: V(-0.15, 0.7, 0.05) });
      put(c, box(1.4, 1.2, 0.6), "Underwater seal chamber", "Water seal acts as a one-way valve: bubbling = air leak, swinging of fluid with respiration (tidaling) = tube patent.", "#93c5fd", { at: V(1.5, -2.7, 0), opacity: 0.45 });
      put(c, box(1.4, 0.5, 0.6), "Underwater seal chamber", "", "#3b82f6", { at: V(1.5, -3.05, 0), opacity: 0.7 });
    },
  },
  {
    id: "ett", name: "Cuffed endotracheal tube", category: "Airway", mesh: "Intubation, Intratracheal",
    summary: "Adult cuffed endotracheal tube with Murphy eye and pilot balloon.",
    facts: [
      "Typical adult size (internal diameter): about 7.0-7.5 mm in women and 7.5-8.0 mm in men; depth at the incisors about 21 cm (women) and 23 cm (men).",
      "On chest X-ray the tip should sit about 3-5 cm above the carina (roughly at the level of the clavicular heads).",
      "Keep cuff pressure about 20-30 cmH2O: lower risks aspiration, higher compresses tracheal mucosa (ischemia, stenosis).",
      "Confirm placement with continuous waveform capnography (end-tidal CO2), plus bilateral breath sounds and chest rise; right main bronchus intubation is the most common malposition.",
    ],
    build(c) {
      const curve = [V(0, 2.2, 0), V(0, 1.2, 0), V(0.25, 0, 0), V(0.8, -1.2, 0), V(1.6, -1.9, 0)];
      put(c, tube(curve, 0.13, 120), "Tube body", "PVC tube with a Magill curve; internal diameter (mm) printed on the tube.", CLEAR, { opacity: 0.55 });
      put(c, tube(curve.map((p) => p.clone().add(V(0.12, 0, 0.06))), 0.018, 120), "Radiopaque line", "Visible on X-ray to confirm tip position.", "#0f172a");
      put(c, sph(0.27), "Cuff", "High-volume, low-pressure cuff that seals the trachea and reduces aspiration.", "#bfdbfe", { at: V(1.35, -1.75, 0), scale: [1.6, 1, 1], rot: [0, 0, 0.75], opacity: 0.6 });
      put(c, sph(0.05), "Murphy eye", "Side hole near the tip: an alternative path for ventilation if the bevel is blocked.", "#020617", { at: V(1.62, -1.98, 0.11) });
      put(c, new THREE.ConeGeometry(0.13, 0.22, 24, 1, true), "Bevel", "Left-facing bevelled tip, helps passage through the vocal cords.", CLEAR, { at: V(1.75, -2.0, 0), rot: [0, 0, -1.1], opacity: 0.6 });
      put(c, cyl(0.19, 0.17, 0.4), "15 mm connector", "Standard connector to the bag-valve device or ventilator.", "#e2e8f0", { at: V(0, 2.4, 0) });
      put(c, tube([V(0.1, 1.2, 0.1), V(-0.4, 1.4, 0.3), V(-0.6, 1.9, 0.4)], 0.02), "Pilot line", "Thin line through which the cuff is inflated.", CLEAR, { opacity: 0.7 });
      put(c, sph(0.12), "Pilot balloon and valve", "Reflects cuff inflation; measure cuff pressure with a manometer (20-30 cmH2O).", "#bfdbfe", { at: V(-0.6, 2.05, 0.4), scale: [0.8, 1.3, 0.8] });
      for (let i = 0; i < 5; i++) put(c, box(0.27, 0.012, 0.012), "Depth markings", "Centimetre markings from the tip; record the depth at the incisors.", "#0f172a", { at: V(0.02, 1.6 - i * 0.25, 0.13) });
    },
  },
  {
    id: "laryngoscope", name: "Laryngoscope (Macintosh and Miller)", category: "Airway", mesh: "Laryngoscopes",
    summary: "Handle with curved Macintosh blade and straight Miller blade for direct laryngoscopy.",
    facts: [
      "Macintosh (curved) blade: tip goes into the vallecula and lifts the epiglottis indirectly via the hyoepiglottic ligament.",
      "Miller (straight) blade: tip lifts the epiglottis directly - often preferred in infants with a large floppy epiglottis.",
      "Lift along the axis of the handle (up and away); never lever back on the upper teeth.",
      "Cormack-Lehane grade I = full view of the glottis through grade IV = neither glottis nor epiglottis visible.",
    ],
    build(c) {
      put(c, cyl(0.2, 0.2, 2.0, 32), "Handle", "Knurled handle containing the batteries; held in the left hand.", STEEL, { at: V(0, -0.6, 0) });
      put(c, box(0.28, 0.1, 0.3), "Hinge (hook-on fitting)", "Blade clicks on here; opening it to 90 degrees turns on the light.", STEEL, { at: V(0, 0.45, 0) });
      const curve = new THREE.CatmullRomCurve3([V(0, 0.5, 0), V(0.6, 0.65, 0), V(1.2, 0.6, 0), V(1.7, 0.35, 0)]);
      put(c, new THREE.TubeGeometry(curve, 40, 0.06, 6, false), "Macintosh blade (curved)", "Curved blade; tip placed in the vallecula. Sizes 3 and 4 for most adults.", STEEL, { scale: [1, 1, 2.2] });
      put(c, box(1.4, 0.18, 0.04), "Flange", "Vertical flange on the Macintosh blade sweeps the tongue to the left.", STEEL, { at: V(0.8, 0.68, -0.14), rot: [0, 0, -0.1] });
      put(c, sph(0.06), "Light source", "Bulb or fibre-optic light near the blade tip.", "#fde047", { at: V(1.2, 0.55, 0.12) });
      put(c, box(1.8, 0.1, 0.22), "Miller blade (straight)", "Straight blade (shown detached) whose tip lifts the epiglottis directly.", "#94a3b8", { at: V(0.9, -1.0, 0), metal: 0.8 });
    },
  },
  {
    id: "blood-tubes", name: "Blood collection tubes (order of draw)", category: "Laboratory", mesh: "Blood Specimen Collection",
    summary: "Evacuated tubes shown in the CLSI order of draw; cap color indicates the additive.",
    facts: [
      "Order of draw (CLSI GP41): blood cultures, then light blue (citrate), red/gold (serum, clot activator, gel), green (heparin), lavender (EDTA), grey (fluoride/oxalate).",
      "The order prevents additive carry-over, e.g. EDTA contamination gives falsely high potassium and falsely low calcium.",
      "Light blue citrate tubes must be filled to the line (9:1 blood to citrate) for valid PT/INR and aPTT.",
      "Invert gently (do not shake) to mix additives; hemolysis falsely raises potassium, LDH and AST.",
    ],
    build(c) {
      const tubes: [string, string, string][] = [
        ["Blood culture bottle", "#7c3aed", "First, to avoid contaminating cultures; aerobic and anaerobic bottles, cleaned septum."],
        ["Light blue - sodium citrate", "#7dd3fc", "Coagulation: PT/INR, aPTT, D-dimer, fibrinogen. Citrate binds calcium reversibly; fill exactly 9:1."],
        ["Gold/red - serum (clot activator, gel)", "#eab308", "Serum chemistry, serology, hormones, drug levels; let clot 30 minutes before centrifuging."],
        ["Green - lithium/sodium heparin", "#16a34a", "Plasma chemistry (fast results, e.g. electrolytes, troponin); heparin activates antithrombin."],
        ["Lavender - EDTA", "#a855f7", "Whole blood: CBC, blood film, HbA1c, blood bank (pink EDTA), viral loads. EDTA chelates calcium."],
        ["Grey - fluoride/oxalate", "#6b7280", "Glucose (fluoride stops glycolysis), lactate, blood alcohol."],
      ];
      tubes.forEach(([name, col, desc], i) => {
        const x = -1.75 + i * 0.7;
        if (i === 0) {
          put(c, cyl(0.28, 0.28, 1.3), name, desc, "#f1f5f9", { at: V(x, -0.2, 0), opacity: 0.8 });
          put(c, cyl(0.2, 0.2, 0.22), name, desc, col, { at: V(x, 0.56, 0) });
          put(c, cyl(0.27, 0.27, 0.5), name, desc, "#fca5a5", { at: V(x, -0.6, 0), opacity: 0.7 });
          return;
        }
        put(c, new THREE.CapsuleGeometry(0.16, 1.3, 8, 24), name, desc, CLEAR, { at: V(x, -0.2, 0), opacity: 0.35 });
        put(c, cyl(0.2, 0.2, 0.32), name, desc, col, { at: V(x, 0.7, 0) });
        put(c, cyl(0.14, 0.14, 0.75), name, desc, "#b91c1c", { at: V(x, -0.55, 0), opacity: 0.85 });
        if (i === 2) put(c, cyl(0.15, 0.15, 0.1), name, desc, "#fef3c7", { at: V(x, -0.12, 0) });
      });
      put(c, box(4.4, 0.08, 0.6), "Tube rack", "Tubes are drawn left to right in this order.", "#cbd5e1", { at: V(0, -1.1, 0) });
    },
  },
  {
    id: "microscope", name: "Compound light microscope", category: "Laboratory", mesh: "Microscopy",
    summary: "Binocular bright-field microscope used for blood films, Gram stains and urine microscopy.",
    facts: [
      "Total magnification = eyepiece (10x) x objective (4x, 10x, 40x or 100x).",
      "The 100x objective needs immersion oil (refractive index close to glass) to improve resolution.",
      "Start with the lowest-power objective and the coarse focus, then switch to fine focus at higher power.",
      "Close the iris diaphragm to increase contrast (unstained specimens); open it for more light and resolution.",
    ],
    build(c) {
      put(c, box(1.6, 0.25, 1.4), "Base with light source", "Built-in illuminator (LED/halogen) with brightness control.", "#e2e8f0", { at: V(0, -1.8, 0) });
      put(c, sph(0.12), "Base with light source", "", "#fde047", { at: V(0, -1.62, 0.1) });
      put(c, box(0.35, 2.4, 0.35), "Arm", "Carry the microscope by the arm and the base.", "#e2e8f0", { at: V(0, -0.4, -0.55) });
      put(c, box(1.2, 0.08, 1.0), "Stage with slide clips", "Mechanical stage holds the slide; X-Y knobs move it.", BLACK, { at: V(0, -0.7, 0.15) });
      put(c, box(0.75, 0.01, 0.25), "Glass slide", "Specimen slide, stained (e.g. Gram, Wright-Giemsa).", CLEAR, { at: V(0, -0.65, 0.15), opacity: 0.6 });
      put(c, cyl(0.17, 0.17, 0.3), "Condenser and iris diaphragm", "Focuses light on the specimen; the iris diaphragm controls contrast.", BLACK, { at: V(0, -0.95, 0.15) });
      put(c, cyl(0.3, 0.3, 0.15), "Revolving nosepiece", "Rotates to select an objective.", STEEL, { at: V(0, 0.15, 0.15) });
      ["#ef4444", "#eab308", "#3b82f6", "#f8fafc"].forEach((col, i) => {
        const a = (i / 4) * Math.PI * 2;
        put(c, cyl(0.06, 0.05, 0.45 + i * 0.04), "Objective lenses", "4x (red), 10x (yellow), 40x (blue) and 100x oil immersion (white) - color rings follow a common convention.", col, { at: V(Math.cos(a) * 0.17, -0.15, 0.15 + Math.sin(a) * 0.17) });
      });
      put(c, cyl(0.16, 0.16, 1.0), "Body tube", "Optical path from objective to eyepieces.", "#e2e8f0", { at: V(0, 0.55, 0.0), rot: [-0.5, 0, 0] });
      put(c, cyl(0.07, 0.07, 0.4), "Eyepieces (oculars)", "Usually 10x; adjust interpupillary distance and diopter.", BLACK, { at: V(-0.12, 1.15, -0.28), rot: [-0.5, 0, 0] });
      put(c, cyl(0.07, 0.07, 0.4), "Eyepieces (oculars)", "", BLACK, { at: V(0.12, 1.15, -0.28), rot: [-0.5, 0, 0] });
      put(c, cyl(0.28, 0.28, 0.12), "Coarse focus knob", "Large knob: rough focusing at low power only.", BLACK, { at: V(0.25, -0.6, -0.55), rot: [0, 0, H] });
      put(c, cyl(0.15, 0.15, 0.1), "Fine focus knob", "Small knob: precise focusing at high power.", STEEL, { at: V(0.36, -0.6, -0.55), rot: [0, 0, H] });
    },
  },
  {
    id: "centrifuge", name: "Benchtop centrifuge", category: "Laboratory", mesh: "Centrifugation",
    summary: "Fixed-angle rotor centrifuge for separating plasma or serum from blood cells.",
    facts: [
      "Always balance the rotor: place tubes of equal mass directly opposite each other.",
      "Separated whole blood layers: plasma or serum on top, buffy coat (white cells and platelets, about 1%) in the middle, red cells at the bottom.",
      "Serum = plasma minus clotting factors (fibrinogen consumed); obtained from clotted (red/gold) tubes.",
      "Relative centrifugal force RCF (g) = 1.118 x 10^-5 x radius (cm) x rpm^2 - protocols specify g, not rpm.",
    ],
    build(c) {
      put(c, cyl(1.5, 1.6, 1.0, 48), "Housing", "Armoured chamber that contains the rotor; the lid interlock prevents opening while spinning.", "#e2e8f0", { at: V(0, -0.5, 0) });
      put(c, cyl(1.45, 1.45, 0.08, 48), "Lid (interlocked)", "Clear lid; never open until the rotor has stopped.", CLEAR, { at: V(0, 0.4, 0), opacity: 0.3 });
      put(c, cyl(0.95, 0.6, 0.35, 48), "Fixed-angle rotor", "Holds tubes at a fixed angle (about 45 degrees); spins at a set RCF.", STEEL, { at: V(0, 0.05, 0) });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2; const x = Math.cos(a) * 0.72, z = Math.sin(a) * 0.72;
        const m = put(c, new THREE.CapsuleGeometry(0.09, 0.55, 6, 16), i % 2 ? "Balanced tubes" : "Separated blood sample", i % 2 ? "Opposite positions must carry equal masses (use a water blank if needed)." : "After spinning: plasma/serum (straw) on top, buffy coat, red cells at the bottom.", i % 2 ? "#93c5fd" : "#fcd34d", { at: V(x, 0.25, z), opacity: 0.8 });
        m.lookAt(V(x * 2, 1.2, z * 2)); m.rotateX(H);
      }
      put(c, box(0.9, 0.35, 0.05), "Control panel", "Set speed (rpm or g), time and temperature; brake setting affects layer disturbance.", "#0f172a", { at: V(0, -0.6, 1.57), rot: [-0.1, 0, 0] });
    },
  },
  {
    id: "micropipette", name: "Air-displacement micropipette", category: "Laboratory", mesh: "Pipettes",
    summary: "Adjustable-volume micropipette with a disposable tip.",
    facts: [
      "Aspirate: press to the first stop, immerse the tip a few millimetres, release slowly.",
      "Dispense: press to the first stop, then to the second stop (blow-out) to expel the residual volume.",
      "Hold the pipette vertical while aspirating; pre-wet the tip for viscous or volatile liquids.",
      "Use each pipette within 10-100% of its range (e.g. P20 for 2-20 uL, P200 for 20-200 uL, P1000 for 100-1000 uL).",
    ],
    build(c) {
      put(c, cyl(0.22, 0.2, 2.0, 32), "Body (handle)", "Ergonomic body containing the piston and spring.", "#3b82f6", { at: V(0, 0.4, 0) });
      put(c, cyl(0.12, 0.12, 0.5), "Plunger (two stops)", "First stop = set volume; second stop = blow-out.", "#f8fafc", { at: V(0, 1.65, 0) });
      put(c, cyl(0.2, 0.2, 0.08), "Plunger (two stops)", "", "#f8fafc", { at: V(0, 1.92, 0) });
      put(c, box(0.14, 0.35, 0.05), "Volume display", "Digital counter showing the set volume (turn the plunger to adjust).", "#f8fafc", { at: V(0, 0.9, 0.21) });
      put(c, box(0.1, 0.9, 0.08), "Tip ejector", "Press to eject the used tip without touching it.", "#94a3b8", { at: V(0.26, 0.6, 0) });
      put(c, cyl(0.12, 0.06, 0.8), "Tip cone (shaft)", "Lower shaft where the disposable tip attaches.", "#e2e8f0", { at: V(0, -1.0, 0) });
      put(c, cyl(0.07, 0.015, 1.0, 24), "Disposable tip", "Single-use polypropylene tip; liquid never touches the pipette itself.", "#fef9c3", { at: V(0, -1.85, 0), opacity: 0.7 });
    },
  },
  {
    id: "petri-dish", name: "Blood agar plate (Petri dish)", category: "Laboratory", mesh: "Culture Media",
    summary: "Sheep blood agar showing the three hemolysis patterns.",
    facts: [
      "Beta hemolysis: complete lysis, clear zone (S. aureus, S. pyogenes, S. agalactiae).",
      "Alpha hemolysis: partial lysis with green discoloration from hemoglobin oxidation (S. pneumoniae, viridans streptococci).",
      "Gamma: no hemolysis (Enterococcus, S. epidermidis).",
      "Streak in quadrants to obtain isolated colonies; incubate inverted (agar up) so condensation does not drip on colonies.",
    ],
    build(c) {
      put(c, cyl(1.5, 1.5, 0.25, 64, true), "Dish and lid", "Glass or polystyrene dish; label the base (not the lid) with patient details.", CLEAR, { opacity: 0.3 });
      put(c, cyl(1.46, 1.46, 0.16, 64), "Blood agar", "Agar with 5% sheep blood; supports fastidious organisms and shows hemolysis.", "#b91c1c", { at: V(0, -0.03, 0) });
      const R = (s: number) => { let x = s; return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646; };
      const r = R(21);
      const cols: [string, string, string, number, number][] = [
        ["Beta-hemolytic colonies", "#f8fafc", "Complete hemolysis - clear zone around each colony.", -0.6, 0.3],
        ["Alpha-hemolytic colonies", "#e5e7eb", "Partial hemolysis - greenish halo.", 0.6, 0.4],
        ["Gamma (non-hemolytic) colonies", "#f5f5f4", "No hemolysis - agar unchanged around colonies.", 0, -0.7],
      ];
      cols.forEach(([name, col, desc, cx, cz], k) => {
        for (let i = 0; i < 7; i++) {
          const x = cx + (r() - 0.5) * 0.6, z = cz + (r() - 0.5) * 0.5;
          put(c, sph(0.07), name, desc, col, { at: V(x, 0.07, z), scale: [1, 0.4, 1] });
          if (k === 0) put(c, cyl(0.17, 0.17, 0.01, 24), "Clear zone (beta)", "Completely lysed red cells - transparent halo.", "#fca5a5", { at: V(x, 0.055, z), opacity: 0.85 });
          if (k === 1) put(c, cyl(0.15, 0.15, 0.01, 24), "Green zone (alpha)", "Hemoglobin reduced to methemoglobin - green-brown halo.", "#4d7c0f", { at: V(x, 0.055, z), opacity: 0.85 });
        }
      });
    },
  },
];

export function buildEquipment(id: string) {
  const it = EQUIPMENT.find((e) => e.id === id); if (!it) return null;
  const c: Ctx = { g: new THREE.Group(), parts: new Map() };
  it.build(c);
  const box3 = new THREE.Box3().setFromObject(c.g); const ctr = box3.getCenter(new THREE.Vector3()); const sz = box3.getSize(new THREE.Vector3()).length();
  c.g.children.forEach((ch) => ch.position.sub(ctr));
  c.g.scale.setScalar(3 / Math.max(0.01, sz));
  return { group: c.g, parts: Array.from(c.parts.values()) };
}
