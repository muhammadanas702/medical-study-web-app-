// Schematic SVG artwork for the additional clinical diagrams. viewBox 0 0 800 540.
const INK = "hsl(var(--foreground))";
const MUTED = "hsl(var(--muted-foreground))";
const LINE = "hsl(var(--border))";
const RED = "hsl(4 74% 58%)";
const BLUE = "hsl(var(--venous))";
const TEAL = "hsl(174 55% 42%)";
const AMBER = "hsl(36 85% 52%)";
const VIOLET = "hsl(262 50% 60%)";
const GREEN = "hsl(140 45% 45%)";

function T({ x, y, children, anchor = "middle", size = 11, color = MUTED, weight = 500 }: { x: number; y: number; children: React.ReactNode; anchor?: "start" | "middle" | "end"; size?: number; color?: string; weight?: number }) {
  return <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={color} fontWeight={weight}>{children}</text>;
}
function Axes({ x0, y0, x1, y1, xl, yl }: { x0: number; y0: number; x1: number; y1: number; xl: string; yl: string }) {
  return (
    <g>
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={INK} strokeOpacity="0.6" />
      <line x1={x0} y1={y0} x2={x0} y2={y1} stroke={INK} strokeOpacity="0.6" />
      <T x={(x0 + x1) / 2} y={y0 + 34} size={12}>{xl}</T>
      <g transform={`translate(${x0 - 46} ${(y0 + y1) / 2}) rotate(-90)`}><T x={0} y={0} size={12}>{yl}</T></g>
    </g>
  );
}
const Arrow = ({ d, color = MUTED, w = 2 }: { d: string; color?: string; w?: number }) => <path d={d} stroke={color} strokeWidth={w} fill="none" markerEnd="url(#arr2)" />;
const Defs = () => (
  <defs>
    <marker id="arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={MUTED} /></marker>
  </defs>
);
function Box({ x, y, w, h, fill, label, sub, show = true }: { x: number; y: number; w: number; h: number; fill: string; label: string; sub?: string; show?: boolean }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="10" fill={fill} fillOpacity="0.14" stroke={fill} strokeOpacity="0.7" strokeWidth="1.5" />
      {show && <T x={x} y={sub ? y - 2 : y + 4} size={12} color={INK} weight={600}>{label}</T>}
      {show && sub && <T x={x} y={y + 14} size={10}>{sub}</T>}
    </g>
  );
}

// mV -> y for the action potential plot
const apY = (mv: number) => 90 + (20 - mv) * 3.18;
export function CardiacApArt({ showLabels }: { showLabels: boolean }) {
  const d = `M80 ${apY(-90)} L150 ${apY(-90)} L160 ${apY(20)} L185 ${apY(5)} C220 ${apY(2)} 380 ${apY(0)} 420 ${apY(-12)} C470 ${apY(-35)} 520 ${apY(-80)} 565 ${apY(-90)} L760 ${apY(-90)}`;
  return (
    <g>
      <Axes x0={80} y0={470} x1={780} y1={60} xl="" yl="Membrane potential (mV)" />
      <T x={775} y={488} anchor="end" size={11}>time (ventricular myocyte)</T>
      {[20, 0, -40, -90].map((mv) => (
        <g key={mv}><line x1={74} x2={80} y1={apY(mv)} y2={apY(mv)} stroke={INK} strokeOpacity="0.5" /><T x={70} y={apY(mv) + 4} anchor="end" size={10}>{mv}</T><line x1={80} x2={560} y1={apY(mv)} y2={apY(mv)} stroke={LINE} strokeDasharray="3 6" /></g>
      ))}
      <path d={d} stroke={RED} strokeWidth="4" fill="none" strokeLinejoin="round" />
      {showLabels && (
        <g>
          <T x={140} y={250} anchor="end" size={11} color={BLUE}>Na+ in</T>
          <T x={300} y={190} size={11} color={AMBER}>plateau: Ca2+ in = K+ out</T>
          <T x={545} y={260} anchor="start" size={11} color={TEAL}>K+ out</T>
          <T x={660} y={412} size={11} color={TEAL}>IK1, Na+/K+-ATPase</T>
        </g>
      )}
      {/* ERP bar */}
      <line x1={155} x2={505} y1={500} y2={500} stroke={VIOLET} strokeWidth="6" strokeLinecap="round" opacity="0.6" />
      {showLabels && <T x={330} y={520} size={10}>effective refractory period</T>}
      {/* SA node inset */}
      <rect x={560} y={62} width={220} height={150} rx="10" fill="hsl(var(--muted) / 0.4)" stroke={LINE} />
      <path d="M575 180 C610 168 625 150 640 136 L652 92 C665 100 680 130 690 175 C715 166 735 148 748 138 L758 98" stroke={AMBER} strokeWidth="3" fill="none" />
      <line x1={575} x2={765} y1={136} y2={136} stroke={LINE} strokeDasharray="3 5" />
      {showLabels && <T x={670} y={202} size={10}>pacemaker cell: If (phase 4), Ca2+ upstroke</T>}
    </g>
  );
}

