"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Rnd } from "react-rnd";
import { toast } from "sonner";
import { DefinitionCarousel } from "@/components/admin/pending/DefinitionCarousel";
import {
  AddDefHeader,
  DefinitionSection,
  MetaSection,
  SimilarMatchesList,
  type Tag,
} from "@/components/dictionary/add-definition";
import {
  type DefinitionSuggestions,
  GeneratedDefinitions,
} from "@/components/dictionary/add-definition/GeneratedDefinitions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getActionErrorMeta } from "@/lib/action-error";
import { toEndOfDayUtcIso } from "@/lib/date";
import { filterUniqueDefinitions, getSimilarDefinitionMatches } from "@/lib/definitionDeduplication";
import { definitionSuggestionsSchema } from "@/lib/definitionSuggestions";
import { fetcher } from "@/lib/fetcher";
import type { ExistingDef } from "@/lib/similarityClient";
import { prepareExisting } from "@/lib/similarityClient";
import { SIMILARITY_CONFIG } from "@/lib/similarityConfig";
import { useDifficulties } from "@/lib/useDifficulties";
import { useGenerateDefinition } from "@/lib/useGenerateDefinition";
import { z } from "@/lib/zodClient";
import { useDictionaryStore } from "@/store/dictionary";
import { usePendingStore } from "@/store/pending";
import { useUiStore } from "@/store/ui";

export type AddDefinitionCreatedPayload = {
  wordId: string;
  definitions: Array<{ text: string; difficulty: number }>;
  language: string;
};

type AddDefinitionModalProps = {
  wordId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: Array<Pick<ExistingDef, "id" | "text" | "lang">>;
  wordText?: string;
  onCreated?: (payload: AddDefinitionCreatedPayload) => void;
  languageOverride?: string;
  openAnchor?: { x: number; y: number };
};

