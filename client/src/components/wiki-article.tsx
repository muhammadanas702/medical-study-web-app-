import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ExtLink } from "@/components/common";

export type WikiArticle = { title: string; url: string | null; touched: string | null; intro: string | null; sections: { title: string; text: string }[]; image: string | null };

/** Plain-text Wikipedia article split into paragraphs; "### X" lines become sub-headings. */
export function ArticleText({ text, max }: { text: string; max?: number }) {
  const clean = text.replace(/\(\s*[;,]\s*/g, "(").replace(/\(\s*\)/g, "").replace(/\s+\)/g, ")").replace(/ {2,}/g, " ").replace(/ ([,.;])/g, "$1");
  const t = max && clean.length > max ? clean.slice(0, clean.lastIndexOf(" ", max)) + "…" : clean;
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {t.split(/\n{1,}/).filter((p) => p.trim()).map((p, i) =>
        p.startsWith("### ") ? <h5 key={i} className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.slice(4)}</h5> : <p key={i}>{p}</p>,
      )}
    </div>
  );
}

export function WikiArticleView({ a, compact = false, testId = "article" }: { a: WikiArticle; compact?: boolean; testId?: string }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [full, setFull] = useState(false);
  return (
    <div className="space-y-3" data-testid={testId}>
      {a.intro && <ArticleText text={a.intro} max={full || !compact ? undefined : 900} />}
      {compact && a.intro && a.intro.length > 900 && (
        <button className="text-xs font-medium text-primary hover:underline" onClick={() => setFull(!full)} data-testid={`${testId}-more`}>{full ? "Show less" : "Read the full introduction"}</button>
      )}
      {a.sections?.length > 0 && (
        <div className="divide-y rounded-lg border">
          {a.sections.map((s, i) => (
            <div key={i}>
              <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover-elevate" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} data-testid={`${testId}-section-${i}`}>
                {s.title}
                {open[i] ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              </button>
              {open[i] && <div className="px-3 pb-3"><ArticleText text={s.text} /></div>}
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-snug text-muted-foreground">
        Text from the Wikipedia article {a.url ? <ExtLink href={a.url}>{a.title}</ExtLink> : a.title}
        {a.touched ? ` (revision of ${a.touched.slice(0, 10)})` : ""}, licensed CC BY-SA 4.0. Verify clinical facts against your course textbook.
      </p>
    </div>
  );
}