// PV loop helpers: V (mL) -> x, P (mmHg) -> y
const vx = (v: number) => 140 + (v - 40) * 5;
const py = (p: number) => 470 - p * 3;
export function PvLoopArt({ showLabels }: { showLabels: boolean }) {
  const loop = `M${vx(120)} ${py(10)} L${vx(120)} ${py(80)} C${vx(110)} ${py(115)} ${vx(85)} ${py(124)} ${vx(70)} ${py(120)} C${vx(58)} ${py(114)} ${vx(52)} ${py(104)} ${vx(50)} ${py(95)} L${vx(50)} ${py(5)} C${vx(70)} ${py(3)} ${vx(100)} ${py(5)} ${vx(120)} ${py(10)} Z`;
  return (
    <g>
      <Defs />
      <Axes x0={110} y0={480} x1={760} y1={70} xl="Left ventricular volume (mL)" yl="LV pressure (mmHg)" />
      {[40, 60, 80, 100, 120, 140].map((v) => <g key={v}><line x1={vx(v)} x2={vx(v)} y1={480} y2={486} stroke={INK} strokeOpacity="0.5" /><T x={vx(v)} y={500} size={10}>{v}</T></g>)}
      {[0, 40, 80, 120].map((p) => <g key={p}><line x1={104} x2={110} y1={py(p)} y2={py(p)} stroke={INK} strokeOpacity="0.5" /><T x={100} y={py(p) + 4} anchor="end" size={10}>{p}</T></g>)}
      {/* ESPVR and EDPVR */}
      <line x1={vx(15)} y1={py(0)} x2={vx(64)} y2={py(125)} stroke={VIOLET} strokeWidth="2" strokeDasharray="6 5" />
      <path d={`M${vx(40)} ${py(2)} C${vx(90)} ${py(5)} ${vx(125)} ${py(12)} ${vx(150)} ${py(30)}`} stroke={TEAL} strokeWidth="2" strokeDasharray="6 5" fill="none" />
      <path d={loop} fill="hsl(4 74% 58% / 0.12)" stroke={RED} strokeWidth="4" strokeLinejoin="round" />
      <Arrow d={`M${vx(120) + 18} ${py(30)} L${vx(120) + 18} ${py(70)}`} />
      <Arrow d={`M${vx(50) - 18} ${py(70)} L${vx(50) - 18} ${py(25)}`} />
      {showLabels && (
        <g>
          <T x={vx(64) + 6} y={py(125) - 6} anchor="start" size={10} color={VIOLET}>ESPVR (contractility)</T>
          <T x={vx(150)} y={py(30) - 8} anchor="end" size={10} color={TEAL}>EDPVR (compliance)</T>
          <line x1={vx(50)} x2={vx(120)} y1={510} y2={510} stroke={INK} strokeOpacity="0.5" />
          <T x={vx(85)} y={526} size={10}>stroke volume = EDV - ESV (about 70 mL)</T>
          <T x={vx(85)} y={py(60)} size={11} color={INK}>stroke work</T>
        </g>
      )}
    </g>
  );
}

