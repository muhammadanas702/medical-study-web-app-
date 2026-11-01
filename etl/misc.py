"""MedlinePlus topics, ICD-10-CM FY2027, FDA device classification, NDC directory, drug shortages, NBME lab values."""
import zipfile, xml.etree.ElementTree as ET, glob
from common import *

def medline(c):
    c.executescript("DROP TABLE IF EXISTS topics; CREATE TABLE topics(id TEXT PRIMARY KEY, title TEXT, url TEXT, meta_desc TEXT, summary TEXT, also_called TEXT, groups TEXT, mesh_ids TEXT, institute TEXT, created TEXT); DROP TABLE IF EXISTS topic_mesh; CREATE TABLE topic_mesh(topic_id TEXT, mesh_id TEXT); CREATE INDEX tm_mesh ON topic_mesh(mesh_id);")
    r = ET.parse(os.path.join(RAW, "mplus.xml")).getroot()
    n = 0
    for e in r.findall("health-topic"):
        if e.get("language") != "English": continue
        mesh = [d.get("id") for d in e.findall("mesh-heading/descriptor")]
        inst = e.find("primary-institute")
        c.execute("INSERT INTO topics VALUES(?,?,?,?,?,?,?,?,?,?)", (e.get("id"), e.get("title"), e.get("url"), e.get("meta-desc"),
            e.findtext("full-summary"), J([a.text for a in e.findall("also-called")]), J([g.text for g in e.findall("group")]), J(mesh),
            inst.text if inst is not None else None, e.get("date-created")))
        for m in mesh: c.execute("INSERT INTO topic_mesh VALUES(?,?)", (e.get("id"), m))
        n += 1
    meta(c, "medlineplus", {"source":"MedlinePlus, U.S. National Library of Medicine","url":"https://medlineplus.gov/xml.html","file":"mplus_topics_2026-10-31.xml","topics":n})
    print("medline", n)

CHAPTERS = [("A00","B99","Certain infectious and parasitic diseases"),("C00","D49","Neoplasms"),("D50","D89","Diseases of the blood and blood-forming organs and certain disorders involving the immune mechanism"),
 ("E00","E89","Endocrine, nutritional and metabolic diseases"),("F01","F99","Mental, behavioral and neurodevelopmental disorders"),("G00","G99","Diseases of the nervous system"),
 ("H00","H59","Diseases of the eye and adnexa"),("H60","H95","Diseases of the ear and mastoid process"),("I00","I99","Diseases of the circulatory system"),("J00","J99","Diseases of the respiratory system"),
 ("K00","K95","Diseases of the digestive system"),("L00","L99","Diseases of the skin and subcutaneous tissue"),("M00","M99","Diseases of the musculoskeletal system and connective tissue"),
 ("N00","N99","Diseases of the genitourinary system"),("O00","O9A","Pregnancy, childbirth and the puerperium"),("P00","P96","Certain conditions originating in the perinatal period"),
 ("Q00","Q99","Congenital malformations, deformations and chromosomal abnormalities"),("R00","R99","Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified"),
 ("S00","T88","Injury, poisoning and certain other consequences of external causes"),("U00","U85","Codes for special purposes"),("V00","Y99","External causes of morbidity"),
 ("Z00","Z99","Factors influencing health status and contact with health services")]

def chapter(code):
    k = code[:3]
    for i,(a,b,t) in enumerate(CHAPTERS):
        if a <= k <= b: return i+1
    return None

