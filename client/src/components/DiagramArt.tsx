// Schematic SVG artwork for each clinical diagram. viewBox 0 0 800 540.
const INK = "hsl(var(--foreground))";
const MUTED = "hsl(var(--muted-foreground))";
const LINE = "hsl(var(--border))";
const ART = "hsl(4 74% 58%)";
const VEN = "hsl(var(--venous))";

function Label({ x, y, children, anchor = "middle", size = 12, color = MUTED, weight = 500 }: { x: number; y: number; children: React.ReactNode; anchor?: "start" | "middle" | "end"; size?: number; color?: string; weight?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={color} fontWeight={weight}>
      {children}
    </text>
  );
}

export function NephronArt({ showLabels }: { showLabels: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id="medulla" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(36 60% 60% / 0.04)" />
          <stop offset="1" stopColor="hsl(20 70% 55% / 0.22)" />
        </linearGradient>
      </defs>
      {/* zones */}
      <rect x="0" y="0" width="800" height="210" fill="hsl(221 40% 60% / 0.05)" />
      <rect x="0" y="210" width="800" height="330" fill="url(#medulla)" />
      <line x1="0" y1="210" x2="800" y2="210" stroke={LINE} strokeDasharray="4 6" />
      <Label x={20} y={30} anchor="start" size={11}>CORTEX</Label>
      <Label x={20} y={234} anchor="start" size={11}>MEDULLA</Label>
      {[["300", 240], ["600", 340], ["900", 420], ["1200 mOsm", 510]].map(([t, y]) => (
        <Label key={t} x={780} y={Number(y)} anchor="end" size={10}>{t}</Label>
      ))}

      {/* afferent / efferent arterioles */}
      <path d="M20 150 C60 150 80 140 108 128" stroke={ART} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M110 104 C80 90 60 80 30 78" stroke="hsl(330 45% 55%)" strokeWidth="7" fill="none" strokeLinecap="round" />
      {showLabels && <Label x={30} y={170} anchor="start" size={10}>afferent</Label>}
      {showLabels && <Label x={30} y={68} anchor="start" size={10}>efferent</Label>}

      {/* Bowman capsule + glomerulus */}
      <circle cx="150" cy="118" r="50" fill="hsl(36 40% 70% / 0.08)" stroke={INK} strokeOpacity="0.5" strokeWidth="2" />
      {[[-14, -12, 14], [12, -14, 13], [16, 10, 14], [-12, 14, 13], [0, 0, 12], [-22, 2, 10], [24, -2, 10]].map(([dx, dy, r], i) => (
        <circle key={i} cx={150 + dx} cy={118 + dy} r={r} fill="none" stroke={ART} strokeWidth="3.5" opacity="0.85" />
      ))}

      {/* PCT */}
      <path
        d="M196 104 C220 60 248 60 258 92 S288 132 304 96 S338 54 350 96 S360 140 360 175"
        fill="none" stroke="hsl(36 70% 58%)" strokeWidth="16" strokeLinecap="round"
      />
      {/* thin descending */}
      <path d="M360 175 L360 448" stroke="hsl(190 50% 60%)" strokeWidth="8" fill="none" />
      {/* loop */}
      <path d="M360 448 C360 500 470 500 470 448" stroke="hsl(190 50% 60%)" strokeWidth="8" fill="none" />
      {/* thin ascending */}
      <path d="M470 448 L470 360" stroke="hsl(190 40% 52%)" strokeWidth="8" fill="none" />
      {/* TAL */}
      <path d="M470 360 L470 178 C470 150 430 140 390 146 S290 160 250 156" stroke="hsl(4 60% 58%)" strokeWidth="15" fill="none" strokeLinecap="round" />
      {/* macula densa */}
      <circle cx="232" cy="152" r="9" fill="hsl(48 90% 60%)" stroke={INK} strokeOpacity="0.5" />
      {/* DCT */}
      <path d="M240 160 C300 196 360 196 420 168 S520 96 560 128 S630 150 660 110 S682 92 690 96" stroke="hsl(270 40% 64%)" strokeWidth="13" fill="none" strokeLinecap="round" />
      {/* collecting duct */}
      <path d="M690 50 L690 520" stroke="hsl(158 40% 50%)" strokeWidth="22" fill="none" strokeLinecap="round" />
      {/* water arrows in descending limb */}
      {[250, 320, 390].map((y) => (
        <g key={y} opacity="0.7">
          <path d={`M352 ${y} L322 ${y}`} stroke={VEN} strokeWidth="2" markerEnd="url(#arrow)" />
          <Label x={316} y={y + 4} anchor="end" size={10} color={VEN}>H₂O</Label>
        </g>
      ))}
      {[260, 330].map((y) => (
        <g key={y} opacity="0.8">
          <path d={`M480 ${y} L512 ${y}`} stroke={ART} strokeWidth="2" markerEnd="url(#arrow)" />
          <Label x={518} y={y + 4} anchor="start" size={10} color={ART}>Na⁺ K⁺ 2Cl⁻</Label>
        </g>
      ))}
      <g opacity="0.75">
        <path d="M702 300 L730 300" stroke={VEN} strokeWidth="2" markerEnd="url(#arrow)" />
        <Label x={736} y={304} anchor="start" size={10} color={VEN}>H₂O (ADH)</Label>
      </g>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <Label x={690} y={535} size={10}>to renal pelvis</Label>
    </g>
  );
}