const ox = (p: number) => 100 + p * 6;
const oy = (s: number) => 470 - s * 3.8;
const hill = (p: number, p50: number, n = 2.7) => (100 * p ** n) / (p ** n + p50 ** n);
const curve = (f: (p: number) => number) => Array.from({ length: 101 }, (_, i) => `${i ? "L" : "M"}${ox(i).toFixed(1)} ${oy(f(i)).toFixed(1)}`).join(" ");
export function O2HbArt({ showLabels }: { showLabels: boolean }) {
  return (
    <g>
      <Axes x0={100} y0={470} x1={720} y1={70} xl="PO2 (mmHg)" yl="Hemoglobin O2 saturation (%)" />
      {[0, 20, 40, 60, 80, 100].map((p) => <g key={p}><line x1={ox(p)} x2={ox(p)} y1={470} y2={476} stroke={INK} strokeOpacity="0.5" /><T x={ox(p)} y={490} size={10}>{p}</T></g>)}
      {[0, 25, 50, 75, 100].map((s) => <g key={s}><line x1={94} x2={100} y1={oy(s)} y2={oy(s)} stroke={INK} strokeOpacity="0.5" /><T x={90} y={oy(s) + 4} anchor="end" size={10}>{s}</T><line x1={100} x2={720} y1={oy(s)} y2={oy(s)} stroke={LINE} strokeDasharray="3 6" /></g>)}
      <path d={curve((p) => (100 * p) / (p + 2.8))} stroke={VIOLET} strokeWidth="2.5" fill="none" strokeDasharray="7 4" />
      <path d={curve((p) => hill(p, 20))} stroke={BLUE} strokeWidth="2.5" fill="none" />
      <path d={curve((p) => hill(p, 32))} stroke={AMBER} strokeWidth="2.5" fill="none" />
      <path d={curve((p) => 0.5 * hill(p, 15, 2.2))} stroke={GREEN} strokeWidth="2.5" fill="none" strokeDasharray="2 4" />
      <path d={curve((p) => hill(p, 26.8))} stroke={RED} strokeWidth="4" fill="none" />
      <line x1={ox(26.8)} x2={ox(26.8)} y1={oy(50)} y2={470} stroke={RED} strokeDasharray="4 4" opacity="0.6" />
      {showLabels && (
        <g>
          <T x={ox(26.8)} y={462} size={10} color={RED}>26.8</T>
          <T x={600} y={86} size={11} color={RED} weight={600}>normal adult Hb</T>
          <T x={480} y={262} anchor="start" size={10} color={AMBER}>right: up CO2, H+, 2,3-BPG, temp</T>
        </g>
      )}
    </g>
  );
}

