import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ExtLink, ListSkeleton, ErrorState } from "@/components/common";
import { KIND_LABEL } from "@/lib/meta";

type Meta = Record<string, any>;

const ORDER: { key: string; title: string; what: string; license: string }[] = [
  { key: "mesh", title: "Medical Subject Headings (MeSH)", what: "Concept library: diseases, anatomy, organisms (viruses, bacteria, fungi, parasites, animals), chemicals and drugs, procedures, equipment, psychiatry, phenomena. Definitions (scope notes), synonyms, tree hierarchy and pharmacologic actions.", license: "Public domain (U.S. Government work); NLM terms of use" },
  { key: "medlineplus", title: "MedlinePlus Health Topics", what: "Clinician-reviewed health topic summaries with links to NIH and other authoritative resources.", license: "Public domain content from NLM" },
  { key: "drugs", title: "FDA drug labeling (openFDA / DailyMed)", what: "Prescribing information per active ingredient: boxed warning, indications, dosage and administration, contraindications, warnings, adverse reactions, interactions, specific populations, pharmacology.", license: "Public domain (U.S. FDA)" },
  { key: "ndc", title: "FDA National Drug Code directory", what: "Marketed products: brand names, strengths, dosage forms, routes, labelers, DEA schedules and FDA established pharmacologic classes.", license: "Public domain (U.S. FDA)" },
  { key: "shortages", title: "FDA drug shortages", what: "Current and resolved shortage records with availability and reason.", license: "Public domain (U.S. FDA)" },
  { key: "devices", title: "FDA medical device classification", what: "Medical equipment and devices by product code, device class (I/II/III), medical specialty and regulation number.", license: "Public domain (U.S. FDA)" },
  { key: "icd10", title: "ICD-10-CM", what: "Complete diagnosis code set with chapter/block hierarchy and billable status.", license: "Public domain (CMS / CDC NCHS)" },
  { key: "labs", title: "NBME laboratory values", what: "Reference ranges in the format shown on USMLE exams.", license: "Reproduced for study reference; © NBME" },
  { key: "anatomy3d", title: "BodyParts3D", what: "Segmented 3D human anatomy meshes (adult male reference) with FMA identifiers, classified into 11 body systems.", license: "CC BY-SA 2.1 Japan, © DBCLS" },
  { key: "organ_models", title: "Human Reference Atlas 3D organs", what: "3D reference organs (HuBMAP / NIH Common Fund) segmented from the Visible Human Male and Female datasets of the U.S. National Library of Medicine, with every sub-structure labelled by UBERON ID; brain from the Allen Human Brain Atlas. Structure definitions from the UBERON ontology (EBI OLS), descriptions from the Wikipedia article Wikidata links to that UBERON ID.", license: "CC BY 4.0 (models); UBERON CC BY 3.0; Wikipedia CC BY-SA 4.0" },
  { key: "wikidata", title: "Wikidata + FMA / TA98 / UBERON", what: "Each 3D structure's FMA ID is linked through Wikidata (property P1402) to its Terminologia Anatomica 98 code, MeSH heading, UBERON ID and English Wikipedia article.", license: "CC0 (Wikidata)" },
  { key: "wikipedia", title: "Wikipedia anatomy articles", what: "Structure, function, development and clinical significance text for 3D structures. Where a structure has no article of its own, the article of the structure it is part of is shown and labelled as such.", license: "CC BY-SA 4.0" },
  { key: "openstax", title: "OpenStax textbooks", what: "12 complete peer-reviewed textbooks (Anatomy & Physiology 2e, Biology 2e, Microbiology, Chemistry 2e, Organic Chemistry, Pharmacology for Nurses, Psychology 2e, Behavioral Neuroscience, Lifespan Development, Nutrition, Population Health, Statistics): every section, figure and review question.", license: "CC BY-NC-SA 4.0, © OpenStax / Rice University" },
  { key: "pubchem", title: "PubChem", what: "Active ingredients of FDA-labelled drugs matched to PubChem compounds: formula, weight, IUPAC name, SMILES, InChIKey, physicochemical properties, descriptions and 3D conformers.", license: "Public domain (NCBI); descriptions keep their source attribution" },
  { key: "models", title: "NIH 3D", what: "3D models of pathogens (virions, capsids, bacteria), open-hardware medical devices and laboratory equipment, and inner-ear anatomy. Non-commercial or no-derivatives licensed models are excluded.", license: "Per model: Public Domain, CC0 or CC BY 4.0" },
  { key: "pathogens", title: "Pathogen fact sheets", what: "52 high-yield bacteria, viruses, fungi and parasites: morphology, transmission, virulence factors, disease, diagnosis, treatment and exam pearls; each linked to its NLM MeSH heading, Wikipedia article and verified RCSB Protein Data Bank structures (shown in an interactive molecular viewer). Organisms without an NIH 3D model get a labelled schematic 3D model.", license: "Curated summary; Wikipedia CC BY-SA 4.0; MeSH and PDB public" },
  { key: "drug_images", title: "DailyMed drug images", what: "Product, package-label and chemical-structure images published inside FDA Structured Product Labeling documents, shown on each drug page with credit to DailyMed.", license: "Public domain (U.S. government work); trademarks belong to their owners" },
];