export function BrachialArt({ showLabels }: { showLabels: boolean }) {
  const roots = [["C5", 100], ["C6", 175], ["C7", 235], ["C8", 300], ["T1", 365]] as const;
  const trunkY = { upper: 150, middle: 235, lower: 330 };
  const cordY = { lateral: 150, posterior: 235, medial: 330 };
  const col = (x: number, t: string) => <Label x={x} y={36} size={11} color={MUTED}>{t}</Label>;
  const lat = "hsl(36 80% 60%)";
  const post = "hsl(221 60% 66%)";
  const med = "hsl(158 45% 52%)";
  const sw = 6;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {col(70, "ROOTS")}{col(205, "TRUNKS")}{col(300, "DIVISIONS")}{col(420, "CORDS")}{col(600, "BRANCHES")}
      <line x1="40" y1="50" x2="760" y2="50" stroke={LINE} />
      {/* roots → trunks */}
      {roots.map(([r, y]) => {
        const ty = r === "C5" || r === "C6" ? trunkY.upper : r === "C7" ? trunkY.middle : trunkY.lower;
        return (
          <g key={r}>
            <path d={`M70 ${y} C130 ${y} 150 ${ty} 205 ${ty}`} stroke={INK} strokeOpacity="0.7" strokeWidth={sw} />
            <circle cx="70" cy={y} r="14" fill="hsl(var(--card))" stroke={INK} strokeOpacity="0.6" strokeWidth="2" />
            <Label x={70} y={y + 4} size={11} color={INK} weight={600}>{r}</Label>
          </g>
        );
      })}
      {/* trunks → divisions → cords */}
      <path d={`M205 ${trunkY.upper} L260 ${trunkY.upper}`} stroke={INK} strokeOpacity="0.7" strokeWidth={sw} />
      <path d={`M205 ${trunkY.middle} L260 ${trunkY.middle}`} stroke={INK} strokeOpacity="0.7" strokeWidth={sw} />
      <path d={`M205 ${trunkY.lower} L260 ${trunkY.lower}`} stroke={INK} strokeOpacity="0.7" strokeWidth={sw} />
      {/* anterior divisions */}
      <path d={`M260 ${trunkY.upper} C320 ${trunkY.upper - 6} 360 ${cordY.lateral} 420 ${cordY.lateral}`} stroke={lat} strokeWidth={sw} />
      <path d={`M260 ${trunkY.middle} C320 ${trunkY.middle - 20} 360 ${cordY.lateral + 20} 420 ${cordY.lateral}`} stroke={lat} strokeWidth={sw} />
      <path d={`M260 ${trunkY.lower} C320 ${trunkY.lower} 360 ${cordY.medial} 420 ${cordY.medial}`} stroke={med} strokeWidth={sw} />
      {/* posterior divisions */}
      {[trunkY.upper, trunkY.middle, trunkY.lower].map((y, i) => (
        <path key={i} d={`M260 ${y} C320 ${y + (cordY.posterior - y) * 0.5 + 10} 360 ${cordY.posterior} 420 ${cordY.posterior}`} stroke={post} strokeWidth={sw - 1} strokeDasharray="1 0" opacity="0.95" />
      ))}
      {/* cords → branches */}
      <path d={`M420 ${cordY.lateral} C480 ${cordY.lateral} 520 110 600 110`} stroke={lat} strokeWidth={sw} />
      <path d={`M420 ${cordY.lateral} C490 ${cordY.lateral + 30} 520 300 600 310`} stroke={lat} strokeWidth={sw - 1} />
      <path d={`M420 ${cordY.medial} C490 ${cordY.medial} 520 312 600 310`} stroke={med} strokeWidth={sw - 1} />
      <path d={`M420 ${cordY.medial} C480 ${cordY.medial + 10} 520 380 600 380`} stroke={med} strokeWidth={sw} />
      <path d={`M420 ${cordY.posterior} C480 ${cordY.posterior} 520 175 600 175`} stroke={post} strokeWidth={sw} />
      <path d={`M420 ${cordY.posterior} C480 ${cordY.posterior} 520 240 600 240`} stroke={post} strokeWidth={sw} />
      {/* long thoracic from C5–C7 roots */}
      <path d="M96 104 C110 200 112 280 120 400" stroke={INK} strokeOpacity="0.45" strokeWidth="3" strokeDasharray="5 5" />
      {/* branch endings */}
      {[110, 175, 240, 310, 380].map((y) => (
        <circle key={y} cx="600" cy={y} r="5" fill={INK} opacity="0.6" />
      ))}
      {showLabels && (
        <g>
          <Label x={420} y={cordY.lateral - 14} size={10} color={lat}>lateral cord</Label>
          <Label x={420} y={cordY.posterior - 14} size={10} color={post}>posterior cord</Label>
          <Label x={420} y={cordY.medial + 24} size={10} color={med}>medial cord</Label>
          <Label x={205} y={trunkY.upper - 14} size={10}>upper</Label>
          <Label x={205} y={trunkY.middle - 14} size={10}>middle</Label>
          <Label x={205} y={trunkY.lower + 24} size={10}>lower</Label>
          {[["Musculocutaneous", 110], ["Axillary", 175], ["Radial", 240], ["Median", 310], ["Ulnar", 380]].map(([t, y]) => (
            <Label key={t} x={640} y={Number(y) + 4} anchor="start" size={12} color={INK}>{t}</Label>
          ))}
          <Label x={132} y={420} anchor="start" size={10}>long thoracic</Label>
        </g>
      )}
      <g transform="translate(40 470)">
        {[["Anterior → lateral", lat], ["Posterior", post], ["Anterior → medial", med]].map(([t, c], i) => (
          <g key={t} transform={`translate(${i * 170} 0)`}>
            <line x1="0" y1="0" x2="22" y2="0" stroke={c} strokeWidth="5" />
            <Label x={30} y={4} anchor="start" size={11}>{t}</Label>
          </g>
        ))}
      </g>
    </g>
  );
}

