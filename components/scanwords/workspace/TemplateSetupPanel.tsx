"use client";

import { Loader2, Save, Search, Trash2 } from "lucide-react";
import Image from "next/image";
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
import { cn } from "@/lib/utils";
import type {
  FillReviewStartPosition,
  TemplateSetupFixedSlot,
  TemplateSetupPreviewTemplate,
  TemplateSetupTemplate,
} from "./model";

type DictionaryWordCandidate = {
  id: string;
  word_text: string;
};

type TemplateSetupPanelProps = {
  active: boolean;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
  hasPreview: boolean;
  dictionaryLanguage: string;
  dictionaryReady: boolean;
  templates: TemplateSetupPreviewTemplate[];
  templateMap: Map<string, TemplateSetupTemplate>;
  onKeywordChange: (templateKey: string, keyword: string) => void;
  onFixedSlotChange: (templateKey: string, fixedSlot: TemplateSetupFixedSlot) => void;
  onFixedSlotClear: (templateKey: string, slotId: number) => void;
  onSave: () => void;
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
  saving,
  dirty,
  error,
  hasPreview,
  dictionaryLanguage,
  dictionaryReady,
  templates,
  templateMap,
  onKeywordChange,
  onFixedSlotChange,
  onFixedSlotClear,
  onSave,
}: TemplateSetupPanelProps) {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [pendingStarts, setPendingStarts] = useState<FillReviewStartPosition[] | null>(null);
  const [modalWord, setModalWord] = useState<string[]>([]);
  const [modalCandidates, setModalCandidates] = useState<DictionaryWordCandidate[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

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
  const editingLockedLetters = useMemo(
    () => (editingSlot ? (lockedLettersBySlotId.get(editingSlot.slotId) ?? new Map<number, string>()) : new Map()),
    [editingSlot, lockedLettersBySlotId],
  );
  const modalOpen = Boolean(selectedTemplate && editingSlot);
  const modalWordValue = modalWord.join("");

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
    setModalError(null);
    setModalLoading(false);
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

  const searchModalWord = useCallback(async () => {
    if (!selectedTemplate || !editingSlot) return;
    const query = modalWordValue.trim();
    if (!query || modalWord.some((char) => !char)) {
      setModalCandidates([]);
      setModalError("Заполните слово целиком.");
      return;
    }
    setModalLoading(true);
    setModalError(null);
    try {
      const params = new URLSearchParams({
        q: query,
        mode: "exact",
        scope: "word",
        lang: dictionaryLanguage || "ru",
        lenFilterField: "word",
        lenMin: String(editingSlot.len),
        lenMax: String(editingSlot.len),
        take: "10",
      });
      const res = await fetch(`/api/dictionary?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.message === "string" ? data.message : `HTTP ${res.status}`);
      }
      const items = Array.isArray(data?.items) ? (data.items as DictionaryWordCandidate[]) : [];
      setModalCandidates(items);
      if (items.length === 0) {
        setModalError("Такого слова в словаре не найдено.");
      }
    } catch (err) {
      setModalCandidates([]);
      setModalError(err instanceof Error ? err.message : "Не удалось загрузить слова из словаря");
    } finally {
      setModalLoading(false);
    }
  }, [dictionaryLanguage, editingSlot, modalWord, modalWordValue, selectedTemplate]);

  const applyOtpInput = useCallback(
    (index: number, rawValue: string) => {
      if (!editingSlot) return;
      if (editingLockedLetters.has(index)) return;
      const letters = normalizeOtpLetters(rawValue);
      setModalCandidates([]);
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
        void searchModalWord();
      }
    },
    [editingLockedLetters, editingSlot, focusEditableIndex, modalWord, searchModalWord],
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
              Введите слово по буквам. Поиск идет только по словарю и только по точному совпадению длины.
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

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!dictionaryReady || modalLoading}
                  onClick={() => void searchModalWord()}
                >
                  {modalLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
                  Найти в словаре
                </Button>
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
                <div className="flex flex-wrap gap-2">
                  {modalCandidates.map((candidate) => (
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
                        });
                        closeSlotEditor();
                      }}
                      disabled={!wordMatchesLockedLetters(candidate.word_text, editingLockedLetters)}
                    >
                      {candidate.word_text}
                    </Button>
                  ))}
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
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Настройка шаблонов</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Кликните по клетке со стрелкой в превью, чтобы закрепить словарное слово за слотом, и при необходимости
                задайте ключевое слово.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              disabled={!dirty || saving || loading || !hasPreview}
              onClick={onSave}
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Сохранить
            </Button>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {!dictionaryReady && (
            <p className="mt-2 text-xs text-amber-700">
              Сначала выберите словарный шаблон на шаге словаря, иначе подбор слов для слотов будет недоступен.
            </p>
          )}
        </div>

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
                        {config?.keyword ? <Badge variant="secondary">Ключ</Badge> : null}
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
                        <p className="text-xs text-muted-foreground">
                          Если заполнено, backend попытается автоматически встроить это слово в шаблон.
                        </p>
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
