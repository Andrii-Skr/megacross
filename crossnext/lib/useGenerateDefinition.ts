"use client";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getActionErrorMeta } from "@/lib/action-error";
import { generatedDefinitionsResponseSchema } from "@/lib/definitionSuggestions";
import { fetcher } from "@/lib/fetcher";
import type { Lang } from "@/lib/similarityClient";

export type GenerateDefinitionParams = {
  word: string;
  wordId?: string;
  language: Lang;
  existing: string[];
  avoid?: string[];
  maxLength: number;
  count?: 1 | 3;
  toastOnSuccess?: boolean;
};

export function useGenerateDefinition() {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
  }, []);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const generate = useCallback(
    async (params: GenerateDefinitionParams): Promise<string[] | null> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        setLoading(true);
        const res = await fetcher<unknown>("/api/ai/generate-definition", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: params.word,
            wordId: params.wordId,
            language: params.language,
            existing: params.existing,
            avoid: params.avoid ?? [],
            maxLength: params.maxLength,
            count: params.count ?? 1,
          }),
        });

        if (controller.signal.aborted) return null;
        const parsed = generatedDefinitionsResponseSchema.safeParse(res);
        if (parsed.success) {
          if (params.toastOnSuccess) toast.success(t("aiGenerated"));
          return parsed.data.texts;
        }
        toast.error(t("aiError"));
        return null;
      } catch (e: unknown) {
        if (controller.signal.aborted) return null;
        const { status, code } = getActionErrorMeta(e);
        if (code === "AI_NO_NEW_DEFINITIONS") toast.info(t("aiNoNewDefinitions"));
        else if (code === "AI_NO_UNIQUE_DEFINITIONS") toast.info(t("aiNoUniqueDefinitions"));
        else if (status === 401) toast.error(t("aiUnauthorized"));
        else if (status === 400) toast.error(t("aiNotConfigured"));
        else if (status === 429) toast.error(t("aiQuotaExceeded"));
        else toast.error(t("aiError"));
        return null;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setLoading(false);
        }
      }
    },
    [t],
  );

  return { generate, loading, cancel } as const;
}