export function CoagArt({ showLabels }: { showLabels: boolean }) {
  const Box = ({ x, y, w = 96, t, tone = INK }: { x: number; y: number; w?: number; t: string; tone?: string }) => (
    <g>
      <rect x={x - w / 2} y={y - 16} width={w} height={32} rx="6" fill="hsl(var(--card))" stroke={tone} strokeOpacity="0.7" strokeWidth="1.5" />
      <Label x={x} y={y + 4} size={12} color={INK} weight={600}>{t}</Label>
    </g>
  );
  const arrow = (d: string, c = MUTED, dash?: string) => <path d={d} stroke={c} strokeWidth="2" fill="none" markerEnd="url(#carrow)" strokeDasharray={dash} />;
  const drug = (x: number, y: number, t: string) =>
    showLabels && (
      <g>
        <rect x={x - 4} y={y - 12} width={t.length * 6.4 + 8} height={18} rx="9" fill="hsl(4 74% 60% / 0.14)" />
        <Label x={x} y={y + 1} anchor="start" size={10.5} color={ART} weight={600}>{t}</Label>
      </g>
    );
  return (
    <g>
      <defs>
        <marker id="carrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={MUTED} />
        </marker>
      </defs>
      <rect x="40" y="40" width="250" height="180" rx="10" fill="hsl(221 50% 60% / 0.06)" stroke={LINE} />
      <rect x="500" y="80" width="250" height="110" rx="10" fill="hsl(36 70% 60% / 0.06)" stroke={LINE} />
      <Label x={58} y={62} anchor="start" size={11}>INTRINSIC · PTT</Label>
      <Label x={518} y={102} anchor="start" size={11}>EXTRINSIC · PT/INR</Label>

      <Box x={110} y={96} t="XII → XIIa" w={100} />
      <Box x={220} y={96} t="XI → XIa" w={90} />
      <Box x={110} y={176} t="IX → IXa" w={100} />
      <Box x={220} y={176} t="VIIIa" w={80} />
      {arrow("M160 96 L172 96")}
      {arrow("M220 114 C220 140 160 140 130 156")}
      {arrow("M162 176 L178 176")}
      <Box x={600} y={140} t="TF + VIIa" w={120} tone="hsl(36 80% 55%)" />

      {/* converge */}
      {arrow("M160 196 C200 240 300 260 330 268")}
      {arrow("M600 158 C590 230 480 262 432 268")}
      <Box x={380} y={270} t="X → Xa" w={100} tone={ART} />
      <Box x={505} y={318} t="Va" w={56} />
      {arrow("M380 288 L380 350")}
      <Box x={380} y={370} t="II → IIa (thrombin)" w={170} tone={ART} />
      {arrow("M380 388 L380 450")}
      <Box x={380} y={470} t="fibrinogen → fibrin" w={170} />
      <Box x={560} y={470} t="XIIIa" w={64} />
      {arrow("M528 470 L468 470")}
      {/* thrombin feedback */}
      {arrow("M296 370 C230 360 230 220 240 196", "hsl(158 45% 50%)", "4 4")}

      {/* natural anticoagulants */}
      <rect x="580" y="360" width="150" height="40" rx="8" fill="hsl(158 45% 50% / 0.1)" stroke="hsl(158 45% 50%)" strokeOpacity="0.6" />
      <Label x={655} y={385} size={12} color={INK} weight={600}>Protein C + S</Label>
      <path d="M600 360 C580 340 560 330 536 322" stroke="hsl(158 45% 50%)" strokeWidth="2" fill="none" />
      <line x1="530" y1="314" x2="540" y2="330" stroke="hsl(158 45% 50%)" strokeWidth="3" />
      <path d="M600 360 C470 240 300 200 260 182" stroke="hsl(158 45% 50%)" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />

      {/* platelets */}
      <g transform="translate(130 400)">
        <circle r="34" fill="hsl(270 40% 60% / 0.08)" stroke="hsl(270 40% 62%)" strokeOpacity="0.6" />
        <circle cx="-12" cy="-6" r="7" fill="hsl(270 40% 62% / 0.5)" />
        <circle cx="10" cy="-10" r="6" fill="hsl(270 40% 62% / 0.5)" />
        <circle cx="4" cy="10" r="7" fill="hsl(270 40% 62% / 0.5)" />
        <Label x={0} y={56} size={11}>platelet plug</Label>
      </g>

      {drug(28, 248, "Unfractionated heparin → PTT")}
      {drug(452, 236, "apixaban · rivaroxaban")}
      {drug(476, 352, "dabigatran · argatroban")}
      {drug(586, 210, "warfarin ↓ II, VII, IX, X")}
      {drug(28, 478, "clopidogrel · aspirin")}
      {drug(260, 520, "tPA → plasmin degrades fibrin")}
    </g>
  );
}