const lv = (l: number) => 480 - l * 65;
export function LungVolumesArt({ showLabels }: { showLabels: boolean }) {
  const pts: string[] = [];
  for (let x = 60; x <= 330; x += 3) { const t = (x - 60) / 270; pts.push(`${x} ${lv(2.4 + 0.25 * (1 - Math.cos(t * Math.PI * 8)))}`); }
  const trace = `M${pts.join(" L")} C350 ${lv(2.4)} 360 ${lv(6)} 380 ${lv(6)} C400 ${lv(6)} 410 ${lv(1.2)} 440 ${lv(1.2)} C465 ${lv(1.2)} 480 ${lv(2.4)} 520 ${lv(2.4)}`;
  const band = (y1: number, y2: number, fill: string) => <rect x={540} y={lv(y2)} width={60} height={lv(y1) - lv(y2)} fill={fill} fillOpacity="0.22" stroke={fill} strokeOpacity="0.6" />;
  return (
    <g>
      <Axes x0={50} y0={480} x1={780} y1={70} xl="Time" yl="Lung volume (L)" />
      {[0, 1.2, 2.4, 2.9, 6].map((l) => <g key={l}><line x1={44} x2={50} y1={lv(l)} y2={lv(l)} stroke={INK} strokeOpacity="0.5" /><T x={40} y={lv(l) + 4} anchor="end" size={10}>{l}</T><line x1={50} x2={780} y1={lv(l)} y2={lv(l)} stroke={LINE} strokeDasharray="3 6" /></g>)}
      <rect x={50} y={lv(1.2)} width={730} height={lv(0) - lv(1.2)} fill="hsl(var(--muted) / 0.6)" />
      <path d={trace} stroke={BLUE} strokeWidth="3" fill="none" strokeLinejoin="round" />
      {band(2.9, 6, AMBER)}{band(2.4, 2.9, BLUE)}{band(1.2, 2.4, TEAL)}{band(0, 1.2, MUTED)}
      {/* capacities */}
      <line x1={620} x2={620} y1={lv(2.4)} y2={lv(0)} stroke={TEAL} strokeWidth="3" />
      <line x1={680} x2={680} y1={lv(6)} y2={lv(1.2)} stroke={VIOLET} strokeWidth="3" />
      <line x1={740} x2={740} y1={lv(6)} y2={lv(0)} stroke={RED} strokeWidth="3" />
      {showLabels && (
        <g>
          <T x={570} y={lv(4.45)} size={11} color={INK}>IRV</T><T x={570} y={lv(2.65) + 4} size={10} color={INK}>TV</T><T x={570} y={lv(1.8) + 4} size={11} color={INK}>ERV</T><T x={570} y={lv(0.6) + 4} size={11} color={INK}>RV</T>
          <T x={380} y={lv(6) - 8} size={10}>max inspiration</T><T x={440} y={lv(1.2) + 16} size={10}>max expiration</T>
          <T x={200} y={lv(3.3)} size={10}>quiet breathing</T>
        </g>
      )}
    </g>
  );
}

export function RaasArt({ showLabels }: { showLabels: boolean }) {
  return (
    <g>
      <Defs />
      <Box x={130} y={110} w={190} h={70} fill={AMBER} label="Kidney JG cells" sub="renin" show={showLabels} />
      <Box x={130} y={30} w={190} h={36} fill={MUTED} label="Liver: angiotensinogen" show={showLabels} />
      <Box x={400} y={110} w={190} h={70} fill={TEAL} label="Angiotensin I" sub="ACE (lung)" show={showLabels} />
      <Box x={660} y={110} w={200} h={70} fill={RED} label="Angiotensin II" sub="AT1 receptor" show={showLabels} />
      <Arrow d="M130 48 L130 72" />
      <Arrow d="M228 110 L300 110" />
      <Arrow d="M498 110 L555 110" />
      {/* effects */}
      <path d="M660 146 L660 210 L150 210 L150 300" stroke={MUTED} strokeWidth="2" fill="none" markerEnd="url(#arr2)" />
      <Arrow d="M340 210 L340 300" /><Arrow d="M520 210 L520 300" /><Arrow d="M690 210 L690 300" />
      <Box x={150} y={340} w={160} h={70} fill={RED} label="Arterioles" sub="vasoconstriction" show={showLabels} />
      <Box x={340} y={340} w={160} h={70} fill={AMBER} label="Adrenal cortex" sub="aldosterone" show={showLabels} />
      <Box x={520} y={340} w={160} h={70} fill={BLUE} label="Hypothalamus" sub="ADH, thirst" show={showLabels} />
      <Box x={690} y={340} w={160} h={70} fill={TEAL} label="Proximal tubule" sub="NHE3" show={showLabels} />
      <Box x={400} y={480} w={260} h={56} fill={GREEN} label="ANP / BNP (atrial stretch)" sub="inhibit renin and aldosterone" show={showLabels} />
      <path d="M270 480 L130 480 L130 150" stroke={GREEN} strokeWidth="2" strokeDasharray="6 5" fill="none" markerEnd="url(#arr2)" />
      {showLabels && (
        <g>
          <T x={265} y={100} size={10} color={RED}>aliskiren</T>
          <T x={527} y={100} size={10} color={RED}>ACE inhibitors</T>
          <T x={660} y={170} size={10} color={RED}>ARBs block</T>
          <T x={340} y={392} size={10} color={RED}>spironolactone blocks receptor</T>
          <T x={400} y={150} size={10}>also degrades bradykinin</T>
          <T x={400} y={240} size={11}>blood pressure and volume rise; renin falls (negative feedback)</T>
        </g>
      )}
    </g>
  );
}

