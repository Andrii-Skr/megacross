"use client";

import { ChevronLeft, ChevronRight, KeyRound, Loader2, Radar, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DictionaryFilterInput } from "@/types/dictionary-bulk";
import type {
  FillReviewStartPosition,
  TemplateSetupFixedSlot,
  TemplateSetupPreviewTemplate,
  TemplateSetupTemplate,
  WordImageOption,
} from "./model";

type DictionaryWordCandidate = {
  id: string;
  word_text: string;
};

type DictionaryCacheEntry = {
  items: DictionaryWordCandidate[];
  nextCursor: string | null;
  initialized: boolean;
  exhausted: boolean;
};

const AUTOCOMPLETE_MIN_LETTERS = 2;
const AUTOCOMPLETE_BATCH_SIZE = 50;
const AUTOCOMPLETE_MAX_RESULTS = 24;
const AUTOCOMPLETE_MAX_SCANNED = 300;
const AUTOCOMPLETE_PAGE_SIZE = 16;
const AUTOCOMPLETE_ROWS_VISIBLE = 4;

type TemplateSetupPanelProps = {
  active: boolean;
  loading: boolean;
  error: string | null;
  dictionaryFilter: DictionaryFilterInput | null;
  dictionaryLanguage: string;
  dictionaryReady: boolean;
  templates: TemplateSetupPreviewTemplate[];
  templateMap: Map<string, TemplateSetupTemplate>;
  onKeywordChange: (templateKey: string, keyword: string) => void;
  onFixedSlotChange: (templateKey: string, fixedSlot: TemplateSetupFixedSlot) => void;
  onFixedSlotClear: (templateKey: string, slotId: number) => void;
};

function slotLabel(slot: TemplateSetupPreviewTemplate["slots"][number]) {
  const start = slot.startNumber != null ? `${slot.startNumber}. ` : "";
  const dir = slot.dir === "right" ? "→" : "↓";
  return `${start}${dir} ${slot.len}`;
}

function normalizeOtpLetters(value: string): string[] {
  return Array.from(value.replace(/\s+/g, "").toUpperCase()).filter((char) => /\p{L}/u.test(char));
}

function buildOtpWord(value: string | null | undefined, len: number): string[] {
  const chars = normalizeOtpLetters(value ?? "").slice(0, len);
  return Array.from({ length: len }, (_, index) => chars[index] ?? "");
}

function buildLockedSlotLetters(
  template: TemplateSetupPreviewTemplate,
  fixedSlotMap: Map<number, TemplateSetupFixedSlot>,
): Map<number, Map<number, string>> {
  const fixedLettersByCell = new Map<string, Array<{ slotId: number; letter: string }>>();

  for (const slot of template.slots) {
    const fixed = fixedSlotMap.get(slot.slotId);
    if (!fixed) continue;
    const letters = Array.from(fixed.word.toUpperCase());
    slot.cells.forEach(([row, col], index) => {
      const letter = letters[index] ?? "";
      if (!letter) return;
      const key = `${row},${col}`;
      const current = fixedLettersByCell.get(key) ?? [];
      current.push({ slotId: slot.slotId, letter });
      fixedLettersByCell.set(key, current);
    });
  }

  const lockedBySlotId = new Map<number, Map<number, string>>();
  for (const slot of template.slots) {
    const locked = new Map<number, string>();
    slot.cells.forEach(([row, col], index) => {
      const cellSources = fixedLettersByCell.get(`${row},${col}`) ?? [];
      const source = cellSources.find((item) => item.slotId !== slot.slotId);
      if (source?.letter) locked.set(index, source.letter);
    });
    lockedBySlotId.set(slot.slotId, locked);
  }

  return lockedBySlotId;
}

function applyLockedLettersToWord(baseWord: string[], len: number, lockedLetters: Map<number, string>): string[] {
  const next = Array.from({ length: len }, (_, index) => baseWord[index] ?? "");
  for (const [index, letter] of lockedLetters) {
    if (index < 0 || index >= len) continue;
    next[index] = letter;
  }
  return next;
}

function wordMatchesLockedLetters(word: string, lockedLetters: Map<number, string>): boolean {
  const normalized = normalizeOtpLetters(word).join("");
  for (const [index, letter] of lockedLetters) {
    if (normalized[index] !== letter) return false;
  }
  return true;
}

function buildKnownLettersMap(word: string[]): Map<number, string> {
  const knownLetters = new Map<number, string>();
  word.forEach((letter, index) => {
    if (letter) knownLetters.set(index, letter);
  });
  return knownLetters;
}

function buildSearchSeed(word: string[]): { query: string; mode: "contains" | "startsWith" | "exact" } | null {
  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;
  let currentLength = 0;

  word.forEach((letter, index) => {
    if (letter) {
      if (currentLength === 0) currentStart = index;
      currentLength += 1;
      if (currentLength > bestLength) {
        bestStart = currentStart;
        bestLength = currentLength;
      }
      return;
    }
    currentStart = -1;
    currentLength = 0;
  });

  if (bestLength < AUTOCOMPLETE_MIN_LETTERS || bestStart < 0) return null;

  const query = word.slice(bestStart, bestStart + bestLength).join("");
  if (bestLength === word.length) return { query, mode: "exact" };
  if (bestStart === 0) return { query, mode: "startsWith" };
  return { query, mode: "contains" };
}

function buildDictionaryFilterCacheKey(filter: DictionaryFilterInput | null): string {
  if (!filter) return "none";
  return JSON.stringify({
    language: filter.language,
    query: filter.query ?? null,
    scope: filter.scope ?? null,
    tagNames: filter.tagNames ?? [],
    excludeTagNames: filter.excludeTagNames ?? [],
    searchMode: filter.searchMode ?? null,
    lenFilterField: filter.lenFilterField ?? null,
    lenMin: filter.lenMin ?? null,
    lenMax: filter.lenMax ?? null,
    difficultyMin: filter.difficultyMin ?? null,
    difficultyMax: filter.difficultyMax ?? null,
  });
}

