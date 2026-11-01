import { Bone, Bug, HeartPulse, Pill, Stethoscope, Brain, Activity, type LucideIcon } from "lucide-react";

export const MESH_CATS: Record<string, { label: string; short: string; icon: LucideIcon; desc: string }> = {
  A: { label: "Anatomy", short: "Anatomy", icon: Bone, desc: "Body regions, organs, tissues, cells and embryonic structures" },
  B: { label: "Organisms", short: "Organisms", icon: Bug, desc: "Bacteria, viruses, fungi, parasites and animals" },
  C: { label: "Diseases", short: "Diseases", icon: HeartPulse, desc: "Disorders, signs, symptoms and pathological conditions" },
  D: { label: "Chemicals & Drugs", short: "Drugs", icon: Pill, desc: "Pharmaceuticals, chemicals, enzymes and biomolecules" },
  E: { label: "Procedures & Equipment", short: "Procedures", icon: Stethoscope, desc: "Diagnostic and therapeutic techniques, equipment and supplies" },
  F: { label: "Psychiatry & Psychology", short: "Psychiatry", icon: Brain, desc: "Behavior, mental disorders and psychological phenomena" },
  G: { label: "Physiology & Phenomena", short: "Physiology", icon: Activity, desc: "Physiological, genetic and biochemical processes" },
};

export const KIND_LABEL: Record<string, string> = {
  vignette: "Clinical vignette",
  definition: "Concept definition",
  fda_class: "FDA drug class",
  pharmacologic_action: "Pharmacologic action",
  anatomy_hierarchy: "Anatomy hierarchy",
  taxonomy: "Microbial taxonomy",
  lab_value: "Lab reference value",
};

export const DEVICE_CLASS: Record<string, string> = {
  "1": "Class I · low risk, general controls",
  "2": "Class II · moderate risk, special controls (usually 510(k))",
  "3": "Class III · high risk, premarket approval",
  U: "Unclassified",
  N: "Not classified",
  F: "HDE",
};

export function fmtDate(v?: string | number | null) {
  if (!v) return "";
  if (typeof v === "string" && /^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
export function stripClass(s: string) {
  return s.replace(/\s*\[(EPC|MoA|PE|CS)\]$/, "");
}
export function pct(n: number | null | undefined) {
  return n == null ? "—" : `${n}%`;
}