export function AdrenalArt({ showLabels }: { showLabels: boolean }) {
  const layers: [number, number, string, string][] = [
    [60, 80, "hsl(30 30% 55%)", "capsule"],
    [80, 160, "hsl(45 80% 60%)", "glomerulosa"],
    [160, 260, "hsl(36 80% 52%)", "fasciculata"],
    [260, 310, "hsl(20 70% 50%)", "reticularis"],
    [310, 440, "hsl(350 45% 45%)", "medulla"],
  ];
  return (
    <g>
      <Defs />
      {layers.map(([y1, y2, c, n]) => (
        <g key={n}>
          <rect x={160} y={y1} width={480} height={y2 - y1} fill={c} fillOpacity={n === "capsule" ? 0.5 : 0.28} stroke={c} />

        </g>
      ))}
      {/* cell texture */}
      {Array.from({ length: 12 }, (_, i) => <ellipse key={`g${i}`} cx={190 + i * 38} cy={120} rx={14} ry={10} fill="none" stroke="hsl(45 80% 40%)" strokeOpacity="0.5" />)}
      {Array.from({ length: 12 }, (_, i) => <rect key={`f${i}`} x={180 + i * 38} y={168} width={18} height={84} rx="6" fill="none" stroke="hsl(36 80% 35%)" strokeOpacity="0.45" />)}
      {Array.from({ length: 16 }, (_, i) => <path key={`r${i}`} d={`M${172 + i * 29} 268 l14 18 l-10 18`} fill="none" stroke="hsl(20 70% 35%)" strokeOpacity="0.5" />)}
      {Array.from({ length: 22 }, (_, i) => <circle key={`m${i}`} cx={185 + (i % 11) * 43} cy={340 + Math.floor(i / 11) * 55} r={12} fill="hsl(350 45% 45% / 0.3)" stroke="hsl(350 45% 35%)" strokeOpacity="0.5" />)}
      {showLabels && (
        <g>
          <T x={150} y={124} anchor="end" size={11} color={INK} weight={600}>aldosterone - salt</T>
          <T x={150} y={214} anchor="end" size={11} color={INK} weight={600}>cortisol - sugar</T>
          <T x={150} y={289} anchor="end" size={11} color={INK} weight={600}>androgens - sex</T>
          <T x={150} y={400} anchor="end" size={11} color={INK} weight={600}>epinephrine, NE</T>
          <T x={400} y={470} size={10}>regulators: angiotensin II / K+ (glomerulosa); ACTH (fasciculata, reticularis); sympathetic preganglionic (medulla)</T>
        </g>
      )}
      {/* HPA axis */}
      <Box x={700} y={110} w={150} h={36} fill={VIOLET} label="Hypothalamus: CRH" show={showLabels} />
      <Box x={700} y={200} w={150} h={36} fill={VIOLET} label="Pituitary: ACTH" show={showLabels} />
      <Arrow d="M700 130 L700 180" />
      <Arrow d="M640 210 L600 210" />
      <path d="M660 240 C620 300 760 300 770 200 C775 150 770 120 778 110" stroke={RED} strokeWidth="1.5" strokeDasharray="5 4" fill="none" markerEnd="url(#arr2)" />
      {showLabels && <T x={720} y={300} size={10} color={RED}>cortisol negative feedback</T>}
    </g>
  );
}

