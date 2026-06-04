"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getScanwordTemplateSetupPreviewAction, saveScanwordTemplateSetupAction } from "@/app/actions/scanwords";
import {
  buildTemplateSetupPayload,
  mapTemplateSetupByKey,
  normalizeTemplateSetupPayload,
  type TemplateSetupFixedSlot,
  type TemplateSetupPayload,
  type TemplateSetupPreviewPayload,
  type TemplateSetupTemplate,
} from "../model";

type UseScanwordTemplateSetupParams = {
  selectedIssueId: string | null;
  reloadToken: string;
};

const TEMPLATE_SETUP_AUTOSAVE_DELAY_MS = 700;

function buildTemplatesFromPayload(payload: TemplateSetupPayload | null | undefined): TemplateSetupTemplate[] {
  return payload?.templates ?? [];
}

function serializeTemplateSetup(payload: TemplateSetupPayload | null | undefined): string {
  return JSON.stringify(payload ?? null);
}

export function useScanwordTemplateSetup({ selectedIssueId, reloadToken }: UseScanwordTemplateSetupParams) {
  const [preview, setPreview] = useState<TemplateSetupPreviewPayload | null>(null);
  const [templateSetup, setTemplateSetup] = useState<TemplateSetupPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const loadedRef = useRef<string>("");
  const latestTemplateSetupRef = useRef<TemplateSetupPayload | null>(null);
  const lastSavedSnapshotRef = useRef<string>(serializeTemplateSetup(null));

  useEffect(() => {
    latestTemplateSetupRef.current = templateSetup;
  }, [templateSetup]);

  const templateSetupSnapshot = useMemo(() => serializeTemplateSetup(templateSetup), [templateSetup]);

  const load = useCallback(async () => {
    if (!selectedIssueId) {
      setPreview(null);
      setTemplateSetup(null);
      setError(null);
      setDirty(false);
      latestTemplateSetupRef.current = null;
      lastSavedSnapshotRef.current = serializeTemplateSetup(null);
      return;
    }
    const requestKey = `${selectedIssueId}:${reloadToken}`;
    loadedRef.current = requestKey;
    setLoading(true);
    setError(null);
    try {
      const nextPreview = await getScanwordTemplateSetupPreviewAction({ issueId: selectedIssueId });
      if (loadedRef.current !== requestKey) return;
      setPreview(nextPreview);
      setTemplateSetup(nextPreview?.templateSetup ?? null);
      setDirty(false);
      latestTemplateSetupRef.current = nextPreview?.templateSetup ?? null;
      lastSavedSnapshotRef.current = serializeTemplateSetup(nextPreview?.templateSetup ?? null);
    } catch (err) {
      if (loadedRef.current !== requestKey) return;
      setPreview(null);
      setTemplateSetup(null);
      setError(err instanceof Error ? err.message : "Failed to load template setup");
    } finally {
      if (loadedRef.current === requestKey) {
        setLoading(false);
      }
    }
  }, [reloadToken, selectedIssueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateMap = useMemo(() => mapTemplateSetupByKey(templateSetup), [templateSetup]);

  const updateTemplate = useCallback(
    (templateKey: string, updater: (current: TemplateSetupTemplate | null) => TemplateSetupTemplate | null) => {
      setTemplateSetup((currentPayload) => {
        const currentMap = mapTemplateSetupByKey(currentPayload);
        const nextValue = updater(currentMap.get(templateKey) ?? null);
        if (nextValue) currentMap.set(templateKey, nextValue);
        else currentMap.delete(templateKey);
        const nextPayload = buildTemplateSetupPayload([...currentMap.values()]);
        setDirty(true);
        return nextPayload;
      });
    },
    [],
  );

  const setKeyword = useCallback(
    (templateKey: string, keyword: string) => {
      updateTemplate(templateKey, (current) => {
        const normalized =
          normalizeTemplateSetupPayload({
            version: 1,
            templates: [
              {
                templateKey,
                keyword,
                fixedSlots: current?.fixedSlots ?? [],
              },
            ],
          })?.templates[0] ?? null;
        return normalized;
      });
    },
    [updateTemplate],
  );

  const setFixedSlot = useCallback(
    (templateKey: string, fixedSlot: TemplateSetupFixedSlot | null) => {
      updateTemplate(templateKey, (current) => {
        const nextSlots = new Map<number, TemplateSetupFixedSlot>(
          (current?.fixedSlots ?? []).map((item) => [item.slotId, item]),
        );
        if (fixedSlot) nextSlots.set(fixedSlot.slotId, fixedSlot);
        const normalized =
          normalizeTemplateSetupPayload({
            version: 1,
            templates: [
              {
                templateKey,
                keyword: current?.keyword ?? null,
                fixedSlots: [...nextSlots.values()],
              },
            ],
          })?.templates[0] ?? null;
        return normalized;
      });
    },
    [updateTemplate],
  );

  const clearFixedSlot = useCallback(
    (templateKey: string, slotId: number) => {
      updateTemplate(templateKey, (current) => {
        const nextSlots = (current?.fixedSlots ?? []).filter((item) => item.slotId !== slotId);
        const normalized =
          normalizeTemplateSetupPayload({
            version: 1,
            templates: [
              {
                templateKey,
                keyword: current?.keyword ?? null,
                fixedSlots: nextSlots,
              },
            ],
          })?.templates[0] ?? null;
        return normalized;
      });
    },
    [updateTemplate],
  );

  const save = useCallback(
    async (nextTemplateSetup?: TemplateSetupPayload | null) => {
      if (!selectedIssueId) return;
      const payload = nextTemplateSetup ?? latestTemplateSetupRef.current;
      const payloadSnapshot = serializeTemplateSetup(payload);
      setSaving(true);
      setError(null);
      try {
        await saveScanwordTemplateSetupAction({
          issueId: selectedIssueId,
          templateSetup: payload,
        });
        lastSavedSnapshotRef.current = payloadSnapshot;
        setDirty(serializeTemplateSetup(latestTemplateSetupRef.current) !== payloadSnapshot);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save template setup";
        setError(message);
        toast.error("Не удалось сохранить настройки шаблонов");
      } finally {
        setSaving(false);
      }
    },
    [selectedIssueId],
  );

  useEffect(() => {
    if (!selectedIssueId || !dirty || saving) return;
    const timeoutId = window.setTimeout(() => {
      if (serializeTemplateSetup(latestTemplateSetupRef.current) !== templateSetupSnapshot) return;
      void save(latestTemplateSetupRef.current);
    }, TEMPLATE_SETUP_AUTOSAVE_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dirty, save, saving, selectedIssueId, templateSetupSnapshot]);

  return {
    preview,
    templates: preview?.templates ?? [],
    templateSetup,
    templateMap,
    loading,
    saving,
    error,
    dirty,
    setKeyword,
    setFixedSlot,
    clearFixedSlot,
    save,
    reload: load,
    hasPreview: (preview?.templates.length ?? 0) > 0,
    configuredTemplates: buildTemplatesFromPayload(templateSetup).length,
  };
}
