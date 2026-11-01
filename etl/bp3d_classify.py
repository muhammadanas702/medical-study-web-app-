import collections, zipfile, os, re
RAW = os.environ.get("RAW_DIR", "/tmp/data")
def rows(f): return [l.rstrip("\n").split("\t") for l in open(os.path.join(RAW, f), encoding="utf-8")][1:]
RULES = [
 ("digestive", r"hepat|biliary|liver|\\bbile|pancrea|gallbladder"),
 ("integumentary", r"\bskin\b|integument|\bhair\b"),
 ("endocrine", r"thyroid gland|lobe of thyroid|parathyroid|adrenal|suprarenal gland|pituitar|hypophys|pineal|thymus"),
 ("cardiovascular", r"arter|\bvein|venous|vena\b|aort|coronary sinus|\bheart|myocard|atrium|cardiac|left ventricle|right ventricle|valve|pulmonary trunk|costocervical trunk|thyrocervical trunk|brachiocephalic trunk|celiac trunk|vascular|auricle of"),
 ("muscular", r"muscle|tendon|aponeuro|rectus\b|oblique\b|levator|depressor|psoas|pectoralis|obturator|anconeus|subclavius|transversus|brachialis|tensor|deltoid|biceps|triceps|gluteus|trapezius|latissimus|serratus|sartorius|gracilis|soleus|gastrocnemius|masseter|temporalis|pterygoid|sphincter|constrictor|scalen|intercostal|piriformis|gemellus|quadratus|iliacus|platysma|buccinator|orbicularis|sternocleidomastoid|supraspinatus|infraspinatus|teres|subscapularis|coracobrachialis|pronator|supinator|flexor|extensor|abductor|adductor|lumbrical|interosse|popliteus|plantaris|tibialis|peroneus|fibularis|vastus|semitend|semimembran|pectineus|digastric|mylohyoid|geniohyoid|stylohyoid|omohyoid|sternohyoid|sternothyroid|thyrohyoid|rhomboid|splenius|erector|multifid|rotatores|cremaster|diaphragm"),
 ("nervous", r"eyeball|\blens\b|cornea|retina|iris\b|vitreous|sclera|choroid of|lacrimal|cochlea|vestibul|semicircular|tympan|optic"),
 ("skeletal", r"bone|vertebra|\brib\b|costal cartilage|sternum|skull|cranium|mandible|maxilla|femur|tibia\b|fibula\b|patella|humerus|radius|ulna\b|scapula|clavicle|ilium|ischium|pubis|sacrum|coccyx|carpal|tarsal|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|calcaneus|talus|cuboid|cuneiform|navicular|phalan|hyoid|cartilage|ligament|meniscus|intervertebral|symphysis|joint|\bhip\b|ossicle|malleus|incus|stapes|^atlas$|^axis$|fascia|retinaculum|iliotibial|labrum"),
 ("nervous", r"nerve|brain|cerebr|cerebell|spinal cord|ganglion|medulla oblongata|\bpons\b|midbrain|thalam|hippocamp|gyrus|lobule|colliculus|capsule|ventricle|aqueduct|insula|amygdala|putamen|caudate|globus|corpus callosum|fornix|brainstem|plexus|neuraxis|cingulate|cuneus|precuneus|uncus|claustrum|nucleus"),
 ("respiratory", r"lung|bronch|trache|laryn|pharyn|nasal|nose|pleura|epiglott"),
 ("digestive", r"stomach|intestin|colon|cecum|caecum|appendix|duoden|jejun|ileum|rectum|anal|esophag|oesophag|liver|hepat|gallbladder|bile|biliary|pancrea|tongue|tooth|teeth|palat|\blip\b|salivary|parotid|submandibular gland|sublingual gland|mouth|gingiva|spleen|mesenter|taenia|omentum|mesocolon"),
 ("urinary", r"kidney|renal|ureter|urinary bladder|urethra"),
 ("reproductive", r"prostat|testis|uter|ovar|vagin|penis|seminal|ductus deferens|epididym"),
]
def classify():
    z = zipfile.ZipFile(os.path.join(RAW, "bp3d_partof_obj.zip"))
    fjs = {os.path.basename(n)[:-4]: n for n in z.namelist() if n.endswith(".obj")}
    cel = collections.defaultdict(set); fjc = collections.defaultdict(set); cname = {}
    for f in ("bp3d_partof_element_parts.txt", "bp3d_isa_element_parts.txt"):
        for c, n, fj in rows(f): cel[c].add(fj); fjc[fj].add(c); cname[c] = n
    out = {}
    for fj in fjs:
        cs = sorted(fjc.get(fj, []), key=lambda c: len(cel[c]))
        if not cs: continue
        leaf = cs[0]; sysname = None
        for c in cs:  # most specific first
            nm = cname[c].lower().strip()
            for s, rx in RULES:
                if re.search(rx, nm): sysname = s; break
            if sysname: break
        out[fj] = (leaf, cname[leaf], sysname or "other", fjs[fj])
    return out, cel, cname
if __name__ == "__main__":
    out, _, _ = classify()
    cnt = collections.Counter(v[2] for v in out.values()); print(cnt)
    for fj, v in list(out.items()):
        if v[2] == "other": print(v[1])