export function AuscultationArt({ showLabels }: { showLabels: boolean }) {
  const cx = 390;
  return (
    <g>
      {/* torso */}
      <path
        d={`M${cx - 250} 520 C${cx - 260} 360 ${cx - 270} 200 ${cx - 230} 120 C${cx - 200} 80 ${cx - 120} 70 ${cx - 70} 60 L${cx - 40} 30 L${cx + 40} 30 L${cx + 70} 60 C${cx + 120} 70 ${cx + 200} 80 ${cx + 230} 120 C${cx + 270} 200 ${cx + 260} 360 ${cx + 250} 520`}
        fill="hsl(24 40% 60% / 0.06)"
        stroke={INK}
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      {/* clavicles */}
      <path d={`M${cx - 18} 112 C${cx - 80} 100 ${cx - 150} 104 ${cx - 200} 118`} stroke={INK} strokeOpacity="0.45" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d={`M${cx + 18} 112 C${cx + 80} 100 ${cx + 150} 104 ${cx + 200} 118`} stroke={INK} strokeOpacity="0.45" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* ribs */}
      {[150, 210, 270, 330, 390, 445].map((y, i) => (
        <g key={y} stroke={INK} strokeOpacity="0.18" strokeWidth="5" fill="none" strokeLinecap="round">
          <path d={`M${cx - 26} ${y} C${cx - 90} ${y - 10} ${cx - 170} ${y + 10 + i * 4} ${cx - 220} ${y + 40 + i * 6}`} />
          <path d={`M${cx + 26} ${y} C${cx + 90} ${y - 10} ${cx + 170} ${y + 10 + i * 4} ${cx + 220} ${y + 40 + i * 6}`} />
        </g>
      ))}
      {/* sternum */}
      <rect x={cx - 22} y={110} width="44" height="270" rx="16" fill="hsl(36 30% 80% / 0.12)" stroke={INK} strokeOpacity="0.3" />
      {/* heart silhouette */}
      <path
        d={`M${cx - 60} 220 C${cx - 90} 260 ${cx - 70} 340 ${cx - 20} 360 C${cx + 40} 384 ${cx + 110} 390 ${cx + 125} 378 C${cx + 140} 350 ${cx + 110} 270 ${cx + 60} 228 C${cx + 20} 200 ${cx - 30} 196 ${cx - 60} 220 Z`}
        fill="hsl(4 74% 58% / 0.16)"
        stroke={ART}
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      <path d={`M${cx - 20} 222 C${cx - 22} 190 ${cx - 10} 160 ${cx + 20} 150 C${cx + 50} 140 ${cx + 70} 160 ${cx + 66} 186`} stroke={ART} strokeOpacity="0.5" strokeWidth="12" fill="none" />
      {showLabels && (
        <g>
          <Label x={cx - 120} y={98} size={10}>clavicle</Label>
          <Label x={cx} y={400} size={10}>sternum</Label>
          {[["2nd ICS", 180], ["3rd ICS", 240], ["4th ICS", 300], ["5th ICS", 360]].map(([t, y]) => (
            <Label key={t} x={cx - 238} y={Number(y)} anchor="start" size={10}>{t}</Label>
          ))}
          <path d={`M${cx + 120} 90 L${cx + 120} 500`} stroke={LINE} strokeDasharray="4 6" />
          <Label x={cx + 126} y={500} anchor="start" size={10}>mid-clavicular line</Label>
        </g>
      )}
      <Label x={cx - 200} y={530} size={10}>Patient's right</Label>
      <Label x={cx + 200} y={530} size={10}>Patient's left</Label>
    </g>
  );
}

export const ART_BY_ID: Record<string, (p: { showLabels: boolean }) => JSX.Element> = {
  nephron: NephronArt,
  brachial: BrachialArt,
  coag: CoagArt,
  auscultation: AuscultationArt,
};