def icd(c):
    c.executescript("DROP TABLE IF EXISTS icd10; CREATE TABLE icd10(code TEXT PRIMARY KEY, display TEXT, billable INTEGER, short TEXT, title TEXT, chapter INTEGER, parent TEXT); DROP TABLE IF EXISTS icd10_chapters; CREATE TABLE icd10_chapters(n INTEGER PRIMARY KEY, start TEXT, end TEXT, title TEXT); DROP TABLE IF EXISTS icd10_fts;")
    for i,(a,b,t) in enumerate(CHAPTERS): c.execute("INSERT INTO icd10_chapters VALUES(?,?,?,?)", (i+1,a,b,t))
    rows = []
    for line in open(os.path.join(RAW, "icd10", "Code Descriptions", "icd10cm_order_2027.txt"), encoding="latin-1"):
        code = line[6:13].strip(); bill = int(line[14]); short = line[16:76].strip(); title = line[77:].strip()
        disp = code[:3] + ("." + code[3:] if len(code) > 3 else "")
        parent = None
        if len(code) > 3: parent = code[:-1]
        rows.append((code, disp, bill, short, title, chapter(code), parent))
    codes = {r[0] for r in rows}
    rows = [(r[0],r[1],r[2],r[3],r[4],r[5], (r[6] if r[6] in codes else (r[6][:-1] if r[6] and r[6][:-1] in codes else (r[6][:-2] if r[6] and r[6][:-2] in codes else None)))) for r in rows]
    c.executemany("INSERT INTO icd10 VALUES(?,?,?,?,?,?,?)", rows)
    c.execute("CREATE INDEX icd_parent ON icd10(parent)")
    c.execute("CREATE VIRTUAL TABLE icd10_fts USING fts5(code UNINDEXED, display, title, tokenize='porter unicode61')")
    c.execute("INSERT INTO icd10_fts SELECT code, display, title FROM icd10")
    meta(c, "icd10", {"source":"ICD-10-CM FY2027 code descriptions, Centers for Medicare & Medicaid Services / CDC NCHS","url":"https://www.cms.gov/medicare/coding-billing/icd-10-codes","effective":"October 1, 2026 - September 30, 2027","codes":len(rows)})
    print("icd", len(rows))

def fda_json(name):
    z = zipfile.ZipFile(glob.glob(os.path.join(RAW, "fda", name))[0]); return json.load(z.open(z.namelist()[0]))

def devices(c):
    d = fda_json("device-classification-*.zip")
    c.executescript("DROP TABLE IF EXISTS devices; CREATE TABLE devices(code TEXT PRIMARY KEY, name TEXT, class TEXT, panel TEXT, specialty TEXT, regulation TEXT, definition TEXT, implant INTEGER, life_sustain INTEGER, submission TEXT); DROP TABLE IF EXISTS devices_fts;")
    sub = {"1":"510(k)","2":"PMA","3":"Contact ODE","4":"510(k) exempt","5":"Enforcement discretion","6":"Unclassified","7":"Not FDA regulated","8":"HDE"}
    n = 0
    for r in d["results"]:
        if not r.get("device_name"): continue
        c.execute("INSERT OR REPLACE INTO devices VALUES(?,?,?,?,?,?,?,?,?,?)", (r["product_code"], clean(r["device_name"]), r.get("device_class"), r.get("review_panel"),
          r.get("medical_specialty_description"), r.get("regulation_number"), clean(r.get("definition")) or None, r.get("implant_flag")=="Y", r.get("life_sustain_support_flag")=="Y", sub.get(str(r.get("submission_type_id")))))
        n += 1
    c.execute("CREATE VIRTUAL TABLE devices_fts USING fts5(code UNINDEXED, name, definition, specialty, tokenize='porter unicode61')")
    c.execute("INSERT INTO devices_fts SELECT code, name, coalesce(definition,''), coalesce(specialty,'') FROM devices")
    meta(c, "devices", {"source":"openFDA device classification (U.S. Food and Drug Administration)","url":"https://open.fda.gov/apis/device/classification/","export_date":d["meta"].get("last_updated"),"devices":n})
    print("devices", n)

def ndc(c):
    d = fda_json("drug-ndc-*.zip")
    c.executescript("DROP TABLE IF EXISTS ndc; CREATE TABLE ndc(product_ndc TEXT PRIMARY KEY, generic TEXT, generic_key TEXT, brand TEXT, labeler TEXT, dosage_form TEXT, route TEXT, strength TEXT, dea TEXT, marketing TEXT, product_type TEXT, set_id TEXT);")
    n = 0
    for r in d["results"]:
        if r.get("product_type") not in ("HUMAN PRESCRIPTION DRUG","HUMAN OTC DRUG"): continue
        if not r.get("finished", True): continue
        g = r.get("generic_name") or ""
        strength = "; ".join(f'{a.get("name","").title()} {a.get("strength","")}' for a in r.get("active_ingredients", []))
        c.execute("INSERT OR REPLACE INTO ndc VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (r["product_ndc"], g, re.sub(r"\s+"," ",g.upper().strip()), r.get("brand_name"), r.get("labeler_name"), r.get("dosage_form"),
          ", ".join(r.get("route", [])), strength, r.get("dea_schedule"), r.get("marketing_category"), r.get("product_type"), (r.get("openfda", {}).get("spl_set_id") or [None])[0]))
        n += 1
    c.execute("CREATE INDEX ndc_key ON ndc(generic_key)"); c.execute("CREATE INDEX ndc_set ON ndc(set_id)")
    meta(c, "ndc", {"source":"openFDA NDC directory (FDA)","url":"https://open.fda.gov/apis/drug/ndc/","export_date":d["meta"].get("last_updated"),"products":n})
    print("ndc", n)