function buildAutocompleteCacheKey(params: {
  dictionaryFilterCacheKey: string;
  dictionaryLanguage: string;
  slotLength: number;
  searchSeed: { query: string; mode: "contains" | "startsWith" | "exact" } | null;
}): string {
  const { dictionaryFilterCacheKey, dictionaryLanguage, slotLength, searchSeed } = params;
  return `${dictionaryFilterCacheKey}:${dictionaryLanguage || "ru"}:${slotLength}:${searchSeed?.mode ?? "scan"}:${searchSeed?.query ?? ""}`;
}

function appendDictionaryFilterToParams(params: URLSearchParams, filter: DictionaryFilterInput | null) {
  if (!filter) return;
  params.set("lang", filter.language);
  params.set("scope", filter.scope ?? "word");
  if (filter.query?.trim()) params.set("q", filter.query.trim());
  if (filter.searchMode === "startsWith" || filter.searchMode === "exact") {
    params.set("mode", filter.searchMode);
  }
  if (typeof filter.difficultyMin === "number") params.set("difficultyMin", String(filter.difficultyMin));
  if (typeof filter.difficultyMax === "number") params.set("difficultyMax", String(filter.difficultyMax));
  for (const tagName of filter.tagNames ?? []) {
    params.append("tags", tagName);
  }
  for (const tagName of filter.excludeTagNames ?? []) {
    params.append("excludeTags", tagName);
  }
}

function wordMatchesKnownLetters(word: string, knownLetters: Map<number, string>): boolean {
  const normalized = normalizeOtpLetters(word).join("");
  for (const [index, letter] of knownLetters) {
    if (normalized[index] !== letter) return false;
  }
  return true;
}

function scoreCandidateWord(
  word: string,
  knownLetters: Map<number, string>,
  lockedLetters: Map<number, string>,
): number {
  const normalized = normalizeOtpLetters(word).join("");
  let score = 0;
  for (const [index] of knownLetters) {
    score += lockedLetters.has(index) ? 100 : 10;
    if (index === 0) score += 5;
    if (index > 0 && normalized[index - 1] && knownLetters.has(index - 1)) score += 1;
  }
  return score;
}

function buildStartsByCell(startPositions: FillReviewStartPosition[]): Map<string, FillReviewStartPosition[]> {
  const map = new Map<string, FillReviewStartPosition[]>();
  for (const start of startPositions) {
    const key = `${start.r},${start.c}`;
    const list = map.get(key) ?? [];
    list.push(start);
    map.set(key, list);
  }
  for (const [key, list] of map) {
    map.set(
      key,
      [...list].sort((left, right) => left.dir.localeCompare(right.dir) || left.slotId - right.slotId),
    );
  }
  return map;
}

function startLabel(start: FillReviewStartPosition) {
  return `${start.number}. ${start.dir === "right" ? "→" : "↓"}`;
}

function buildPreviewArrowDataUrl(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${markup}</svg>`,
  )}`;
}

