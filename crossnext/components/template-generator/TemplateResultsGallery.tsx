"use client";

import { CLUE_MAP } from "@megacross/cross-format";
import { Download, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { VirtuosoGrid } from "react-virtuoso";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TemplatePreview } from "./TemplatePreview";
import type { GenerationResult } from "./types";

type Props = {
  items: GenerationResult[];
  selected: Set<string>;
  rejected: Set<string>;
  onSelectedChange: (id: string, selected: boolean) => void;
  onReject: (id: string) => void;
};

function countDoubleArrows(codes: readonly (readonly number[])[]): number {
  let count = 0;
  for (const row of codes)
    for (const code of row) {
      if (CLUE_MAP[code]?.length === 2) count += 1;
    }
  return count;
}

export default function TemplateResultsGallery({ items, selected, rejected, onSelectedChange, onReject }: Props) {
  const t = useTranslations("templateGenerator");
  const visible = items.filter((item) => !rejected.has(item.id));
  return (
    <VirtuosoGrid
      useWindowScroll
      totalCount={visible.length}
      listClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      itemContent={(index) => {
        const result = visible[index];
        return (
          <article className="overflow-hidden rounded-xl border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  aria-label={t("selectResult", { ordinal: result.ordinal })}
                  checked={selected.has(result.id)}
                  onCheckedChange={(value) => onSelectedChange(result.id, value === true)}
                />
                #{result.ordinal}
              </div>
              <div className="flex items-center gap-1">
                <Button asChild size="icon" variant="ghost" title={t("downloadFsh")}>
                  <a href={`/api/template-generator/jobs/${result.jobId}/results/${result.id}/fsh`}>
                    <Download />
                  </a>
                </Button>
                <Button size="icon" variant="ghost" title={t("reject")} onClick={() => onReject(result.id)}>
                  <X />
                </Button>
              </div>
            </div>
            <TemplatePreview result={result} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
              <span>
                {t("words")}: <b className="text-foreground">{result.metrics.slotCount}</b>
              </span>
              <span>
                {t("crossings")}: <b className="text-foreground">{result.metrics.intersections}</b>
              </span>
              <span className="col-span-2">
                {t("doubleArrows")}: <b className="text-foreground">{countDoubleArrows(result.grid.codes)}</b>
              </span>
              <span className="col-span-2 truncate">
                {t("lengths")}:{" "}
                {Object.entries(result.metrics.lengthDistribution)
                  .map(([length, count]) => `${length}:${count}`)
                  .join(" · ")}
              </span>
              <span className="col-span-2">
                {t("orientation")}: {t(`orientationValue.${result.metrics.cutoutOrientation}`)}
              </span>
              <span className="col-span-2 flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="size-3.5" />
                {t("verified")}
              </span>
            </div>
          </article>
        );
      }}
    />
  );
}