def shortages(c):
    d = fda_json("drug-shortages-*.zip")
    c.executescript("DROP TABLE IF EXISTS shortages; CREATE TABLE shortages(generic TEXT, presentation TEXT, company TEXT, status TEXT, availability TEXT, category TEXT, posted TEXT, updated TEXT, reason TEXT);")
    for r in d["results"]:
        c.execute("INSERT INTO shortages VALUES(?,?,?,?,?,?,?,?,?)", (r.get("generic_name"), r.get("presentation"), r.get("company_name"), r.get("status"), r.get("availability"),
          ", ".join(r.get("therapeutic_category", [])), r.get("initial_posting_date"), r.get("update_date"), r.get("shortage_reason")))
    meta(c, "shortages", {"source":"openFDA drug shortages (FDA)","url":"https://open.fda.gov/apis/drug/drugshortages/","export_date":d["meta"].get("last_updated"),"rows":len(d["results"])})
    print("shortages", len(d["results"]))

# NBME laboratory values, transcribed verbatim from https://www.nbme.org/laboratory-values/
LABS = [
 ("Serum","Electrolytes",[("Sodium (Na+)","136–146 mEq/L","136–146 mmol/L"),("Potassium (K+)","3.5–5.0 mEq/L","3.5–5.0 mmol/L"),("Chloride (Cl–)","95–105 mEq/L","95–105 mmol/L"),("Bicarbonate (HCO3–)","22–28 mEq/L","22–28 mmol/L"),
   ("Urea nitrogen","7–18 mg/dL","2.5–6.4 mmol/L"),("Creatinine","0.6–1.2 mg/dL","53–106 μmol/L"),("Glucose","Fasting: 70–100 mg/dL; Random, non-fasting: <140 mg/dL","3.8–5.6 mmol/L; <7.77 mmol/L"),
   ("Calcium","8.4–10.2 mg/dL","2.1–2.6 mmol/L"),("Magnesium (Mg2+)","1.5–2.0 mg/dL","0.75–1.0 mmol/L"),("Phosphorus (inorganic)","3.0–4.5 mg/dL","1.0–1.5 mmol/L")]),
 ("Serum","Hepatic",[("Alanine aminotransferase (ALT)","10–40 U/L","10–40 U/L"),("Aspartate aminotransferase (AST)","12–38 U/L","12–38 U/L"),("Alkaline phosphatase","25–100 U/L","25–100 U/L"),
   ("Bilirubin, total // direct","0.1–1.0 mg/dL // 0.0–0.3 mg/dL","2–17 μmol/L // 0–5 μmol/L"),("Proteins, total","6.0–7.8 g/dL","60–78 g/L"),("Albumin","3.5–5.5 g/dL","35–55 g/L"),("Globulin","2.3–3.5 g/dL","23–35 g/L")]),
 ("Serum","Other, serum",[("Amylase","25–125 U/L","25–125 U/L"),("Lipase","13–60 U/L","13–60 U/L"),("Creatinine clearance","Male: 97–137 mL/min; Female: 88–128 mL/min","97–137 mL/min; 88–128 mL/min"),
   ("Creatine kinase","Male: 25–90 U/L; Female: 10–70 U/L","25–90 U/L; 10–70 U/L"),("Lactate dehydrogenase","45–200 U/L","45–200 U/L"),("Osmolality","275–295 mOsmol/kg H2O","275–295 mOsmol/kg H2O"),
   ("Troponin I","≤0.04 ng/mL","≤0.04 µg/L"),("Uric acid","3.0–8.2 mg/dL","0.18–0.48 mmol/L")]),
 ("Serum","Lipids",[("Cholesterol, total","Normal: <200 mg/dL; High: >240 mg/dL","<5.2 mmol/L; >6.2 mmol/L"),("Cholesterol, HDL","40–60 mg/dL","1.0–1.6 mmol/L"),("Cholesterol, LDL","<160 mg/dL","<4.2 mmol/L"),
   ("Triglycerides","Normal: <150 mg/dL; Borderline: 151–199 mg/dL","<1.70 mmol/L; 1.71–2.25 mmol/L")]),
 ("Serum","Iron studies",[("Ferritin","Male: 20–250 ng/mL; Female: 10–120 ng/mL","20–250 μg/L; 10–120 μg/L"),("Iron","Male: 65–175 µg/dL; Female: 50–170 μg/dL","11.6–31.3 μmol/L; 9.0–30.4 μmol/L"),
   ("Total iron-binding capacity","250–400 µg/dL","44.8–71.6 μmol/L"),("Transferrin","200–360 mg/dL","2.0–3.6 g/L")]),
 ("Serum","Endocrine",[("Follicle-stimulating hormone","Male: 4–25 mIU/mL; Female: premenopause 4–30 mIU/mL, midcycle peak 10–90 mIU/mL, postmenopause 40–250 mIU/mL","4–25 IU/L; 4–30 IU/L; 10–90 IU/L; 40–250 IU/L"),
   ("Luteinizing hormone","Male: 6–23 mIU/mL; Female: follicular phase 5–30 mIU/mL, midcycle 75–150 mIU/mL, postmenopause 30–200 mIU/mL","6–23 IU/L; 5–30 IU/L; 75–150 IU/L; 30–200 IU/L"),
   ("Growth hormone - arginine stimulation","Fasting: <5 ng/mL; Provocative stimuli: >7 ng/mL","<5 μg/L; >7 μg/L"),("Prolactin (hPRL)","Male: <17 ng/mL; Female: <25 ng/mL","<17 μg/L; <25 μg/L"),
   ("Cortisol","0800 h: 5–23 μg/dL; 1600 h: 3–15 μg/dL; 2000 h: <50% of 0800 h","138–635 nmol/L; 82–413 nmol/L; Fraction of 0800 h: <0.50"),("TSH","0.4–4.0 μU/mL","0.4–4.0 mIU/L"),
   ("Triiodothyronine (T3) (RIA)","100–200 ng/dL","1.5–3.1 nmol/L"),("Triiodothyronine (T3) resin uptake","25%–35%","0.25–0.35"),("Thyroxine (T4)","5–12 μg/dL","64–155 nmol/L"),("Free T4","0.9–1.7 ng/dL","12.0–21.9 pmol/L"),
   ("Thyroidal iodine (123I) uptake","8%–30% of administered dose/24 h","0.08–0.30/24 h"),("Intact PTH","10–60 pg/mL","10–60 ng/L"),
   ("17-Hydroxycorticosteroids","Male: 3.0–10.0 mg/24 h; Female: 2.0–8.0 mg/24 h","8.2–27.6 μmol/24 h; 5.5–22.0 μmol/24 h"),("17-Ketosteroids, total","Male: 8–20 mg/24 h; Female: 6–15 mg/24 h","28–70 μmol/24 h; 21–52 μmol/24 h")]),
 ("Serum","Immunoglobulins",[("IgA","76–390 mg/dL","0.76–3.90 g/L"),("IgE","0–380 IU/mL","0–380 kIU/L"),("IgG","650–1500 mg/dL","6.5–15.0 g/L"),("IgM","50–300 mg/dL","0.5–3.0 g/L")]),
 ("Gases, arterial blood (room air)","",[("PO2","75–105 mm Hg","10.0–14.0 kPa"),("PCO2","33–45 mm Hg","4.4–5.9 kPa"),("pH","7.35–7.45","[H+] 36–44 nmol/L")]),
 ("Cerebrospinal fluid","",[("Cell count","0–5/mm³","0–5 × 10⁶/L"),("Chloride","118–132 mEq/L","118–132 mmol/L"),("Gamma globulin","3%–12% total proteins","0.03–0.12"),("Glucose","40–70 mg/dL","2.2–3.9 mmol/L"),
   ("Pressure","70–180 mm H2O","70–180 mm H2O"),("Proteins, total","<40 mg/dL","<0.40 g/L")]),
 ("Hematologic","Complete blood count",[("Hematocrit","Male: 41%–53%; Female: 36%–46%","0.41–0.53; 0.36–0.46"),("Hemoglobin, blood","Male: 13.5–17.5 g/dL; Female: 12.0–16.0 g/dL","135–175 g/L; 120–160 g/L"),
   ("Mean corpuscular hemoglobin (MCH)","25–35 pg/cell","0.39–0.54 fmol/cell"),("Mean corpuscular hemoglobin concentration (MCHC)","31%–36% Hb/cell","4.8–5.6 mmol Hb/L"),("Mean corpuscular volume (MCV)","80–100 μm³","80–100 fL"),
   ("Volume, plasma","Male: 25–43 mL/kg; Female: 28–45 mL/kg","0.025–0.043 L/kg; 0.028–0.045 L/kg"),("Volume, red cell","Male: 20–36 mL/kg; Female: 19–31 mL/kg","0.020–0.036 L/kg; 0.019–0.031 L/kg"),
   ("Leukocyte count (WBC)","4500–11,000/mm³","4.5–11.0 × 10⁹/L"),("Neutrophils, segmented","54%–62%","0.54–0.62"),("Neutrophils, bands","3%–5%","0.03–0.05"),("Lymphocytes","25%–33%","0.25–0.33"),
   ("Monocytes","3%–7%","0.03–0.07"),("Eosinophils","1%–3%","0.01–0.03"),("Basophils","0%–0.75%","0.00–0.0075"),("Platelet count","150,000–400,000/mm³","150–400 × 10⁹/L")]),
 ("Hematologic","Coagulation",[("Partial thromboplastin time (PTT/aPTT) (activated)","25–40 seconds","25–40 seconds"),("Prothrombin time (PT)","11–15 seconds","11–15 seconds"),("D-dimer","≤250 ng/mL","≤1.4 nmol/L")]),
 ("Hematologic","Other, hematologic",[("Reticulocyte count","0.5%–1.5%","0.005–0.015"),("Erythrocyte count (RBC)","Male: 4.3–5.9 million/mm³; Female: 3.5–5.5 million/mm³","4.3–5.9 × 10¹²/L; 3.5–5.5 × 10¹²/L"),
   ("Erythrocyte sedimentation rate (Westergren)","Male: 0–15 mm/h; Female: 0–20 mm/h","0–15 mm/h; 0–20 mm/h"),("CD4+ T-lymphocyte count","≥500/mm³","≥0.5 × 10⁹/L"),("Hemoglobin A1c","≤6%","≤42 mmol/mol")]),
 ("Urine","",[("Calcium","100–300 mg/24 h","2.5–7.5 mmol/24 h"),("Osmolality","50–1200 mOsmol/kg H2O","50–1200 mOsmol/kg H2O"),("Oxalate","8–40 μg/mL","90–445 μmol/L"),("Proteins, total","<150 mg/24 h","<0.15 g/24 h")]),
 ("Body mass index (BMI)","",[("BMI, adult","19–25 kg/m²","19–25 kg/m²")]),
]

def labs(c):
    c.executescript("DROP TABLE IF EXISTS labs; CREATE TABLE labs(id INTEGER PRIMARY KEY, section TEXT, subsection TEXT, test TEXT, conventional TEXT, si TEXT);")
    i = 0
    for sec, sub, items in LABS:
        for t, conv, si in items:
            i += 1; c.execute("INSERT INTO labs VALUES(?,?,?,?,?,?)", (i, sec, sub, t, conv, si))
    meta(c, "labs", {"source":"NBME Laboratory Values","url":"https://www.nbme.org/laboratory-values/","retrieved":"2026-11-01","rows":i})
    print("labs", i)

if __name__ == "__main__":
    c = connect()
    for f in (medline, icd, devices, ndc, shortages, labs): f(c); c.commit()