export function TemplateSetupPanel({
  active,
  loading,
  error,
  dictionaryFilter,
  dictionaryLanguage,
  dictionaryReady,
  templates,
  templateMap,
  onKeywordChange,
  onFixedSlotChange,
  onFixedSlotClear,
}: TemplateSetupPanelProps) {
  const t = useTranslations();
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [pendingStarts, setPendingStarts] = useState<FillReviewStartPosition[] | null>(null);
  const [modalWord, setModalWord] = useState<string[]>([]);
  const [modalCandidates, setModalCandidates] = useState<DictionaryWordCandidate[]>([]);
  const [modalCandidatesPage, setModalCandidatesPage] = useState(0);
  const [modalSearchAllowEmpty, setModalSearchAllowEmpty] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalImages, setModalImages] = useState<WordImageOption[]>([]);
  const [modalImagesLoading, setModalImagesLoading] = useState(false);
  const [modalImageBusy, setModalImageBusy] = useState(false);
  const [modalImageError, setModalImageError] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const dictionaryCacheRef = useRef<Map<string, DictionaryCacheEntry>>(new Map());

  useEffect(() => {
    if (!templates.length) {
      setSelectedTemplateKey(null);
      return;
    }
    if (!selectedTemplateKey || !templates.some((item) => item.key === selectedTemplateKey)) {
      setSelectedTemplateKey(templates[0]?.key ?? null);
    }
  }, [selectedTemplateKey, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.key === selectedTemplateKey) ?? null,
    [selectedTemplateKey, templates],
  );
  const hasPreview = templates.length > 0;
  const selectedSetup = selectedTemplate ? (templateMap.get(selectedTemplate.key) ?? null) : null;

  const fixedSlotMap = useMemo(
    () => new Map((selectedSetup?.fixedSlots ?? []).map((item) => [item.slotId, item])),
    [selectedSetup],
  );

  const fixedCellSet = useMemo(() => {
    if (!selectedTemplate) return new Set<string>();
    const set = new Set<string>();
    for (const slot of selectedTemplate.slots) {
      if (!fixedSlotMap.has(slot.slotId)) continue;
      for (const [row, col] of slot.cells) set.add(`${row},${col}`);
    }
    return set;
  }, [fixedSlotMap, selectedTemplate]);
  const fixedLetterByCell = useMemo(() => {
    if (!selectedTemplate) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const slot of selectedTemplate.slots) {
      const fixed = fixedSlotMap.get(slot.slotId);
      if (!fixed) continue;
      const letters = Array.from(fixed.word.toUpperCase());
      slot.cells.forEach(([row, col], index) => {
        const letter = letters[index] ?? "";
        if (!letter) return;
        map.set(`${row},${col}`, letter);
      });
    }
    return map;
  }, [fixedSlotMap, selectedTemplate]);

  const previewCellByKey = useMemo(() => {
    const map = new Map<string, TemplateSetupPreviewTemplate["cells"][number]>();
    for (const cell of selectedTemplate?.cells ?? []) {
      map.set(`${cell.row},${cell.col}`, cell);
    }
    return map;
  }, [selectedTemplate]);
  const previewArrowByKey = useMemo(() => {
    const map = new Map<string, TemplateSetupPreviewTemplate["arrows"][number]>();
    for (const arrow of selectedTemplate?.arrows ?? []) {
      map.set(`${arrow.row},${arrow.col}`, arrow);
    }
    return map;
  }, [selectedTemplate]);

  const startsByCell = useMemo(() => buildStartsByCell(selectedTemplate?.startPositions ?? []), [selectedTemplate]);
  const slotById = useMemo(
    () => new Map((selectedTemplate?.slots ?? []).map((slot) => [slot.slotId, slot])),
    [selectedTemplate],
  );
  const lockedLettersBySlotId = useMemo(
    () =>
      selectedTemplate
        ? buildLockedSlotLetters(selectedTemplate, fixedSlotMap)
        : new Map<number, Map<number, string>>(),
    [fixedSlotMap, selectedTemplate],
  );

  const editingSlot = useMemo(
    () => selectedTemplate?.slots.find((slot) => slot.slotId === editingSlotId) ?? null,
    [editingSlotId, selectedTemplate],
  );
  const editingFixedSlot = editingSlot ? (fixedSlotMap.get(editingSlot.slotId) ?? null) : null;
  const editingWordId = editingFixedSlot?.wordId ?? null;
  const editingSelectedImageId = editingFixedSlot?.imageId ?? null;
  const editingPhotoAreaBounds = editingSlot?.photoAreaBounds ?? null;
  const editingIsPhotoDefinition = editingSlot?.isPhotoDefinition === true;
  const editingLockedLetters = useMemo(
    () => (editingSlot ? (lockedLettersBySlotId.get(editingSlot.slotId) ?? new Map<number, string>()) : new Map()),
    [editingSlot, lockedLettersBySlotId],
  );
  const modalOpen = Boolean(selectedTemplate && editingSlot);
  const modalKnownLetters = useMemo(() => buildKnownLettersMap(modalWord), [modalWord]);
  const modalSearchSeed = useMemo(() => buildSearchSeed(modalWord), [modalWord]);
  const dictionaryFilterCacheKey = useMemo(() => buildDictionaryFilterCacheKey(dictionaryFilter), [dictionaryFilter]);
  const resolvedEditingImageId = useMemo(() => {
    if (modalImages.length === 0) return null;
    if (editingSelectedImageId && modalImages.some((image) => image.id === editingSelectedImageId)) {
      return editingSelectedImageId;
    }
    return modalImages[0]?.id ?? null;
  }, [editingSelectedImageId, modalImages]);
  const activeSearchSeed = useMemo(
    () => (modalSearchAllowEmpty ? null : modalSearchSeed),
    [modalSearchAllowEmpty, modalSearchSeed],
  );
  const activeAutocompleteCacheKey = useMemo(() => {
    if (!editingSlot) return null;
    return buildAutocompleteCacheKey({
      dictionaryFilterCacheKey,
      dictionaryLanguage,
      slotLength: editingSlot.len,
      searchSeed: activeSearchSeed,
    });
  }, [activeSearchSeed, dictionaryFilterCacheKey, dictionaryLanguage, editingSlot]);
  const hasNextCandidatesPage = useMemo(() => {
    const nextPageStart = (modalCandidatesPage + 1) * AUTOCOMPLETE_PAGE_SIZE;
    if (nextPageStart < modalCandidates.length) return true;
    if (!activeAutocompleteCacheKey) return false;
    return dictionaryCacheRef.current.get(activeAutocompleteCacheKey)?.exhausted === false;
  }, [activeAutocompleteCacheKey, modalCandidates.length, modalCandidatesPage]);
  const modalCandidatesPageCount = useMemo(
    () => Math.max(1, Math.ceil(modalCandidates.length / AUTOCOMPLETE_PAGE_SIZE)),
    [modalCandidates.length],
  );
  const pagedModalCandidates = useMemo(() => {
    const start = modalCandidatesPage * AUTOCOMPLETE_PAGE_SIZE;
    return modalCandidates.slice(start, start + AUTOCOMPLETE_PAGE_SIZE);
  }, [modalCandidates, modalCandidatesPage]);

  useEffect(() => {
    setModalCandidatesPage((current) => Math.min(current, modalCandidatesPageCount - 1));
  }, [modalCandidatesPageCount]);

  const focusEditableIndex = useCallback(
    (startIndex: number, direction: 1 | -1) => {
      if (!editingSlot) return;
      let nextIndex = startIndex;
      while (nextIndex >= 0 && nextIndex < editingSlot.len) {
        if (!editingLockedLetters.has(nextIndex)) {
          otpRefs.current[nextIndex]?.focus();
          otpRefs.current[nextIndex]?.select();
          return;
        }
        nextIndex += direction;
      }
    },
    [editingLockedLetters, editingSlot],
  );

  const openSlotEditor = useCallback(
    (slotId: number) => {
      if (!selectedTemplate) return;
      const slot = selectedTemplate.slots.find((item) => item.slotId === slotId);
      if (!slot) return;
      const fixed = fixedSlotMap.get(slotId) ?? null;
      const lockedLetters = lockedLettersBySlotId.get(slotId) ?? new Map<number, string>();
      setEditingSlotId(slotId);
      setPendingStarts(null);
      setModalWord(applyLockedLettersToWord(buildOtpWord(fixed?.word ?? "", slot.len), slot.len, lockedLetters));
      setModalCandidates([]);
      setModalCandidatesPage(0);
      setModalSearchAllowEmpty(false);
      setModalError(null);
      setModalLoading(false);
      window.setTimeout(() => {
        const firstEditableIndex = Array.from({ length: slot.len }, (_, index) => index).find(
          (index) => !lockedLetters.has(index),
        );
        const targetIndex = firstEditableIndex ?? 0;
        otpRefs.current[targetIndex]?.focus();
        otpRefs.current[targetIndex]?.select();
      }, 0);
    },
    [fixedSlotMap, lockedLettersBySlotId, selectedTemplate],
  );

  const closeSlotEditor = useCallback(() => {
    setEditingSlotId(null);
    setModalWord([]);
    setModalCandidates([]);
    setModalCandidatesPage(0);
    setModalSearchAllowEmpty(false);
    setModalError(null);
    setModalLoading(false);
    setModalImages([]);
    setModalImagesLoading(false);
    setModalImageBusy(false);
    setModalImageError(null);
  }, []);

  const openStartCell = useCallback(
    (starts: FillReviewStartPosition[]) => {
      if (starts.length === 0) return;
      if (starts.length === 1) {
        const [start] = starts;
        if (start) openSlotEditor(start.slotId);
        return;
      }
      setPendingStarts(starts);
    },
    [openSlotEditor],
  );

  const searchModalWord = useCallback(
    async (options?: { allowEmpty?: boolean; resetPage?: boolean; targetPage?: number }) => {
      const allowEmpty = options?.allowEmpty === true;
      const resetPage = options?.resetPage !== false;
      const targetPage = options?.targetPage ?? 0;
      const requiredCount = Math.max(AUTOCOMPLETE_MAX_RESULTS, (targetPage + 1) * AUTOCOMPLETE_PAGE_SIZE);
      if (!editingSlot || !dictionaryReady) return;
      if (!allowEmpty && modalKnownLetters.size < AUTOCOMPLETE_MIN_LETTERS) {
        setModalCandidates([]);
        if (resetPage) setModalCandidatesPage(0);
        setModalSearchAllowEmpty(allowEmpty);
        setModalError(null);
        return;
      }
      setModalSearchAllowEmpty(allowEmpty);
      setModalLoading(true);
      setModalError(null);
      try {
        const searchSeed = allowEmpty ? null : modalSearchSeed;
        const cacheKey = buildAutocompleteCacheKey({
          dictionaryFilterCacheKey,
          dictionaryLanguage,
          slotLength: editingSlot.len,
          searchSeed,
        });
        const cache =
          dictionaryCacheRef.current.get(cacheKey) ??
          ({
            items: [],
            nextCursor: null,
            initialized: false,
            exhausted: false,
          } satisfies DictionaryCacheEntry);

        let scanned = 0;
        let matches = cache.items.filter((candidate) =>
          allowEmpty
            ? wordMatchesLockedLetters(candidate.word_text, editingLockedLetters)
            : wordMatchesKnownLetters(candidate.word_text, modalKnownLetters),
        );

        while (!cache.exhausted && scanned < AUTOCOMPLETE_MAX_SCANNED && matches.length < requiredCount) {
          const params = new URLSearchParams({
            lenFilterField: "word",
            lenMin: String(editingSlot.len),
            lenMax: String(editingSlot.len),
            sortField: "word",
            sortDir: "asc",
            take: String(AUTOCOMPLETE_BATCH_SIZE),
          });
          appendDictionaryFilterToParams(params, dictionaryFilter);
          if (!params.has("lang")) {
            params.set("lang", dictionaryLanguage || "ru");
          }
          if (!params.has("scope")) {
            params.set("scope", "word");
          }
          if (searchSeed && !params.has("q")) {
            params.set("q", searchSeed.query);
            params.set("mode", searchSeed.mode);
          }
          if (cache.initialized && cache.nextCursor) params.set("cursor", cache.nextCursor);

          const res = await fetch(`/api/dictionary?${params.toString()}`, { cache: "no-store" });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(typeof data?.message === "string" ? data.message : `HTTP ${res.status}`);
          }

          const items = Array.isArray(data?.items) ? (data.items as DictionaryWordCandidate[]) : [];
          scanned += items.length;
          const existingIds = new Set(cache.items.map((candidate) => candidate.id));
          for (const candidate of items) {
            if (existingIds.has(candidate.id)) continue;
            cache.items.push(candidate);
            existingIds.add(candidate.id);
          }
          cache.initialized = true;
          cache.nextCursor = typeof data?.nextCursor === "string" ? data.nextCursor : null;
          cache.exhausted = !cache.nextCursor || items.length === 0;
          dictionaryCacheRef.current.set(cacheKey, cache);
          matches = cache.items.filter((candidate) =>
            allowEmpty
              ? wordMatchesLockedLetters(candidate.word_text, editingLockedLetters)
              : wordMatchesKnownLetters(candidate.word_text, modalKnownLetters),
          );
        }

        const items = matches
          .slice()
          .sort((left, right) => {
            const scoreDiff =
              scoreCandidateWord(right.word_text, modalKnownLetters, editingLockedLetters) -
              scoreCandidateWord(left.word_text, modalKnownLetters, editingLockedLetters);
            if (scoreDiff !== 0) return scoreDiff;
            return left.word_text.localeCompare(right.word_text, dictionaryLanguage || "ru");
          })
          .slice(0, requiredCount);

        setModalCandidates(items);
        if (resetPage) setModalCandidatesPage(0);
        if (items.length === 0) {
          setModalError(t("scanwordsTemplateSetupNoMatches"));
        }
        return items.length;
      } catch (err) {
        setModalCandidates([]);
        if (resetPage) setModalCandidatesPage(0);
        setModalError(err instanceof Error ? err.message : t("scanwordsTemplateSetupLoadError"));
        return 0;
      } finally {
        setModalLoading(false);
      }
    },
    [
      dictionaryFilter,
      dictionaryFilterCacheKey,
      dictionaryLanguage,
      dictionaryReady,
      editingLockedLetters,
      editingSlot,
      modalKnownLetters,
      modalSearchSeed,
      t,
    ],
  );

  const handleNextCandidatesPage = useCallback(async () => {
    const nextPage = modalCandidatesPage + 1;
    const nextPageStart = nextPage * AUTOCOMPLETE_PAGE_SIZE;
    if (nextPageStart < modalCandidates.length) {
      setModalCandidatesPage(nextPage);
      return;
    }

    const loadedCount =
      (await searchModalWord({
        allowEmpty: modalSearchAllowEmpty,
        resetPage: false,
        targetPage: nextPage,
      })) ?? 0;

    if (loadedCount > nextPageStart) {
      setModalCandidatesPage(nextPage);
    }
  }, [modalCandidates.length, modalCandidatesPage, modalSearchAllowEmpty, searchModalWord]);

  useEffect(() => {
    if (!modalOpen || !editingSlot || !dictionaryReady) return;
    if (modalKnownLetters.size < AUTOCOMPLETE_MIN_LETTERS) {
      setModalCandidates([]);
      setModalCandidatesPage(0);
      setModalLoading(false);
      setModalError(null);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void searchModalWord();
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [dictionaryReady, editingSlot, modalKnownLetters, modalOpen, searchModalWord]);

  const refreshModalImages = useCallback(
    async (wordId: string) => {
      setModalImagesLoading(true);
      setModalImageError(null);
      try {
        const response = await fetch(`/api/dictionary/word/${encodeURIComponent(wordId)}/images`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as { images?: WordImageOption[]; message?: string };
        if (!response.ok) {
          throw new Error(
            typeof payload.message === "string" && payload.message.trim().length > 0
              ? payload.message
              : t("scanwordsTemplateSetupImageLoadError"),
          );
        }
        setModalImages(Array.isArray(payload.images) ? payload.images : []);
      } catch (error) {
        setModalImages([]);
        setModalImageError(error instanceof Error ? error.message : t("scanwordsTemplateSetupImageLoadError"));
      } finally {
        setModalImagesLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!modalOpen || !editingWordId || !editingIsPhotoDefinition) {
      setModalImages((current) => (current.length > 0 ? [] : current));
      setModalImagesLoading(false);
      setModalImageError(null);
      return;
    }
    void refreshModalImages(editingWordId);
  }, [editingIsPhotoDefinition, editingWordId, modalOpen, refreshModalImages]);

  useEffect(() => {
    if (!selectedTemplate || !editingFixedSlot || resolvedEditingImageId === editingSelectedImageId) return;
    onFixedSlotChange(selectedTemplate.key, {
      ...editingFixedSlot,
      imageId: resolvedEditingImageId,
    });
  }, [editingFixedSlot, editingSelectedImageId, onFixedSlotChange, resolvedEditingImageId, selectedTemplate]);

  const handleModalImageUpload = useCallback(
    async (file: File) => {
      if (!editingWordId) return;
      setModalImageBusy(true);
      setModalImageError(null);
      try {
        const formData = new FormData();
        formData.set("file", file);
        if (editingPhotoAreaBounds) {
          formData.set("targetWidth", String(editingPhotoAreaBounds.maxCol - editingPhotoAreaBounds.minCol + 1));
          formData.set("targetHeight", String(editingPhotoAreaBounds.maxRow - editingPhotoAreaBounds.minRow + 1));
        }
        const response = await fetch(`/api/dictionary/word/${encodeURIComponent(editingWordId)}/images`, {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        if (!response.ok) {
          throw new Error(
            typeof payload.message === "string" && payload.message.trim().length > 0
              ? payload.message
              : t("scanwordsTemplateSetupImageUploadError"),
          );
        }
        await refreshModalImages(editingWordId);
      } catch (error) {
        setModalImageError(error instanceof Error ? error.message : t("scanwordsTemplateSetupImageUploadError"));
      } finally {
        setModalImageBusy(false);
      }
    },
    [editingPhotoAreaBounds, editingWordId, refreshModalImages, t],
  );

  const handleModalImageDelete = useCallback(
    async (imageId: string) => {
      if (!editingWordId) return;
      setModalImageBusy(true);
      setModalImageError(null);
      try {
        const response = await fetch(
          `/api/dictionary/word/${encodeURIComponent(editingWordId)}/images/${encodeURIComponent(imageId)}`,
          { method: "DELETE" },
        );
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        if (!response.ok) {
          throw new Error(
            typeof payload.message === "string" && payload.message.trim().length > 0
              ? payload.message
              : t("scanwordsTemplateSetupImageDeleteError"),
          );
        }
        if (selectedTemplate && editingSlot && editingFixedSlot?.imageId === imageId) {
          onFixedSlotChange(selectedTemplate.key, {
            ...editingFixedSlot,
            imageId: null,
          });
        }
        await refreshModalImages(editingWordId);
      } catch (error) {
        setModalImageError(error instanceof Error ? error.message : t("scanwordsTemplateSetupImageDeleteError"));
      } finally {
        setModalImageBusy(false);
      }
    },
    [editingFixedSlot, editingSlot, editingWordId, onFixedSlotChange, refreshModalImages, selectedTemplate, t],
  );

  const handleModalImageSelect = useCallback(
    (imageId: string | null) => {
      if (!selectedTemplate || !editingFixedSlot) return;
      onFixedSlotChange(selectedTemplate.key, {
        ...editingFixedSlot,
        imageId,
      });
    },
    [editingFixedSlot, onFixedSlotChange, selectedTemplate],
  );

  const applyOtpInput = useCallback(
    (index: number, rawValue: string) => {
      if (!editingSlot) return;
      if (editingLockedLetters.has(index)) return;
      const letters = normalizeOtpLetters(rawValue);
      setModalCandidates([]);
      setModalCandidatesPage(0);
      setModalError(null);
      setModalWord((current) => {
        const next = [...current];
        if (letters.length <= 1) {
          next[index] = letters[0] ?? "";
          return next;
        }
        let targetIndex = index;
        for (const letter of letters) {
          while (targetIndex < editingSlot.len && editingLockedLetters.has(targetIndex)) {
            targetIndex += 1;
          }
          if (targetIndex >= editingSlot.len) break;
          next[targetIndex] = letter;
          targetIndex += 1;
        }
        return next;
      });
      if (letters.length === 0) return;
      window.setTimeout(() => {
        focusEditableIndex(index + Math.max(letters.length, 1), 1);
      }, 0);
    },
    [editingLockedLetters, editingSlot, focusEditableIndex],
  );

  const handleOtpKeyDown = useCallback(
    (index: number, event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (!editingSlot) return;
      if (editingLockedLetters.has(index)) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        setModalCandidates([]);
        setModalCandidatesPage(0);
        setModalError(null);
        if (modalWord[index]) {
          setModalWord((current) => {
            const next = [...current];
            next[index] = "";
            return next;
          });
          return;
        }
        focusEditableIndex(index - 1, -1);
        return;
      }
      if (event.key === "Delete") {
        event.preventDefault();
        setModalCandidates([]);
        setModalCandidatesPage(0);
        setModalError(null);
        setModalWord((current) => {
          const next = [...current];
          next[index] = "";
          return next;
        });
        return;
      }
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        focusEditableIndex(index - 1, -1);
        return;
      }
      if (event.key === "ArrowRight" && index < editingSlot.len - 1) {
        event.preventDefault();
        focusEditableIndex(index + 1, 1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
      }
    },
    [editingLockedLetters, editingSlot, focusEditableIndex, modalWord],
  );

  useEffect(() => {
    if (!editingSlot || modalWord.length === editingSlot.len) return;
    setModalWord((current) =>
      current.length === editingSlot.len
        ? current
        : Array.from({ length: editingSlot.len }, (_, index) => current[index] ?? ""),
    );
  }, [editingSlot, modalWord.length]);

  if (!active) return <div className="hidden" aria-hidden />;

  return (
    <div aria-hidden={!active}>
      <Dialog open={Boolean(pendingStarts?.length)} onOpenChange={(next) => (!next ? setPendingStarts(null) : null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Выберите слот</DialogTitle>
            <DialogDescription>В этой клетке начинается несколько слов. Выберите нужное направление.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {(pendingStarts ?? []).map((start) => (
              <Button
                key={`${start.slotId}:${start.dir}`}
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => openSlotEditor(start.slotId)}
              >
                {(() => {
                  const slot = slotById.get(start.slotId) ?? null;
                  return slot ? `Слот ${slotLabel(slot)}` : `Слот ${startLabel(start)}`;
                })()}
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingStarts(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={(next) => (!next ? closeSlotEditor() : null)}>
        <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingSlot ? `Слот ${slotLabel(editingSlot)}` : "Выбор слова"}</DialogTitle>
            <DialogDescription>
              Введите хотя бы две буквы. Ниже автоматически появятся словарные слова подходящей длины и с учетом
              пересечений.
            </DialogDescription>
          </DialogHeader>

          {editingSlot && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{slotLabel(editingSlot)}</Badge>
                <span>
                  Старт: ({editingSlot.r + 1}, {editingSlot.c + 1})
                </span>
                {editingFixedSlot ? <Badge variant="secondary">{editingFixedSlot.word}</Badge> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from({ length: editingSlot.len }, (_, index) =>
                  (() => {
                    const isLocked = editingLockedLetters.has(index);
                    return (
                      <Input
                        key={`${editingSlot.slotId}:${index}`}
                        ref={(node) => {
                          otpRefs.current[index] = node;
                        }}
                        value={modalWord[index] ?? ""}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          applyOtpInput(index, value);
                        }}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        className={cn(
                          "h-11 w-11 text-center text-base font-semibold uppercase",
                          isLocked ? "border-sky-400 bg-sky-50 text-sky-900" : "",
                        )}
                        autoComplete="off"
                        inputMode="text"
                        maxLength={1}
                        readOnly={isLocked}
                        aria-readonly={isLocked}
                      />
                    );
                  })(),
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {modalLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {t("scanwordsTemplateSetupSearching")}
                  </span>
                ) : modalKnownLetters.size < AUTOCOMPLETE_MIN_LETTERS ? (
                  <span>{t("scanwordsTemplateSetupTypeMore", { count: AUTOCOMPLETE_MIN_LETTERS })}</span>
                ) : modalCandidates.length > 0 ? (
                  <span>{t("scanwordsTemplateSetupSuggestionsFound", { count: modalCandidates.length })}</span>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={!dictionaryReady || modalLoading}
                      onClick={() => void searchModalWord({ allowEmpty: true })}
                    >
                      <Radar className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("scanwordsTemplateSetupFindAll")}</TooltipContent>
                </Tooltip>
                {editingFixedSlot && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (!selectedTemplate) return;
                      onFixedSlotClear(selectedTemplate.key, editingSlot.slotId);
                      closeSlotEditor();
                    }}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Очистить слот
                  </Button>
                )}
              </div>

              {modalError && <p className="text-sm text-destructive">{modalError}</p>}

              {modalCandidates.length > 0 && (
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="absolute inset-y-1 left-0 z-10 h-auto w-9 rounded-full px-0 shadow-sm"
                    disabled={modalCandidatesPage === 0}
                    onClick={() => setModalCandidatesPage((current) => Math.max(0, current - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>

                  <div className="min-w-0 px-11">
                    <div
                      className="grid grid-cols-4 content-start gap-2 overflow-hidden"
                      style={{
                        minHeight: `calc(${AUTOCOMPLETE_ROWS_VISIBLE} * 2.25rem + ${(AUTOCOMPLETE_ROWS_VISIBLE - 1) * 0.5}rem)`,
                      }}
                    >
                      {pagedModalCandidates.map((candidate) => (
                        <Button
                          key={candidate.id}
                          type="button"
                          variant={editingFixedSlot?.wordId === candidate.id ? "secondary" : "outline"}
                          onClick={() => {
                            if (!selectedTemplate) return;
                            if (!wordMatchesLockedLetters(candidate.word_text, editingLockedLetters)) {
                              setModalError("Слово не подходит по уже заполненным пересечениям.");
                              return;
                            }
                            onFixedSlotChange(selectedTemplate.key, {
                              slotId: editingSlot.slotId,
                              wordId: candidate.id,
                              word: candidate.word_text,
                              imageId: null,
                            });
                            setModalWord(
                              applyLockedLettersToWord(
                                buildOtpWord(candidate.word_text, editingSlot.len),
                                editingSlot.len,
                                editingLockedLetters,
                              ),
                            );
                            setModalImageError(null);
                            if (!editingIsPhotoDefinition) {
                              closeSlotEditor();
                            }
                          }}
                          disabled={!wordMatchesLockedLetters(candidate.word_text, editingLockedLetters)}
                        >
                          {candidate.word_text}
                        </Button>
                      ))}
                    </div>
                    {modalCandidatesPageCount > 1 && (
                      <div className="mt-2 text-center text-xs text-muted-foreground">
                        {modalCandidatesPage + 1} / {modalCandidatesPageCount}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="absolute inset-y-1 right-0 z-10 h-auto w-9 rounded-full px-0 shadow-sm"
                    disabled={!hasNextCandidatesPage || modalLoading}
                    onClick={() => void handleNextCandidatesPage()}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}

              {editingIsPhotoDefinition && (
                <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{t("scanwordsTemplateSetupImageSectionTitle")}</div>
                      <div className="text-xs text-muted-foreground">{t("scanwordsTemplateSetupImageHint")}</div>
                    </div>
                    <div>
                      <input
                        id="template-setup-word-image-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={!editingWordId || modalImageBusy}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          if (!file) return;
                          void handleModalImageUpload(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!editingWordId || modalImageBusy}
                        onClick={() => {
                          const input = document.getElementById(
                            "template-setup-word-image-upload",
                          ) as HTMLInputElement | null;
                          input?.click();
                        }}
                      >
                        {modalImageBusy ? t("loading") : t("scanwordsReviewImageUpload")}
                      </Button>
                    </div>
                  </div>

                  {!editingWordId && (
                    <div className="text-xs text-muted-foreground">{t("scanwordsTemplateSetupImageWordRequired")}</div>
                  )}

                  {modalImagesLoading && <div className="text-xs text-muted-foreground">{t("loading")}</div>}

                  {editingWordId && !modalImagesLoading && modalImages.length === 0 && (
                    <div className="text-xs text-muted-foreground">{t("scanwordsTemplateSetupImageEmpty")}</div>
                  )}

                  {modalImages.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {modalImages.map((image) => (
                        <div
                          key={image.id}
                          className={cn(
                            "grid min-h-0 gap-2 rounded border bg-background p-2",
                            resolvedEditingImageId === image.id ? "border-sky-500 bg-sky-500/10" : "border-border",
                          )}
                        >
                          <button
                            type="button"
                            className="overflow-hidden rounded border bg-background"
                            onClick={() => handleModalImageSelect(image.id)}
                            disabled={modalImageBusy}
                          >
                            <Image
                              src={image.url}
                              alt={image.fileName}
                              width={image.width}
                              height={image.height}
                              className="h-24 w-full object-contain"
                              unoptimized
                            />
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "min-w-0 text-left text-xs leading-snug",
                              resolvedEditingImageId === image.id
                                ? "font-medium text-foreground"
                                : "text-muted-foreground",
                            )}
                            onClick={() => handleModalImageSelect(image.id)}
                            disabled={modalImageBusy}
                          >
                            <span className="block break-all">{image.fileName}</span>
                            <span className="mt-1 block">
                              {t("scanwordsTemplateSetupImageMeta", { width: image.width, height: image.height })}
                            </span>
                          </button>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "text-[11px]",
                                resolvedEditingImageId === image.id
                                  ? "text-sky-600 dark:text-sky-300"
                                  : "text-transparent",
                              )}
                            >
                              {t("scanwordsTemplateSetupImageSelected")}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="ml-auto h-7 shrink-0 px-2 text-destructive"
                              onClick={() => void handleModalImageDelete(image.id)}
                              disabled={modalImageBusy}
                            >
                              {t("delete")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {modalImageError && <div className="text-xs text-destructive">{modalImageError}</div>}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeSlotEditor}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!dictionaryReady && (
          <p className="text-xs text-amber-700">
            Сначала выберите словарный шаблон на шаге словаря, иначе подбор слов для слотов будет недоступен.
          </p>
        )}

        {loading && (
          <div className="rounded-md border bg-background/80 p-4 text-sm text-muted-foreground">
            Загрузка превью шаблонов…
          </div>
        )}

        {!loading && !hasPreview && (
          <div className="rounded-md border bg-background/80 p-4 text-sm text-muted-foreground">
            После загрузки `.fsh` и нажатия «Загрузить» здесь появятся превью шаблонов.
          </div>
        )}

        {!loading && hasPreview && (
          <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Шаблоны</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {templates.map((template) => {
                  const config = templateMap.get(template.key);
                  return (
                    <Button
                      key={template.key}
                      type="button"
                      variant={selectedTemplate?.key === template.key ? "secondary" : "outline"}
                      className="h-auto justify-between gap-3 px-3 py-2"
                      onClick={() => setSelectedTemplateKey(template.key)}
                    >
                      <span className="truncate text-left text-xs font-medium">{template.sourceName}</span>
                      <span className="inline-flex shrink-0 items-center gap-2">
                        {config?.keyword ? (
                          <Badge variant="secondary" className="px-1.5">
                            <KeyRound className="size-3.5" />
                          </Badge>
                        ) : null}
                        {config?.fixedSlots.length ? <Badge variant="outline">{config.fixedSlots.length}</Badge> : null}
                      </span>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {selectedTemplate && (
              <div className="grid gap-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span className="truncate">{selectedTemplate.sourceName}</span>
                      <Badge variant="outline">
                        {selectedTemplate.grid.cols}×{selectedTemplate.grid.rows}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),220px]">
                      <div className="overflow-auto rounded-md border bg-background p-3">
                        <div
                          className="grid gap-px"
                          style={{
                            gridTemplateColumns: `repeat(${selectedTemplate.grid.cols}, minmax(24px, 1fr))`,
                          }}
                        >
                          {selectedTemplate.grid.data.flatMap((row, rowIndex) =>
                            Array.from(row).map((cell, colIndex) => {
                              const cellKey = `${rowIndex},${colIndex}`;
                              const previewCell = previewCellByKey.get(cellKey);
                              const previewArrow = previewArrowByKey.get(cellKey);
                              const starts = startsByCell.get(cellKey) ?? [];
                              const singleStart = starts.length === 1 ? (starts[0] ?? null) : null;
                              const singleSlot = singleStart ? (slotById.get(singleStart.slotId) ?? null) : null;
                              const isFixed = fixedCellSet.has(cellKey);
                              const fixedLetter = fixedLetterByCell.get(cellKey) ?? "";
                              const visibleLetter =
                                fixedLetter || (cell === "*" || cell === "#" || previewArrow ? "" : cell);
                              const visibleLetterIsFixed = fixedLetter.length > 0;
                              return (
                                <div
                                  key={cellKey}
                                  className={cn(
                                    "relative flex aspect-square min-h-6 min-w-6 items-center justify-center rounded-[2px] border text-[10px]",
                                    cell === "#"
                                      ? "border-slate-500 bg-slate-700 text-slate-50"
                                      : cell === "*"
                                        ? "border-border bg-background text-muted-foreground"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-900",
                                    previewCell?.isIntersection ? "ring-1 ring-amber-400/60" : "",
                                    isFixed ? "bg-sky-100 text-sky-900 ring-1 ring-sky-500/60" : "",
                                  )}
                                  title={`${rowIndex + 1}:${colIndex + 1}`}
                                >
                                  {previewArrow?.markup ? (
                                    <Image
                                      className="pointer-events-none absolute inset-[8%] z-[2] size-[84%]"
                                      src={buildPreviewArrowDataUrl(previewArrow.markup)}
                                      alt=""
                                      aria-hidden
                                      width={84}
                                      height={84}
                                      unoptimized
                                    />
                                  ) : null}
                                  {starts.length > 0 && (
                                    <button
                                      type="button"
                                      className="absolute inset-0 z-10 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                                      title={
                                        singleStart
                                          ? singleSlot
                                            ? `Открыть слот ${slotLabel(singleSlot)}`
                                            : `Открыть слот ${startLabel(singleStart)}`
                                          : "Выбрать слот из этой клетки"
                                      }
                                      onClick={() => openStartCell(starts)}
                                    >
                                      <span className="sr-only">
                                        {singleStart
                                          ? `Открыть ${singleSlot ? slotLabel(singleSlot) : startLabel(singleStart)}`
                                          : "Выбрать слот из клетки"}
                                      </span>
                                    </button>
                                  )}
                                  {visibleLetterIsFixed ? (
                                    <span className="absolute inset-0 z-[1] flex items-center justify-center text-[20px] font-black leading-none text-fuchsia-800">
                                      {visibleLetter}
                                    </span>
                                  ) : visibleLetter ? (
                                    <span className="relative z-[1] leading-none">{visibleLetter}</span>
                                  ) : null}
                                  {starts.length > 0 && (
                                    <div className="pointer-events-none absolute inset-0 flex items-start justify-start gap-0.5 p-0.5">
                                      {!previewArrow &&
                                        starts.map((start) => (
                                          <span
                                            key={`${start.slotId}:${start.dir}`}
                                            className={cn(
                                              "inline-flex h-4 min-w-4 items-center justify-center rounded border border-slate-300 bg-white/90 px-1 text-[9px] leading-none shadow-sm transition hover:bg-slate-100",
                                              fixedSlotMap.has(start.slotId)
                                                ? "border-sky-500 text-sky-700"
                                                : "text-slate-700",
                                            )}
                                          >
                                            {start.dir === "right" ? "→" : "↓"}
                                          </span>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }),
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
                        <label className="text-xs font-medium" htmlFor={`keyword-${selectedTemplate.key}`}>
                          Ключевое слово
                        </label>
                        <Input
                          id={`keyword-${selectedTemplate.key}`}
                          value={selectedSetup?.keyword ?? ""}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            onKeywordChange(selectedTemplate.key, value);
                          }}
                          placeholder="Например, КЛЮЧ"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