export function AddDefinitionModal({
  wordId,
  open,
  onOpenChange,
  existing = [],
  wordText,
  onCreated,
  languageOverride,
  openAnchor,
}: AddDefinitionModalProps) {
  const t = useTranslations();
  const increment = usePendingStore((s) => s.increment);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const addDefCollapsed = useUiStore((s) => s.addDefCollapsed);
  const collapseAddDef = useUiStore((s) => s.collapseAddDef);
  const clearAddDef = useUiStore((s) => s.clearAddDef);
  const panelSize = useUiStore((s) => s.panelSize);
  const setPanelSize = useUiStore((s) => s.setPanelSize);
  const MIN_PANEL_WIDTH = 360;
  const MIN_PANEL_HEIGHT = 600;
  const initialPanelHeightRef = useRef(panelSize.height);
  // floating panel position/size state
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 80 });
  const mountedRef = useRef(false);
  // RHF + Zod for validation
  const DEF_MAX_LENGTH = 255;
  const schema = z.object({
    definitions: z
      .array(
        z.object({
          definition: z
            .string()
            .trim()
            .min(1, t("definitionRequired"))
            .max(DEF_MAX_LENGTH, t("definitionMaxError", { max: DEF_MAX_LENGTH })),
          note: z.string().max(512).optional().or(z.literal("")),
          difficulty: z.number().int().min(0).default(1),
          endDate: z.date().nullable().optional(),
          tags: z.array(z.object({ id: z.number(), name: z.string() })).default([]),
        }),
      )
      .min(1),
  });
  type FormValues = z.input<typeof schema>;
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    getValues,
    control,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      definitions: [{ definition: "", note: "", difficulty: 1, endDate: null, tags: [] }],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "definitions" });
  const definitions = watch("definitions");
  const submitting = isSubmitting;

  // Live form values used in similarity + cache
  const langValue = useDictionaryStore((s) => s.dictionaryLang);
  const requestLanguage = languageOverride ?? langValue;
  const simLang =
    requestLanguage === "ru" || requestLanguage === "uk" || requestLanguage === "en"
      ? (requestLanguage as "ru" | "uk" | "en")
      : undefined;
  const { generate, loading: genLoading, cancel: cancelGeneration } = useGenerateDefinition();
  const [suggestionsByField, setSuggestionsByField] = useState<Record<string, DefinitionSuggestions>>({});
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const generationSession = useRef(0);
  useEffect(
    () => () => {
      generationSession.current += 1;
    },
    [],
  );
  const [fetchedExisting, setFetchedExisting] = useState<Array<Pick<ExistingDef, "id" | "text" | "lang">>>([]);
  const [aiHistoryByField, setAiHistoryByField] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open || !wordId) return;
    let active = true;
    const controller = new AbortController();

    const loadDefinitions = async () => {
      try {
        const data = await fetcher<{
          opred_v?: Array<{ id: string; text_opr: string }>;
        }>(`/api/dictionary/word/${wordId}`, { signal: controller.signal });
        if (!active) return;
        const nextExisting = (data.opred_v ?? [])
          .map((item) => ({
            id: item.id,
            text: item.text_opr.trim(),
            ...(simLang ? { lang: simLang } : {}),
          }))
          .filter((item) => item.text.length > 0);
        setFetchedExisting(nextExisting);
      } catch (error) {
        if (!active) return;
        if ((error as { name?: string }).name === "AbortError") return;
        setFetchedExisting([]);
      }
    };

    void loadDefinitions();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, simLang, wordId]);

  const existingForChecks = useMemo(() => {
    const deduped: Array<Pick<ExistingDef, "id" | "text" | "lang">> = [];
    const seenText = new Set<string>();
    const seenIds = new Set<string>();
    for (const item of [...existing, ...fetchedExisting]) {
      const text = item.text.trim();
      if (!text) continue;
      const lang = item.lang ?? simLang;
      const idKey = String(item.id);
      if (seenIds.has(idKey)) continue;
      const textKey = `${lang ?? ""}:${text.toLocaleLowerCase()}`;
      if (seenText.has(textKey)) continue;
      seenIds.add(idKey);
      seenText.add(textKey);
      deduped.push({
        id: item.id,
        text,
        ...(lang ? { lang } : {}),
      });
    }
    return deduped;
  }, [existing, fetchedExisting, simLang]);

  const liveContext = useRef({ open, wordId, requestLanguage, fields, existingForChecks });
  liveContext.current = { open, wordId, requestLanguage, fields, existingForChecks };

  // Подготовка кэша существующих определений (зависит только от языка и входного массива)
  const preparedExisting = useMemo(() => {
    return prepareExisting(
      existingForChecks.map((e) => ({
        id: e.id,
        text: e.text,
        lang: e.lang ?? simLang,
      })),
      {
        /* defaults */
      },
    );
  }, [existingForChecks, simLang]);

  const definitionsKey = JSON.stringify((definitions ?? []).map((d) => (d?.definition ?? "").trim()));
  const visibleSuggestionsByField = useMemo(() => {
    const localDefinitions = (JSON.parse(definitionsKey) as string[])
      .filter(Boolean)
      .map((text, index) => ({ id: `local-${index}`, text, lang: simLang }));
    const existing = [...existingForChecks, ...localDefinitions];
    const visible: Record<string, DefinitionSuggestions> = {};
    for (const [fieldKey, suggestions] of Object.entries(suggestionsByField)) {
      const parsed = definitionSuggestionsSchema.safeParse(suggestions);
      if (!parsed.success) continue;
      const texts = filterUniqueDefinitions(parsed.data.texts, existing, simLang);
      if (texts.length) {
        visible[fieldKey] = { texts, selected: parsed.data.selected.filter((text) => texts.includes(text)) };
      }
    }
    return visible;
  }, [definitionsKey, existingForChecks, simLang, suggestionsByField]);

  const similarByDefinition = useMemo(() => {
    if (!open) return [];
    const defTexts = JSON.parse(definitionsKey) as string[];
    return defTexts.map((text) => getSimilarDefinitionMatches(text, preparedExisting, simLang));
  }, [definitionsKey, simLang, preparedExisting, open]);

  const suggestionMatchesByText = useMemo(() => {
    const texts = new Set(Object.values(visibleSuggestionsByField).flatMap((suggestions) => suggestions.texts));
    return Object.fromEntries(
      [...texts].map((text) => [text, getSimilarDefinitionMatches(text, preparedExisting, simLang)]),
    );
  }, [visibleSuggestionsByField, preparedExisting, simLang]);

  const { data: difficultiesData } = useDifficulties(open);
  const difficulties = difficultiesData ?? [];
  const defaultDifficulty = difficulties[0] ?? 1;
  const resolvedLang: "ru" | "uk" | "en" =
    requestLanguage === "ru" || requestLanguage === "uk" || requestLanguage === "en" ? requestLanguage : "ru";
  const buildExistingForAi = useCallback(
    (currentIndex: number) => {
      const localDefinitions = (definitions ?? [])
        .filter((_, index) => index !== currentIndex)
        .map((definition) => definition?.definition?.trim() ?? "")
        .filter((value) => value.length > 0);
      const allTexts = existingForChecks.map((item) => item.text).concat(localDefinitions);
      const unique = new Set<string>();
      const result: string[] = [];
      for (const text of allTexts) {
        const key = text.toLocaleLowerCase();
        if (unique.has(key)) continue;
        unique.add(key);
        result.push(text);
      }
      return result;
    },
    [definitions, existingForChecks],
  );

  const rememberAiVariant = useCallback((fieldKey: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAiHistoryByField((prev) => {
      const current = prev[fieldKey] ?? [];
      const key = trimmed.toLocaleLowerCase();
      if (current.some((item) => item.toLocaleLowerCase() === key)) return prev;
      return {
        ...prev,
        [fieldKey]: [...current, trimmed],
      };
    });
  }, []);

  const handleGenerateForIndex = useCallback(
    async (idx: number, fieldKey: string) => {
      if (!wordText) return;
      const session = generationSession.current;
      const currentValue = getValues(`definitions.${idx}.definition`)?.trim() ?? "";
      const blocked = [...Object.values(aiHistoryByField).flat(), currentValue].filter(Boolean);
      setGeneratingField(fieldKey);
      const texts = await generate({
        word: wordText,
        wordId,
        language: resolvedLang,
        existing: buildExistingForAi(idx),
        avoid: blocked,
        maxLength: DEF_MAX_LENGTH,
        count: 3,
      });
      const context = liveContext.current;
      if (
        generationSession.current !== session ||
        !context.open ||
        context.wordId !== wordId ||
        context.requestLanguage !== requestLanguage ||
        !context.fields.some((field) => field.id === fieldKey)
      )
        return;
      setGeneratingField(null);
      if (!texts?.length) return;
      for (const text of texts) rememberAiVariant(fieldKey, text);
      const localDefinitions = getValues("definitions")
        .map((definition, index) => ({ id: `local-${index}`, text: definition.definition, lang: resolvedLang }))
        .filter((definition) => definition.text.trim().length > 0);
      const uniqueTexts = filterUniqueDefinitions(
        texts,
        [...context.existingForChecks, ...localDefinitions],
        resolvedLang,
      );
      if (!uniqueTexts.length) {
        toast.info(t("aiNoUniqueDefinitions"));
        return;
      }
      setSuggestionsByField((prev) => ({ ...prev, [fieldKey]: { texts: uniqueTexts, selected: [] } }));
    },
    [
      aiHistoryByField,
      buildExistingForAi,
      generate,
      getValues,
      rememberAiVariant,
      requestLanguage,
      resolvedLang,
      t,
      wordId,
      wordText,
    ],
  );

  const toggleSuggestion = useCallback((fieldKey: string, text: string, checked: boolean) => {
    setSuggestionsByField((prev) => {
      const current = prev[fieldKey];
      if (!current) return prev;
      return {
        ...prev,
        [fieldKey]: {
          ...current,
          selected: checked
            ? [...new Set([...current.selected, text])]
            : current.selected.filter((item) => item !== text),
        },
      };
    });
  }, []);

  const addSelectedSuggestions = useCallback(
    (fieldKey: string) => {
      const idx = liveContext.current.fields.findIndex((field) => field.id === fieldKey);
      const suggestions = visibleSuggestionsByField[fieldKey];
      if (idx < 0 || !suggestions) return;
      const localDefinitions = getValues("definitions")
        .filter((definition) => definition.definition.trim().length > 0)
        .map((definition, index) => ({ id: `local-${index}`, text: definition.definition, lang: simLang }));
      const selected = filterUniqueDefinitions(
        suggestions.texts.filter((text) => suggestions.selected.includes(text)),
        [...liveContext.current.existingForChecks, ...localDefinitions],
        simLang,
      );
      if (!selected.length) return;
      if (!getValues(`definitions.${idx}.definition`)?.trim()) {
        setValue(`definitions.${idx}.definition`, selected.shift() ?? "", {
          shouldTouch: true,
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (selected.length)
        append(
          selected.map((definition) => ({
            definition,
            note: "",
            difficulty: defaultDifficulty,
            endDate: null,
            tags: [],
          })),
          { shouldFocus: false },
        );
      setSuggestionsByField((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    },
    [append, defaultDifficulty, getValues, setValue, simLang, visibleSuggestionsByField],
  );

  const removeDefinition = useCallback(
    (idx: number, fieldKey: string) => {
      remove(idx);
      if (generatingField === fieldKey) {
        generationSession.current += 1;
        cancelGeneration?.();
        setGeneratingField(null);
      }
      setSuggestionsByField((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
      setAiHistoryByField((prev) => {
        if (!(fieldKey in prev)) return prev;
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    },
    [cancelGeneration, generatingField, remove],
  );

  const onCreate = handleSubmit(async (values) => {
    const defs = (values.definitions ?? []).map((d: FormValues["definitions"][number]) => ({
      definition: d.definition,
      note: (d.note || "").trim() || undefined,
      tags: (d.tags ?? []).map((tag) => tag.id),
      difficulty: d.difficulty ?? defaultDifficulty,
      end_date: toEndOfDayUtcIso(d.endDate ?? null) ?? undefined,
    }));
    if (!defs.length) {
      toast.error(t("definitionRequired"));
      return;
    }
    try {
      await fetcher(`/api/pending/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordId,
          language: requestLanguage,
          definitions: defs,
        }),
      });
      const createdDefinitions = values.definitions
        .map((item) => ({
          text: item.definition.trim(),
          difficulty: item.difficulty ?? defaultDifficulty,
        }))
        .filter((item) => item.text.length > 0);
      onCreated?.({
        wordId,
        definitions: createdDefinitions,
        language: requestLanguage,
      });
      setAiHistoryByField({});
      increment({ words: 1, descriptions: defs.length });
      toast.success(t("new"));
      onOpenChange(false);
      reset({
        definitions: [{ definition: "", note: "", difficulty: defaultDifficulty, endDate: null, tags: [] }],
      });
    } catch (e: unknown) {
      const { code, status } = getActionErrorMeta(e);
      if (status === 403) toast.error(t("forbidden"));
      else if (code === "DEFINITION_REQUIRED") toast.error(t("definitionRequired"));
      else toast.error(t("saveError"));
    }
  });

  const listId = useId();
  const resetForm = useCallback(() => {
    generationSession.current += 1;
    cancelGeneration?.();
    setGeneratingField(null);
    setSuggestionsByField({});
    setAiHistoryByField({});
    reset({ definitions: [{ definition: "", note: "", difficulty: defaultDifficulty, endDate: null, tags: [] }] });
    replace([{ definition: "", note: "", difficulty: defaultDifficulty, endDate: null, tags: [] }]);
  }, [cancelGeneration, replace, reset, defaultDifficulty]);

  const resolvePanelPosition = useCallback(
    (anchor?: { x: number; y: number }) => {
      const margin = 16;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const width = panelSize.width;
      const height = panelSize.height;
      const maxX = Math.max(margin, W - width - margin);
      const maxY = Math.max(margin, H - height - margin);
      const clampX = (value: number) => Math.min(Math.max(margin, value), maxX);
      const clampY = (value: number) => Math.min(Math.max(margin, value), maxY);

      if (anchor) {
        const gap = 12;
        const preferredLeft = anchor.x - width - gap;
        const preferredRight = anchor.x + gap;
        const x =
          preferredLeft >= margin ? preferredLeft : preferredRight <= maxX ? preferredRight : anchor.x - width / 2;
        return {
          x: clampX(x),
          y: clampY(anchor.y - 48),
        };
      }

      const baseHeight = initialPanelHeightRef.current || height;
      return {
        x: margin,
        y: clampY(Math.floor((H - baseHeight) / 2)),
      };
    },
    [panelSize.height, panelSize.width],
  );

  useEffect(() => {
    // detect mobile viewport
    if (typeof window !== "undefined") {
      const mql = window.matchMedia("(max-width: 767px)");
      const apply = () => setIsMobile(mql.matches);
      apply();
      mql.addEventListener?.("change", apply);
      return () => mql.removeEventListener?.("change", apply);
    }
    return () => {};
  }, []);

  useEffect(() => {
    if (!open) return;
    setCollapsed(addDefCollapsed?.wordId === wordId);
  }, [open, addDefCollapsed, wordId]);
  // Reset form content and local UI state on open/word change to avoid stale generated values
  // biome-ignore lint/correctness/useExhaustiveDependencies: do not re-run on panel size changes to avoid form reset
  useEffect(() => {
    if (!open) return;
    // clear content fields on open
    resetForm();
    if (typeof window !== "undefined") {
      mountedRef.current = true;
      setPos(resolvePanelPosition(openAnchor));
    }
  }, [open, openAnchor?.x, openAnchor?.y, resetForm, wordId]);
  // Clear global collapsed state on unmount/close if it belongs to this modal
  useEffect(() => {
    if (!open && addDefCollapsed?.wordId === wordId) clearAddDef();
  }, [open, addDefCollapsed, clearAddDef, wordId]);
  // Reset when modal fully closes to ensure carousel starts from first slide next open
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);
  // close with Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  // keep panel inside viewport on window resize and preserve left snap (no size changes)
  useEffect(() => {
    if (!open) return;
    function onResize() {
      if (!mountedRef.current) return;
      const margin = 16;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const maxX = Math.max(margin, W - panelSize.width - margin);
      const maxY = Math.max(margin, H - panelSize.height - margin);
      let { x, y } = pos;
      // if near left edge, keep docked; otherwise clamp inside viewport
      if (x <= margin + 4) x = margin;
      else x = Math.min(Math.max(margin, x), maxX);
      // vertically center on resize
      const yCentered = Math.floor((H - panelSize.height) / 2);
      y = Math.min(Math.max(margin, yCentered), maxY);
      setPos({ x, y });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, pos, panelSize.height, panelSize.width]);

  // Re-clamp position when persisted size changes while open (rehydration or other windows)
  useEffect(() => {
    if (!open) return;
    const margin = 16;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const maxX = Math.max(margin, W - panelSize.width - margin);
    const maxY = Math.max(margin, H - panelSize.height - margin);
    setPos((prev) => {
      let x = prev.x;
      let y = prev.y;
      if (x <= margin + 4) x = margin;
      else x = Math.min(Math.max(margin, x), maxX);
      const yCentered = Math.floor((H - panelSize.height) / 2);
      y = Math.min(Math.max(margin, yCentered), maxY);
      if (x === prev.x && y === prev.y) return prev;
      return { x, y };
    });
  }, [open, panelSize.height, panelSize.width]);
  if (!open) return null;

  // Mobile full-screen modal version
  if (isMobile) {
    return (
      <TooltipProvider>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="p-0 w-full max-w-none h-dvh min-w-0" aria-describedby={undefined}>
            <DialogTitle className="sr-only">
              {t("addDefinition")}
              {wordText ? `: ${wordText}` : ""}
            </DialogTitle>
            <div className="flex h-dvh flex-col min-w-0">
              <div className="border-b px-4 py-3 text-base font-medium">
                {t("addDefinition")} {wordText ? `: ${wordText}` : ""}
              </div>
              <div className="flex-1 min-w-0 overflow-auto p-4">
                <div className="mb-3 flex justify-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          resetForm();
                          onOpenChange(false);
                        }}
                        disabled={submitting}
                      >
                        {t("cancel")}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("cancel")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={onCreate} disabled={submitting}>
                        {t("create")}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("create")}</TooltipContent>
                  </Tooltip>
                </div>
                {wordText && (
                  <div className="text-xs text-muted-foreground mb-2">
                    {t("word")}: <span className="text-foreground font-medium">{wordText}</span>
                  </div>
                )}
                <div className="flex flex-col gap-3 min-w-0">
                  <div className="order-first flex justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() =>
                            append({ definition: "", note: "", difficulty: defaultDifficulty, endDate: null, tags: [] })
                          }
                          disabled={submitting}
                        >
                          {t("addAnotherDefinition")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("addAnotherDefinition")}</TooltipContent>
                    </Tooltip>
                  </div>
                  {fields.length > 0 && (
                    <div className="min-w-0 w-full overflow-x-hidden">
                      <DefinitionCarousel
                        className="min-w-0 w-full"
                        labelKey="definitionIndex"
                        prevKey="prev"
                        nextKey="next"
                        showTooltips
                        items={fields.map((field, idx) => {
                          const definitionLabelId = `${listId}-def-${field.id}`;
                          const noteLabelId = `${listId}-note-${field.id}`;
                          const tagInputId = `${listId}-tags-${field.id}`;
                          const current = definitions?.[idx];
                          const currentTags = current?.tags ?? [];
                          const similar = similarByDefinition[idx] ?? [];
                          return {
                            key: field.id,
                            node: (
                              <div className="rounded-md border p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {t("definition")} #{idx + 1}
                                  </span>
                                  {fields.length > 1 && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeDefinition(idx, field.id)}
                                          disabled={submitting}
                                        >
                                          {t("delete")}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{t("delete")}</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                                <DefinitionSection
                                  defLabelId={definitionLabelId}
                                  inputProps={register(`definitions.${idx}.definition` as const)}
                                  disabled={submitting}
                                  errorMessage={errors.definitions?.[idx]?.definition?.message}
                                  valueLength={current?.definition?.length ?? 0}
                                  maxLength={DEF_MAX_LENGTH}
                                  genLoading={genLoading && generatingField === field.id}
                                  aiDisabled={submitting || genLoading || !wordText}
                                  autoComplete="off"
                                  onGenerate={() => handleGenerateForIndex(idx, field.id)}
                                />
                                {visibleSuggestionsByField[field.id] && (
                                  <GeneratedDefinitions
                                    suggestions={visibleSuggestionsByField[field.id]}
                                    matchesByText={suggestionMatchesByText}
                                    disabled={submitting || genLoading}
                                    onToggle={(text, checked) => toggleSuggestion(field.id, text, checked)}
                                    onAdd={() => addSelectedSuggestions(field.id)}
                                  />
                                )}
                                <SimilarMatchesList items={similar} threshold={SIMILARITY_CONFIG.nearThreshold} />
                                <MetaSection
                                  noteLabelId={noteLabelId}
                                  noteInput={register(`definitions.${idx}.note` as const)}
                                  noteAutoComplete="off"
                                  submitting={submitting}
                                  difficulty={current?.difficulty ?? 1}
                                  difficulties={difficulties}
                                  onDifficultyChange={(n) =>
                                    setValue(`definitions.${idx}.difficulty`, n, { shouldDirty: true })
                                  }
                                  endDate={current?.endDate ?? null}
                                  onEndDateChange={(d) =>
                                    setValue(`definitions.${idx}.endDate`, d ?? null, { shouldDirty: true })
                                  }
                                  wordId={tagInputId}
                                  selectedTags={currentTags as Tag[]}
                                  onAddTag={(t) => {
                                    if (currentTags.some((tag) => tag.id === t.id)) return;
                                    setValue(`definitions.${idx}.tags`, [...currentTags, t], { shouldDirty: true });
                                  }}
                                  onRemoveTag={(id) =>
                                    setValue(
                                      `definitions.${idx}.tags`,
                                      currentTags.filter((t) => t.id !== id),
                                      { shouldDirty: true },
                                    )
                                  }
                                />
                              </div>
                            ),
                          };
                        })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay className="bg-transparent" />
          <DialogPrimitive.Content
            asChild
            onCloseAutoFocus={(event) => event.preventDefault()}
            aria-describedby={undefined}
          >
            <div className="fixed inset-0 z-50 pointer-events-none">
              {collapsed ? (
                <div className="pointer-events-auto fixed bottom-4 left-4 z-50">
                  <div className="rounded-lg border bg-background p-3 shadow-lg flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {t("addDefinition")}
                      {wordText ? `: ${wordText}` : ""}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={t("expand")}
                          onClick={() => {
                            setCollapsed(false);
                            clearAddDef();
                          }}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("expand")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={t("cancel")}
                          onClick={() => {
                            resetForm();
                            onOpenChange(false);
                            clearAddDef();
                          }}
                        >
                          <X className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("cancel")}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ) : (
                <Rnd
                  bounds="window"
                  size={{ width: panelSize.width, height: panelSize.height }}
                  position={{ x: pos.x, y: pos.y }}
                  onDragStop={(_e, d) => {
                    const margin = 16;
                    let x = d.x;
                    if (x <= margin + 4) x = margin;
                    setPos({ x, y: d.y });
                  }}
                  onResizeStop={(_e, _dir, ref, _delta, position) => {
                    const newWidth = ref.offsetWidth;
                    const newHeight = ref.offsetHeight;
                    setPanelSize({ width: newWidth, height: newHeight });
                    setPos(position);
                  }}
                  minWidth={MIN_PANEL_WIDTH}
                  minHeight={MIN_PANEL_HEIGHT}
                  enableResizing={{
                    bottom: true,
                    right: true,
                    bottomRight: true,
                    left: true,
                  }}
                  dragHandleClassName="adddef-drag-handle"
                  className="pointer-events-auto"
                >
                  <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
                    <DialogTitle className="sr-only">
                      {t("addDefinition")}
                      {wordText ? `: ${wordText}` : ""}
                    </DialogTitle>
                    <AddDefHeader
                      title={`${t("addDefinition")}${wordText ? `: ${wordText}` : ""}`}
                      onCollapse={() => {
                        setCollapsed(true);
                        collapseAddDef({ wordId, wordText });
                      }}
                      onClose={() => {
                        resetForm();
                        onOpenChange(false);
                      }}
                    />
                    <div className="flex-1 min-w-0 overflow-auto p-4">
                      {wordText && (
                        <div className="text-xs text-muted-foreground">
                          {t("word")}: <span className="text-foreground font-medium">{wordText}</span>
                        </div>
                      )}
                      <div className="mt-3 mb-1 flex justify-center gap-2 sm:hidden">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onOpenChange(false)}
                              disabled={submitting}
                            >
                              {t("cancel")}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("cancel")}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" onClick={onCreate} disabled={submitting}>
                              {t("create")}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("create")}</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="mt-3 flex flex-col gap-3 min-w-0">
                        {fields.length > 0 && (
                          <div className="min-w-0 overflow-x-hidden">
                            <DefinitionCarousel
                              className="min-w-0"
                              labelKey="definitionIndex"
                              prevKey="prev"
                              nextKey="next"
                              showTooltips
                              items={fields.map((field, idx) => {
                                const definitionLabelId = `${listId}-def-${field.id}`;
                                const noteLabelId = `${listId}-note-${field.id}`;
                                const tagInputId = `${listId}-tags-${field.id}`;
                                const current = definitions?.[idx];
                                const currentTags = current?.tags ?? [];
                                const similar = similarByDefinition[idx] ?? [];
                                return {
                                  key: field.id,
                                  node: (
                                    <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">
                                          {t("definition")} #{idx + 1}
                                        </span>
                                        {fields.length > 1 && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeDefinition(idx, field.id)}
                                                disabled={submitting}
                                              >
                                                {t("delete")}
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>{t("delete")}</TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                      <DefinitionSection
                                        defLabelId={definitionLabelId}
                                        inputProps={register(`definitions.${idx}.definition` as const)}
                                        disabled={submitting}
                                        errorMessage={errors.definitions?.[idx]?.definition?.message}
                                        valueLength={current?.definition?.length ?? 0}
                                        maxLength={DEF_MAX_LENGTH}
                                        genLoading={genLoading && generatingField === field.id}
                                        aiDisabled={submitting || genLoading || !wordText}
                                        autoComplete="off"
                                        onGenerate={() => handleGenerateForIndex(idx, field.id)}
                                      />
                                      {visibleSuggestionsByField[field.id] && (
                                        <GeneratedDefinitions
                                          suggestions={visibleSuggestionsByField[field.id]}
                                          matchesByText={suggestionMatchesByText}
                                          disabled={submitting || genLoading}
                                          onToggle={(text, checked) => toggleSuggestion(field.id, text, checked)}
                                          onAdd={() => addSelectedSuggestions(field.id)}
                                        />
                                      )}
                                      <SimilarMatchesList items={similar} threshold={SIMILARITY_CONFIG.nearThreshold} />
                                      <MetaSection
                                        noteLabelId={noteLabelId}
                                        noteInput={register(`definitions.${idx}.note` as const)}
                                        noteAutoComplete="off"
                                        submitting={submitting}
                                        difficulty={current?.difficulty ?? 1}
                                        difficulties={difficulties}
                                        onDifficultyChange={(n) =>
                                          setValue(`definitions.${idx}.difficulty`, n, { shouldDirty: true })
                                        }
                                        endDate={current?.endDate ?? null}
                                        onEndDateChange={(d) =>
                                          setValue(`definitions.${idx}.endDate`, d ?? null, { shouldDirty: true })
                                        }
                                        wordId={tagInputId}
                                        selectedTags={currentTags as Tag[]}
                                        onAddTag={(t) => {
                                          if (currentTags.some((tag) => tag.id === t.id)) return;
                                          setValue(`definitions.${idx}.tags`, [...currentTags, t], {
                                            shouldDirty: true,
                                          });
                                        }}
                                        onRemoveTag={(id) =>
                                          setValue(
                                            `definitions.${idx}.tags`,
                                            currentTags.filter((t) => t.id !== id),
                                            { shouldDirty: true },
                                          )
                                        }
                                      />
                                    </div>
                                  ),
                                };
                              })}
                            />
                          </div>
                        )}
                        <div className="order-first flex justify-center sm:order-last sm:justify-start">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  append({
                                    definition: "",
                                    note: "",
                                    difficulty: defaultDifficulty,
                                    endDate: null,
                                    tags: [],
                                  })
                                }
                                disabled={submitting}
                              >
                                {t("addAnotherDefinition")}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("addAnotherDefinition")}</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                    <div className="border-t px-4 py-2 hidden justify-end gap-2 sm:flex">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                            {t("cancel")}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("cancel")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={onCreate} disabled={submitting}>
                            {t("create")}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("create")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </Rnd>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </TooltipProvider>
  );
}