export default function SourcesPage() {
  const r = useQuery<{ counts: Record<string, number>; sources: Meta }>({ queryKey: ["/api/stats"] });
  const q = r.data?.sources?.questions;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Transparency" title="Sources & methods"
        subtitle="Every fact in this app comes from a named, authoritative public dataset. This page lists each one, its version, license and how it is used — so you always know what you are studying from." />
      {r.isError && <ErrorState error={r.error} onRetry={() => r.refetch()} />}
      {r.isLoading ? <ListSkeleton rows={8} /> : r.data && (
        <div className="grid gap-4 md:grid-cols-2">
          {ORDER.map((o) => {
            const m = r.data!.sources[o.key] ?? {};
            const ver = m.version || m.effective || m.export_date || m.retrieved || m.file;
            return (
              <Card key={o.key} data-testid={`card-source-${o.key}`}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{o.title}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{o.what}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ver && <Badge variant="secondary">{String(ver)}</Badge>}
                    <Badge variant="outline">{o.license}</Badge>
                  </div>
                  {m.source && <p className="text-xs text-muted-foreground">{m.source}</p>}
                  {m.selection && <p className="text-xs text-muted-foreground">{m.selection}</p>}
                  {m.url && <ExtLink href={m.url}>{m.url.replace(/^https?:\/\//, "")}</ExtLink>}
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Live literature and trials</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Research search queries PubMed (NCBI E-utilities) and ClinicalTrials.gov (API v2) live, so results are always current. Abstracts remain the property of their publishers and are shown for study with links to the original.</p>
              <div className="flex flex-col gap-1"><ExtLink href="https://www.ncbi.nlm.nih.gov/books/NBK25501/">NCBI E-utilities</ExtLink><ExtLink href="https://clinicaltrials.gov/data-api/api">ClinicalTrials.gov API</ExtLink></div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">How questions are made</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Questions are generated directly from the source records above, so the correct answer is always traceable to a specific record (shown under each explanation with a link). Distractors are drawn from sibling records of the same type and filtered so that no distractor is also a correct answer (for example, drugs that share a pharmacologic class are excluded).</p>
          {q?.by_kind && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(q.by_kind as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <Badge key={k} variant="outline">{KIND_LABEL[k] ?? k}: {n.toLocaleString()}</Badge>
              ))}
            </div>
          )}
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Definition, hierarchy, taxonomy and pharmacologic-action items come from MeSH.</li>
            <li>Drug class items come from FDA Established Pharmacologic Class assignments.</li>
            <li>Lab items come from the NBME reference ranges.</li>
            <li>Clinical vignettes are hand-written in USMLE style, each linked to a guideline or reference; they have not been reviewed by a licensed physician panel.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-warning/40 bg-warning/5">
        <CardHeader className="pb-2"><CardTitle className="text-base">Scope and limits</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Copyrighted commercial textbooks and question banks (for example First Aid, Robbins, Guyton, UWorld) are not reproduced here. This app is built only from public-domain and openly licensed data.</p>
          <p>This is a study aid, not medical advice. Drug labels change; always confirm dosing and prescribing decisions against the current label on DailyMed and local guidelines. If you spot an error, every record links to its original source so it can be checked.</p>
        </CardContent>
      </Card>
    </div>
  );
}
