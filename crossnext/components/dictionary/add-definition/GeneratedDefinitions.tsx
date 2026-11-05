"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { type DefinitionSuggestions, definitionSuggestionsSchema } from "@/lib/definitionSuggestions";
import { SIMILARITY_CONFIG } from "@/lib/similarityConfig";
import { type SimilarItem, SimilarMatchesList } from "./SimilarMatchesList";

export type { DefinitionSuggestions } from "@/lib/definitionSuggestions";

export function GeneratedDefinitions({
  suggestions,
  matchesByText = {},
  disabled,
  onToggle,
  onAdd,
}: {
  suggestions: DefinitionSuggestions;
  matchesByText?: Record<string, SimilarItem[]>;
  disabled: boolean;
  onToggle: (text: string, checked: boolean) => void;
  onAdd: () => void;
}) {
  const t = useTranslations();
  const id = useId();
  // Fast Refresh can preserve state created by an older version of the generator.
  const parsed = definitionSuggestionsSchema.safeParse(suggestions);
  if (!parsed.success) return null;
  const { texts, selected } = parsed.data;

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2 border-t pt-3">
      <legend className="sr-only">{t("aiDefinitionVariants")}</legend>
      <p className="text-xs text-muted-foreground">{t("aiDefinitionVariantsHint")}</p>
      <div className="divide-y">
        {texts.map((text, index) => (
          <div key={text} className="min-w-0 py-2">
            <div className="flex min-w-0 items-start gap-2">
              <label
                htmlFor={`${id}-${index}`}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-sm leading-relaxed"
              >
                <Checkbox
                  id={`${id}-${index}`}
                  aria-describedby={`${id}-${index}-length`}
                  className="mt-1"
                  checked={selected.includes(text)}
                  disabled={disabled}
                  onCheckedChange={(checked) => onToggle(text, checked === true)}
                />
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{text}</span>
              </label>
              <span id={`${id}-${index}-length`} className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                {text.length}
              </span>
            </div>
            {(matchesByText[text]?.length ?? 0) > 0 && (
              <div className="min-w-0 pl-7">
                <SimilarMatchesList items={matchesByText[text]} threshold={SIMILARITY_CONFIG.nearThreshold} />
              </div>
            )}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full sm:w-auto"
        disabled={disabled || selected.length === 0}
        onClick={onAdd}
      >
        {t("aiAddSelectedDefinitions", { count: selected.length })}
      </Button>
    </fieldset>
  );
}