export function SpinalCordArt({ showLabels }: { showLabels: boolean }) {
  const cx = 400, cy = 270;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={260} ry={190} fill="hsl(36 40% 70% / 0.12)" stroke={INK} strokeOpacity="0.5" strokeWidth="2" />
      <path d={`M${cx} ${cy - 190} L${cx} ${cy - 120}`} stroke={INK} strokeOpacity="0.4" />
      <path d={`M${cx - 8} ${cy + 190} L${cx} ${cy + 140} L${cx + 8} ${cy + 190}`} fill="hsl(var(--card))" stroke={INK} strokeOpacity="0.4" />
      {/* tracts */}
      <path d={`M${cx - 6} ${cy - 186} C${cx - 60} ${cy - 180} ${cx - 70} ${cy - 120} ${cx - 25} ${cy - 40} L${cx - 6} ${cy - 40} Z`} fill={BLUE} fillOpacity="0.28" />
      <path d={`M${cx + 6} ${cy - 186} C${cx + 60} ${cy - 180} ${cx + 70} ${cy - 120} ${cx + 25} ${cy - 40} L${cx + 6} ${cy - 40} Z`} fill={BLUE} fillOpacity="0.28" />
      <ellipse cx={cx - 170} cy={cy - 40} rx={60} ry={55} fill={RED} fillOpacity="0.26" />
      <ellipse cx={cx + 170} cy={cy - 40} rx={60} ry={55} fill={RED} fillOpacity="0.26" />
      <path d={`M${cx - 240} ${cy + 40} C${cx - 220} ${cy + 120} ${cx - 160} ${cy + 160} ${cx - 90} ${cy + 175} L${cx - 110} ${cy + 80} Z`} fill={GREEN} fillOpacity="0.28" />
      <path d={`M${cx + 240} ${cy + 40} C${cx + 220} ${cy + 120} ${cx + 160} ${cy + 160} ${cx + 90} ${cy + 175} L${cx + 110} ${cy + 80} Z`} fill={GREEN} fillOpacity="0.28" />
      {/* grey matter butterfly */}
      <path d={`M${cx} ${cy - 15} C${cx - 20} ${cy - 30} ${cx - 40} ${cy - 120} ${cx - 80} ${cy - 150} C${cx - 95} ${cy - 135} ${cx - 85} ${cy - 70} ${cx - 70} ${cy - 30}
        C${cx - 90} ${cy - 20} ${cx - 95} ${cy} ${cx - 80} ${cy + 10} C${cx - 110} ${cy + 40} ${cx - 120} ${cy + 90} ${cx - 85} ${cy + 110} C${cx - 50} ${cy + 100} ${cx - 25} ${cy + 40} ${cx} ${cy + 25}
        C${cx + 25} ${cy + 40} ${cx + 50} ${cy + 100} ${cx + 85} ${cy + 110} C${cx + 120} ${cy + 90} ${cx + 110} ${cy + 40} ${cx + 80} ${cy + 10} C${cx + 95} ${cy} ${cx + 90} ${cy - 20} ${cx + 70} ${cy - 30}
        C${cx + 85} ${cy - 70} ${cx + 95} ${cy - 135} ${cx + 80} ${cy - 150} C${cx + 40} ${cy - 120} ${cx + 20} ${cy - 30} ${cx} ${cy - 15} Z`} fill="hsl(var(--muted-foreground) / 0.25)" stroke={INK} strokeOpacity="0.4" />
      <circle cx={cx} cy={cy + 5} r={6} fill="hsl(var(--card))" stroke={INK} strokeOpacity="0.4" />
      {/* lateral horn */}
      <path d={`M${cx + 70} ${cy - 30} l22 -8 l-6 22 z`} fill={AMBER} fillOpacity="0.6" />
      {/* anterior spinal artery */}
      <circle cx={cx} cy={cy + 196} r={9} fill={RED} />
      <circle cx={cx - 50} cy={cy - 192} r={6} fill={RED} opacity="0.7" /><circle cx={cx + 50} cy={cy - 192} r={6} fill={RED} opacity="0.7" />
      {/* hemisection hatch */}
      <path d={`M${cx + 10} ${cy - 186} L${cx + 10} ${cy + 188}`} stroke={MUTED} strokeDasharray="8 6" />
      <rect x={cx + 10} y={cy - 186} width={250} height={374} fill="url(#hatch2)" opacity="0.35" />
      <defs><pattern id="hatch2" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke={MUTED} strokeWidth="2" /></pattern></defs>
      {showLabels && (
        <g>
          <T x={cx} y={36} size={11} color={INK}>POSTERIOR</T><T x={cx} y={528} size={11} color={INK}>ANTERIOR</T>
          <T x={cx - 30} y={cy - 70} anchor="end" size={10}>gracilis</T><T x={cx - 60} y={cy - 150} anchor="end" size={10}>cuneatus</T>
          <T x={cx} y={cy + 228} size={10}>anterior spinal artery</T>
          <T x={cx + 140} y={cy + 215} anchor="start" size={10}>shaded = right hemisection</T>
        </g>
      )}
    </g>
  );
}

