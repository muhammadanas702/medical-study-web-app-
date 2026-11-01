// High-yield clinical diagrams with hotspot annotations (schematic, for review).
export type DiagramSystem = "Cardiovascular" | "Respiratory" | "Renal" | "Gastrointestinal" | "Neuro / MSK" | "Hematology" | "Endocrine";
type System = DiagramSystem;
export const DIAGRAM_SYSTEM_MAP: Record<DiagramSystem, string> = { Cardiovascular: "Cardiovascular", Respiratory: "Respiratory", Renal: "Renal & Urogenital", Gastrointestinal: "Gastrointestinal", "Neuro / MSK": "Musculoskeletal & Skin", Hematology: "Hematology & Immunology", Endocrine: "Endocrine & Metabolic" };
export interface Hotspot {
  side?: "left" | "right";
  id: string;
  x: number; // in diagram viewBox units
  y: number;
  label: string;
  title: string;
  facts: string[];
  pearl: string;
  prompt: string; // used in "test me" mode
}

export interface DiagramDef {
  id: string;
  title: string;
  system: System;
  blurb: string;
  hotspots: Hotspot[];
}

export const DIAGRAMS: DiagramDef[] = [
  {
    id: "nephron",
    title: "Nephron & diuretic targets",
    system: "Renal",
    blurb: "Every diuretic class acts at a specific segment. Learn the transporter and you can predict the electrolyte pattern.",
    hotspots: [
      {
        id: "glom",
        x: 150, y: 120,
        label: "Glomerulus",
        title: "Glomerulus & Bowman capsule",
        facts: [
          "Filtration barrier: fenestrated endothelium, GBM (type IV collagen), podocyte slit diaphragms.",
          "Afferent arteriole dilation (prostaglandins) and efferent constriction (angiotensin II) raise GFR.",
          "NSAIDs + ACE inhibitors together can precipitate acute kidney injury.",
        ],
        pearl: "Minimal change disease: podocyte foot process effacement on EM only.",
        prompt: "Site where podocyte foot process effacement causes nephrotic syndrome",
      },
      {
        id: "jga",
        x: 232, y: 150,
        label: "JG apparatus",
        title: "Juxtaglomerular apparatus",
        facts: [
          "JG cells (modified smooth muscle of afferent arteriole) secrete renin.",
          "Macula densa (in DCT) senses ↓ NaCl delivery → ↑ renin.",
          "β1 stimulation increases renin release — β-blockers reduce it.",
        ],
        pearl: "Renin is the rate-limiting step of RAAS.",
        prompt: "Structure that senses NaCl delivery and triggers renin release",
      },
      {
        id: "pct",
        x: 300, y: 92,
        label: "PCT",
        title: "Proximal convoluted tubule",
        facts: [
          "Reabsorbs ~65–80% of Na+ and water, all glucose and amino acids, most HCO3−.",
          "Acetazolamide (carbonic anhydrase inhibitor) acts here → HCO3− loss.",
          "Fanconi syndrome: generalized PCT reabsorptive defect.",
        ],
        pearl: "Acetazolamide → hyperchloremic, normal anion gap metabolic acidosis.",
        prompt: "Site of action of acetazolamide",
      },
      {
        id: "tdl",
        x: 360, y: 300,
        label: "Thin descending",
        title: "Thin descending limb",
        facts: [
          "Permeable to water, impermeable to solutes.",
          "Concentrates the filtrate as it descends into the hypertonic medulla.",
          "Mannitol acts throughout but mainly here and PCT (osmotic diuretic).",
        ],
        pearl: "Mannitol is contraindicated in heart failure / pulmonary edema.",
        prompt: "Segment permeable to water but not solutes",
      },
      {
        id: "tal",
        x: 470, y: 270,
        label: "Thick ascending",
        title: "Thick ascending limb",
        facts: [
          "NKCC2 (Na+/K+/2Cl−) cotransporter; impermeable to water (diluting segment).",
          "Loop diuretics (furosemide, bumetanide) block NKCC2 → ↑ Ca2+ excretion.",
          "Bartter syndrome mimics loop diuretic: hypokalemic metabolic alkalosis + hypercalciuria.",
        ],
        pearl: "Loops lose calcium — useful in hypercalcemia; ototoxicity is a key adverse effect.",
        prompt: "Site of action of furosemide",
      },
      {
        id: "dct",
        x: 590, y: 120,
        label: "DCT",
        title: "Distal convoluted tubule",
        facts: [
          "NCC (Na+/Cl−) cotransporter; PTH-regulated Ca2+ reabsorption.",
          "Thiazides block NCC → ↑ Ca2+ reabsorption (hypercalcemia), hypokalemia.",
          "Gitelman syndrome mimics thiazides: hypokalemia, hypomagnesemia, hypocalciuria.",
        ],
        pearl: "Thiazides: hyperGLUC — glycemia, lipidemia, uricemia, calcemia.",
        prompt: "Site of action of hydrochlorothiazide",
      },
      {
        id: "cd",
        x: 690, y: 330,
        label: "Collecting duct",
        title: "Collecting duct",
        facts: [
          "Principal cells: ENaC Na+ reabsorption, K+ secretion, ADH-driven aquaporin-2.",
          "Spironolactone/eplerenone block aldosterone receptor; amiloride/triamterene block ENaC.",
          "α-intercalated cells secrete H+; Liddle syndrome = ENaC gain of function.",
        ],
        pearl: "K+-sparing diuretics risk hyperkalemia; spironolactone causes gynecomastia.",
        prompt: "Site of action of spironolactone and amiloride",
      },
    ],
  },
  {
    id: "brachial",
    title: "Brachial plexus lesions",
    system: "Neuro / MSK",
    blurb: "Randy Travis Drinks Cold Beer — roots, trunks, divisions, cords, branches. Click each lesion site to connect injury → nerve → deficit.",
    hotspots: [
      {
        id: "upper",
        x: 205, y: 150,
        label: "Upper trunk",
        title: "Upper trunk (C5–C6) — Erb palsy",
        facts: [
          "Mechanism: lateral traction on the neck (shoulder dystocia, falls on shoulder).",
          "Loss of deltoid, supraspinatus, infraspinatus, biceps.",
          "Arm adducted, medially rotated, forearm pronated and extended.",
        ],
        pearl: "\"Waiter's tip\" posture.",
        prompt: "Lesion producing a waiter's tip posture",
      },
      {
        id: "lower",
        x: 205, y: 330,
        label: "Lower trunk",
        title: "Lower trunk (C8–T1) — Klumpke palsy",
        facts: [
          "Mechanism: upward arm traction (grabbing a tree branch), cervical rib, Pancoast tumor.",
          "Intrinsic hand muscle weakness → total claw hand.",
          "May include Horner syndrome if T1 sympathetics involved.",
        ],
        pearl: "Thoracic outlet syndrome compresses the lower trunk.",
        prompt: "Lesion causing total claw hand after grabbing a branch while falling",
      },
      {
        id: "longthor",
        x: 120, y: 360,
        label: "Long thoracic",
        title: "Long thoracic nerve (C5–C7)",
        facts: [
          "Innervates serratus anterior.",
          "Injured in mastectomy (axillary node dissection) or stab wounds.",
          "Cannot abduct arm above horizontal; winged scapula.",
        ],
        pearl: "Arises directly from roots — \"SALT\": Serratus Anterior = Long Thoracic.",
        prompt: "Nerve injured during mastectomy causing a winged scapula",
      },
      {
        id: "axillary",
        x: 610, y: 175,
        label: "Axillary",
        title: "Axillary nerve (C5–C6)",
        facts: [
          "From posterior cord; innervates deltoid and teres minor.",
          "Injured by surgical neck of humerus fracture or anterior shoulder dislocation.",
          "Flattened deltoid, weak arm abduction beyond ~15°, numb lateral shoulder (regimental badge).",
        ],
        pearl: "Travels with the posterior circumflex humeral artery.",
        prompt: "Nerve at risk with a surgical neck of humerus fracture",
      },
      {
        id: "radial",
        x: 620, y: 240,
        label: "Radial",
        title: "Radial nerve (C5–T1)",
        facts: [
          "From posterior cord; innervates the extensors of the arm and forearm.",
          "Injured by midshaft humerus fracture (radial groove) or crutch / \"Saturday night\" palsy.",
          "Wrist drop; loss of sensation over dorsal hand.",
        ],
        pearl: "Travels with the deep brachial artery in the radial groove.",
        prompt: "Nerve injured in a midshaft humerus fracture causing wrist drop",
      },
      {
        id: "median",
        x: 620, y: 310,
        label: "Median",
        title: "Median nerve (C5–T1)",
        facts: [
          "From lateral + medial cords; forearm flexors and thenar muscles.",
          "Proximal (supracondylar fracture): \"ape hand\" and \"Pope's blessing\".",
          "Distal (carpal tunnel): thenar atrophy, numb lateral 3½ fingers.",
        ],
        pearl: "Anterior interosseous branch injury → cannot make the \"OK\" sign.",
        prompt: "Nerve compressed in carpal tunnel syndrome",
      },
      {
        id: "ulnar",
        x: 620, y: 380,
        label: "Ulnar",
        title: "Ulnar nerve (C8–T1)",
        facts: [
          "From medial cord; intrinsic hand muscles and medial forearm flexors.",
          "Injured at the medial epicondyle or hook of hamate (cycling, falls).",
          "Ulnar claw on attempted finger extension; Froment sign.",
        ],
        pearl: "Ulnar paradox: distal lesion → more pronounced claw.",
        prompt: "Nerve injured by a fracture of the medial epicondyle",
      },
      {
        id: "musculo",
        x: 610, y: 110,
        label: "Musculocutaneous",
        title: "Musculocutaneous nerve (C5–C7)",
        facts: [
          "From lateral cord; coracobrachialis, biceps brachii, brachialis.",
          "Injured by upper trunk compression.",
          "Loss of forearm flexion and supination; numb lateral forearm.",
        ],
        pearl: "Continues as the lateral cutaneous nerve of the forearm.",
        prompt: "Nerve supplying biceps brachii",
      },
    ],
  },
  {
    id: "coag",
    title: "Coagulation cascade & anticoagulants",
    system: "Hematology",
    blurb: "PT tracks the extrinsic pathway, PTT the intrinsic. Pin each drug to the factor it hits.",
    hotspots: [
      {
        id: "intrinsic",
        x: 160, y: 140,
        label: "Intrinsic (XII→VIII)",
        title: "Intrinsic pathway — PTT",
        facts: [
          "Activated by contact with negatively charged surfaces (XII, XI, IX, VIII).",
          "Hemophilia A = factor VIII deficiency; B = factor IX; both X-linked recessive.",
          "Isolated ↑ PTT with normal PT and platelets → think hemophilia or vWD.",
        ],
        pearl: "Unfractionated heparin is monitored with PTT.",
        prompt: "Pathway affected in hemophilia A",
      },
      {
        id: "extrinsic",
        x: 600, y: 178,
        label: "Extrinsic (TF + VII)",
        title: "Extrinsic pathway — PT/INR",
        facts: [
          "Tissue factor + factor VIIa initiates in vivo coagulation.",
          "Factor VII has the shortest half-life of the procoagulant factors → PT/INR rises first with warfarin.",
          "Warfarin inhibits vitamin K epoxide reductase (II, VII, IX, X, C, S).",
        ],
        pearl: "Warfarin skin necrosis: early protein C depletion → transient hypercoagulable state.",
        prompt: "Pathway monitored for warfarin therapy",
      },
      {
        id: "xa",
        x: 438, y: 268,
        label: "Factor Xa",
        title: "Factor X → Xa (common pathway)",
        facts: [
          "Convergence point of intrinsic and extrinsic pathways.",
          "Direct Xa inhibitors: rivaroxaban, apixaban, edoxaban (reversal: andexanet alfa).",
          "LMWH (enoxaparin) acts more on Xa than thrombin via antithrombin.",
        ],
        pearl: "Fondaparinux: indirect Xa inhibitor via antithrombin, no HIT risk.",
        prompt: "Target of apixaban and rivaroxaban",
      },
      {
        id: "thrombin",
        x: 282, y: 366, side: "left",
        label: "Thrombin (IIa)",
        title: "Prothrombin → thrombin",
        facts: [
          "Thrombin converts fibrinogen → fibrin, activates V, VIII, XI, XIII and platelets.",
          "Direct thrombin inhibitors: dabigatran (oral), argatroban, bivalirudin (IV).",
          "Heparin–antithrombin complex inactivates thrombin and Xa.",
        ],
        pearl: "Dabigatran reversal: idarucizumab.",
        prompt: "Target of dabigatran",
      },
      {
        id: "fibrin",
        x: 282, y: 466, side: "left",
        label: "Fibrin clot",
        title: "Fibrin cross-linking",
        facts: [
          "Factor XIIIa cross-links fibrin to stabilize the clot.",
          "tPA (alteplase) converts plasminogen → plasmin to degrade fibrin.",
          "D-dimer = fibrin degradation product; high sensitivity for VTE.",
        ],
        pearl: "Aminocaproic acid / tranexamic acid inhibit fibrinolysis.",
        prompt: "Product degraded by plasmin, measured as D-dimer",
      },
      {
        id: "proteinC",
        x: 650, y: 342,
        label: "Protein C / S",
        title: "Protein C, protein S & antithrombin",
        facts: [
          "Activated protein C (with S) inactivates factors Va and VIIIa.",
          "Factor V Leiden: factor V resistant to activated protein C — most common inherited thrombophilia.",
          "Antithrombin deficiency → poor response to heparin.",
        ],
        pearl: "Prothrombin G20210A mutation → ↑ prothrombin levels.",
        prompt: "Natural anticoagulant that factor V Leiden resists",
      },
      {
        id: "vwf",
        x: 130, y: 400,
        label: "vWF / platelets",
        title: "Platelet plug — vWF & GpIb",
        facts: [
          "vWF bridges platelet GpIb to exposed collagen; also carries factor VIII.",
          "von Willebrand disease: mucosal bleeding, ↑ bleeding time, ± ↑ PTT. Treat with desmopressin.",
          "Clopidogrel blocks P2Y12 (ADP); abciximab blocks GpIIb/IIIa.",
        ],
        pearl: "Bernard-Soulier = GpIb deficiency; Glanzmann = GpIIb/IIIa deficiency.",
        prompt: "Protein that links platelet GpIb to subendothelial collagen",
      },
    ],
  },
  {
    id: "auscultation",
    title: "Cardiac auscultation & murmurs",
    system: "Cardiovascular",
    blurb: "Where you hear it, when it occurs and what changes it. Hover each auscultation area on the chest.",
    hotspots: [
      {
        id: "aortic",
        x: 330, y: 190,
        label: "Aortic area",
        title: "Aortic area — 2nd right ICS",
        facts: [
          "Aortic stenosis: crescendo-decrescendo systolic ejection murmur radiating to the carotids.",
          "Classic triad: syncope, angina, dyspnea (SAD). Pulsus parvus et tardus.",
          "Elderly → age-related calcification; younger → bicuspid valve.",
        ],
        pearl: "AS murmur softens with Valsalva or standing (↓ preload) and with handgrip (↑ afterload).",
        prompt: "Area to auscultate a murmur radiating to the carotids",
      },
      {
        id: "pulmonic",
        x: 450, y: 190,
        label: "Pulmonic area",
        title: "Pulmonic area — 2nd left ICS",
        facts: [
          "Pulmonic stenosis: systolic ejection murmur; associated with Noonan and tetralogy of Fallot.",
          "Fixed split S2 → atrial septal defect.",
          "Patent ductus arteriosus: continuous machine-like murmur, left infraclavicular.",
        ],
        pearl: "Paradoxical splitting → aortic stenosis or LBBB.",
        prompt: "Area where a fixed split S2 from ASD is best heard",
      },
      {
        id: "erb",
        x: 455, y: 255,
        label: "Erb point",
        title: "Erb point — 3rd left ICS",
        facts: [
          "Aortic regurgitation: early diastolic decrescendo, best heard leaning forward at end expiration.",
          "Wide pulse pressure, bounding pulses, head bobbing (de Musset).",
          "Hypertrophic cardiomyopathy murmur also heard along the left sternal border.",
        ],
        pearl: "HOCM murmur ↑ with Valsalva or standing — opposite of most murmurs.",
        prompt: "Area for an early diastolic decrescendo murmur of aortic regurgitation",
      },
      {
        id: "tricuspid",
        x: 405, y: 335,
        label: "Tricuspid area",
        title: "Tricuspid area — left lower sternal border",
        facts: [
          "Tricuspid regurgitation: holosystolic, ↑ with inspiration (Carvallo sign).",
          "IV drug use → tricuspid endocarditis (S. aureus).",
          "VSD: harsh holosystolic murmur at LLSB.",
        ],
        pearl: "Right-sided murmurs increase with inspiration.",
        prompt: "Area for a holosystolic murmur that increases with inspiration",
      },
      {
        id: "mitral",
        x: 510, y: 375,
        label: "Mitral area",
        title: "Mitral area — apex, 5th ICS MCL",
        facts: [
          "Mitral regurgitation: holosystolic, blowing, radiates to the axilla.",
          "Mitral stenosis: opening snap + diastolic rumble; rheumatic fever is the top cause.",
          "Mitral valve prolapse: mid-systolic click; Marfan and Ehlers-Danlos.",
        ],
        pearl: "Left lateral decubitus position accentuates mitral stenosis.",
        prompt: "Area where a holosystolic murmur radiating to the axilla is best heard",
      },
    ],
  },
];