export function WillisArt({ showLabels }: { showLabels: boolean }) {
  const v = (w: number) => ({ stroke: RED, strokeWidth: w, fill: "none", strokeLinecap: "round" as const });
  return (
    <g>
      {/* brain outline from below */}
      <ellipse cx={400} cy={290} rx={330} ry={245} fill="hsl(330 30% 70% / 0.08)" stroke={LINE} strokeWidth="2" />
      <ellipse cx={400} cy={455} rx={180} ry={70} fill="hsl(330 30% 70% / 0.08)" stroke={LINE} strokeDasharray="5 5" />
      {/* vertebral and basilar */}
      <path d="M350 530 C360 490 380 470 397 450" {...v(8)} />
      <path d="M450 530 C440 490 420 470 403 450" {...v(8)} />
      <path d="M400 452 L400 330" {...v(10)} />
      {/* PICA, AICA, SCA */}
      <path d="M440 500 C480 500 500 510 540 520" {...v(4)} /><path d="M360 500 C320 500 300 510 260 520" {...v(4)} />
      <path d="M400 430 C450 430 480 440 530 450" {...v(4)} /><path d="M400 430 C350 430 320 440 270 450" {...v(4)} />
      <path d="M400 340 C450 345 490 355 540 365" {...v(4)} /><path d="M400 340 C350 345 310 355 260 365" {...v(4)} />
      {/* PCAs */}
      <path d="M400 330 C360 320 320 330 300 300 M300 300 C270 340 230 370 180 390" {...v(6)} />
      <path d="M400 330 C440 320 480 330 500 300 M500 300 C530 340 570 370 620 390" {...v(6)} />
      {/* PCom */}
      <path d="M300 300 L300 205" {...v(4)} /><path d="M500 300 L500 205" {...v(4)} />
      {/* ICA + MCA + ACA */}
      <circle cx={300} cy={205} r={11} fill={RED} /><circle cx={500} cy={205} r={11} fill={RED} />
      <path d="M300 205 C240 200 200 190 120 170" {...v(7)} /><path d="M500 205 C560 200 600 190 680 170" {...v(7)} />
      <path d="M300 205 C330 170 370 150 385 140 L385 60" {...v(5)} /><path d="M500 205 C470 170 430 150 415 140 L415 60" {...v(5)} />
      <path d="M385 140 L415 140" {...v(5)} />
      {/* lenticulostriates */}
      {[0, 1, 2].map((i) => <path key={i} d={`M${230 - i * 18} ${194 - i * 3} l-6 -26`} stroke={RED} strokeWidth="1.5" />)}
      {[0, 1, 2].map((i) => <path key={i} d={`M${570 + i * 18} ${194 - i * 3} l6 -26`} stroke={RED} strokeWidth="1.5" />)}
      {/* CN III between PCA and SCA */}
      <path d="M330 340 C320 360 300 380 280 395" stroke={AMBER} strokeWidth="3" fill="none" />
      {showLabels && (
        <g>
          <T x={200} y={160} size={9}>lenticulostriate</T>
          <T x={560} y={370} anchor="start" size={10}>superior cerebellar</T>
          <T x={280} y={412} anchor="end" size={10} color={AMBER}>CN III</T>
          <T x={350} y={530} anchor="end" size={10}>vertebral</T>
        </g>
      )}
    </g>
  );
}

export function BilirubinArt({ showLabels }: { showLabels: boolean }) {
  return (
    <g>
      <Defs />
      <Box x={110} y={120} w={170} h={86} fill={RED} label="Spleen macrophage" sub="heme to bilirubin" show={showLabels} />
      <Box x={290} y={120} w={150} h={86} fill={AMBER} label="Blood" sub="unconjugated + albumin" show={showLabels} />
      <Box x={470} y={120} w={170} h={86} fill={TEAL} label="Hepatocyte" sub="glucuronidation" show={showLabels} />
      <Box x={650} y={120} w={150} h={86} fill={GREEN} label="Bile canaliculus" sub="conjugated" show={showLabels} />
      <Arrow d="M196 120 L212 120" /><Arrow d="M366 120 L382 120" /><Arrow d="M556 120 L572 120" />
      {/* bile duct to gut */}
      <path d="M650 164 L650 270" stroke={GREEN} strokeWidth="10" strokeOpacity="0.45" fill="none" />
      <path d="M650 330 L650 360 C650 400 600 420 540 420" stroke={GREEN} strokeWidth="10" strokeOpacity="0.45" fill="none" />
      <rect x={620} y={275} width={60} height={50} rx="10" fill="none" stroke={MUTED} strokeDasharray="4 4" />
      <Box x={420} y={420} w={220} h={86} fill="hsl(25 55% 40%)" label="Intestine (bacteria)" sub="urobilinogen to stercobilin" show={showLabels} />
      <Box x={160} y={420} w={170} h={86} fill={AMBER} label="Kidney" sub="urobilin (yellow urine)" show={showLabels} />
      <path d="M310 420 L247 420" stroke={MUTED} strokeWidth="2" fill="none" markerEnd="url(#arr2)" />
      <path d="M420 376 C420 300 470 240 470 166" stroke={MUTED} strokeWidth="2" strokeDasharray="6 5" fill="none" markerEnd="url(#arr2)" />
      <Arrow d="M420 464 L420 520" />
      {/* RBC icons */}
      {[0, 1, 2].map((i) => <ellipse key={i} cx={60 + i * 34} cy={40} rx={15} ry={9} fill={RED} fillOpacity="0.6" />)}
      <Arrow d="M110 52 L110 76" />
      {showLabels && (
        <g>
          <T x={150} y={40} anchor="start" size={10}>senescent RBCs</T>
          <T x={470} y={186} size={10}>UGT1A1</T>
          <T x={655} y={186} anchor="start" size={10}>MRP2</T>
          <T x={690} y={304} anchor="start" size={10}>CBD</T>
          <T x={430} y={300} anchor="start" size={10}>enterohepatic</T>
          <T x={430} y={536} anchor="start" size={10}>stercobilin: brown stool</T>
        </g>
      )}
    </g>
  );
}

export const ART2: Record<string, (p: { showLabels: boolean }) => JSX.Element> = {
  "cardiac-ap": CardiacApArt, "pv-loop": PvLoopArt, "o2-hb": O2HbArt, "lung-volumes": LungVolumesArt,
  raas: RaasArt, adrenal: AdrenalArt, "spinal-cord": SpinalCordArt, willis: WillisArt, bilirubin: BilirubinArt,
};
