"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, LoaderCircle, Play, RotateCcw, Square, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GenerationJob, GenerationRequest, GenerationResult } from "./types";

const ResultsGallery = dynamic(() => import("./TemplateResultsGallery"), {
  loading: () => <div className="h-80 animate-pulse rounded-xl bg-muted" />,
});

const schema = z.object({
  rows: z.number().int().min(5).max(40),
  cols: z.number().int().min(5).max(40),
  resultCount: z.number().int().min(1).max(150),
  dictionaryFilterId: z.string(),
  pictureMode: z.enum(["auto", "manual"]),
  pictureCount: z.number().int().min(0).max(20),
  manualPictures: z.string(),
  cutoutPresetId: z.enum([
    "none",
    "corner",
    "opposite-corners",
    "edge-bite",
    "opposite-edge-bites",
    "stepped-corner",
    "center-window",
  ]),
  seed: z.string().max(128),
});
type FormValues = z.infer<typeof schema>;
type Option = { id: string; name: string };
type Props = { filters: Option[]; issues: Array<Option & { edition: string }> };
type Preflight = { dictionaryCounts: Record<string, number>; targetDistribution: Record<string, number> };

const presets = [
  "none",
  "corner",
  "opposite-corners",
  "edge-bite",
  "opposite-edge-bites",
  "stepped-corner",
  "center-window",
] as const;
const LAST_JOB_STORAGE_KEY = "crossnext.template-generator.last-job";

function PresetMark({ preset }: { preset: (typeof presets)[number] }) {
  const cutout = "absolute bg-background ring-1 ring-border";
  return (
    <span className="relative mb-2 block h-7 w-10 overflow-hidden rounded-[3px] border bg-slate-300 dark:bg-slate-700">
      {preset === "corner" && <span className={`${cutout} left-0 top-0 h-2.5 w-3`} />}
      {preset === "opposite-corners" && (
        <>
          <span className={`${cutout} left-0 top-0 h-2.5 w-3`} />
          <span className={`${cutout} bottom-0 right-0 h-2.5 w-3`} />
        </>
      )}
      {preset === "edge-bite" && <span className={`${cutout} left-0 top-1/2 h-3 w-2 -translate-y-1/2`} />}
      {preset === "opposite-edge-bites" && (
        <>
          <span className={`${cutout} left-0 top-1/2 h-3 w-2 -translate-y-1/2`} />
          <span className={`${cutout} right-0 top-1/2 h-3 w-2 -translate-y-1/2`} />
        </>
      )}
      {preset === "stepped-corner" && (
        <span className={`${cutout} left-0 top-0 h-4 w-4 [clip-path:polygon(0_0,100%_0,0_100%)]`} />
      )}
      {preset === "center-window" && (
        <span className={`${cutout} left-1/2 top-1/2 h-2.5 w-3 -translate-x-1/2 -translate-y-1/2`} />
      )}
    </span>
  );
}

function parseManualPictures(value: string): Array<{ width: number; height: number }> {
  if (!value.trim()) return [];
  return value.split(/[,;\n]+/u).map((entry) => {
    const match = entry.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/iu);
    if (!match) throw new Error("Use format 4x4, 5x4");
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width < 4 || height < 4) throw new Error("Minimum picture size is 4x4");
    return { width, height };
  });
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? data.error ?? `HTTP ${response.status}`);
  return data;
}

export function TemplateGeneratorClient({ filters, issues }: Props) {
  const t = useTranslations("templateGenerator");
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [items, setItems] = useState<GenerationResult[]>([]);
  const resultRequestVersion = useRef(0);
  const currentJobId = useRef<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [issueId, setIssueId] = useState(issues[0]?.id ?? "");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rows: 23,
      cols: 31,
      resultCount: 12,
      dictionaryFilterId: "",
      pictureMode: "auto",
      pictureCount: 1,
      manualPictures: "4x4",
      cutoutPresetId: "none",
      seed: "",
    },
  });
  const pictureMode = form.watch("pictureMode");
  const cutoutPreset = form.watch("cutoutPresetId");
  const preflightKey = JSON.stringify(form.watch());
  const activeJobId = job?.id;
  const activeJobStatus = job?.status;

  const toRequest = useCallback(
    (values: FormValues): GenerationRequest => ({
      rows: values.rows,
      cols: values.cols,
      resultCount: values.resultCount,
      dictionaryFilterId: values.dictionaryFilterId ? Number(values.dictionaryFilterId) : null,
      pictures:
        values.pictureMode === "auto"
          ? { mode: "auto", count: values.pictureCount }
          : { mode: "manual", items: parseManualPictures(values.manualPictures) },
      cutoutPresetId: values.cutoutPresetId,
      seed: values.seed.trim() || null,
    }),
    [],
  );

  const runPreflight = useCallback(
    async (values: FormValues) => {
      try {
        setPreflightError(null);
        const response = await fetch("/api/template-generator/preflight", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(toRequest(values)),
        });
        setPreflight(await readJson(response));
      } catch (error) {
        setPreflight(null);
        setPreflightError(error instanceof Error ? error.message : String(error));
      }
    },
    [toRequest],
  );

  useEffect(() => {
    const parsed = schema.safeParse(JSON.parse(preflightKey));
    if (!parsed.success) {
      setPreflight(null);
      return;
    }
    const timer = window.setTimeout(() => void runPreflight(parsed.data), 450);
    return () => window.clearTimeout(timer);
  }, [runPreflight, preflightKey]);

  const loadResults = useCallback(async (jobId: string) => {
    if (currentJobId.current !== jobId) return;
    const version = ++resultRequestVersion.current;
    const isCurrent = () => currentJobId.current === jobId && resultRequestVersion.current === version;
    try {
      const response = await fetch(`/api/template-generator/jobs/${jobId}/results?page=1&pageSize=50`);
      const first = (await readJson(response)) as { items: GenerationResult[]; total: number };
      if (!isCurrent()) return;
      const remainingPages = Array.from(
        { length: Math.max(0, Math.ceil(first.total / 50) - 1) },
        (_, index) => index + 2,
      );
      const remaining = await Promise.all(
        remainingPages.map(async (page) => {
          const next = await fetch(`/api/template-generator/jobs/${jobId}/results?page=${page}&pageSize=50`);
          return readJson(next) as Promise<{ items: GenerationResult[] }>;
        }),
      );
      if (isCurrent()) setItems([...first.items, ...remaining.flatMap((page) => page.items)]);
    } catch (error) {
      if (isCurrent()) setMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const restoreVersion = resultRequestVersion.current;
    const savedJobId = window.localStorage.getItem(LAST_JOB_STORAGE_KEY);
    void (async () => {
      let restored: GenerationJob | null = null;
      try {
        restored = (await readJson(await fetch("/api/template-generator/jobs"))) as GenerationJob | null;
      } catch {
        // A saved job can still be opened if the latest-job lookup is unavailable.
      }
      if (!restored && savedJobId) {
        try {
          const response = await fetch(`/api/template-generator/jobs/${encodeURIComponent(savedJobId)}`);
          if (response.status === 404) window.localStorage.removeItem(LAST_JOB_STORAGE_KEY);
          else restored = (await readJson(response)) as GenerationJob;
        } catch {
          // Keep the saved ID so a transient service failure does not lose the job.
        }
      }
      if (restored && !disposed && resultRequestVersion.current === restoreVersion) {
        currentJobId.current = restored.id;
        setJob(restored);
        window.localStorage.setItem(LAST_JOB_STORAGE_KEY, restored.id);
        if (restored.acceptedCount > 0) await loadResults(restored.id);
      }
    })();
    return () => {
      disposed = true;
      currentJobId.current = null;
      resultRequestVersion.current += 1;
    };
  }, [loadResults]);

  useEffect(() => {
    if (!activeJobId || !activeJobStatus || !["queued", "running"].includes(activeJobStatus)) return;
    const events = new EventSource(`/api/template-generator/jobs/${activeJobId}/events`);
    let disposed = false;
    events.onmessage = (event) => {
      if (disposed || currentJobId.current !== activeJobId) return;
      const next = JSON.parse(event.data) as GenerationJob;
      setJob(next);
      if (next.acceptedCount > 0) void loadResults(next.id);
      if (!["queued", "running"].includes(next.status)) events.close();
    };
    events.onerror = () => undefined;
    return () => {
      disposed = true;
      events.close();
    };
  }, [activeJobId, activeJobStatus, loadResults]);

  const start = form.handleSubmit(async (values) => {
    setBusyAction("start");
    setMessage(null);
    try {
      const response = await fetch("/api/template-generator/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toRequest(values)),
      });
      const created = (await readJson(response)) as GenerationJob;
      currentJobId.current = created.id;
      resultRequestVersion.current += 1;
      setItems([]);
      setSelected(new Set());
      setRejected(new Set());
      setJob(created);
      window.localStorage.setItem(LAST_JOB_STORAGE_KEY, created.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(null);
    }
  });

  const toggleSelected = useCallback(
    (id: string, checked: boolean) =>
      setSelected((current) => {
        const next = new Set(current);
        checked ? next.add(id) : next.delete(id);
        return next;
      }),
    [],
  );
  const reject = useCallback((id: string) => {
    setRejected((current) => new Set(current).add(id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const downloadZip = async (all: boolean) => {
    if (!job) return;
    setBusyAction("zip");
    try {
      const response = await fetch(`/api/template-generator/jobs/${job.id}/zip`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(all ? {} : { resultIds: [...selected] }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message ?? `HTTP ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `templates_${job.id}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(null);
    }
  };

  const append = async () => {
    if (!job || !issueId || !selected.size) return;
    setBusyAction("append");
    try {
      const response = await fetch(`/api/template-generator/jobs/${job.id}/append`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueId, resultIds: [...selected] }),
      });
      const data = (await readJson(response)) as { written: string[] };
      setMessage(t("added", { count: data.written.length }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(null);
    }
  };

  const distribution = useMemo(
    () =>
      preflight
        ? Object.entries(preflight.targetDistribution)
            .filter(([, value]) => value > 0)
            .map(([length, share]) => `${length}: ${Math.round(share * 100)}%`)
            .join(" · ")
        : "",
    [preflight],
  );
  const active = job && ["queued", "running"].includes(job.status);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-7 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">SXY / FSH</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <Card className="h-fit xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>{t("parameters")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-4">
            <form onSubmit={start} className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {(["rows", "cols", "resultCount"] as const).map((name) => (
                  <div key={name} className="space-y-1.5">
                    <Label htmlFor={name}>{t(name)}</Label>
                    <Input
                      id={name}
                      type="number"
                      {...form.register(name, { valueAsNumber: true })}
                      aria-invalid={Boolean(form.formState.errors[name])}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter">{t("dictionary")}</Label>
                <select
                  id="filter"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  {...form.register("dictionaryFilterId")}
                >
                  <option value="">{t("allRussian")}</option>
                  {filters.map((filter) => (
                    <option key={filter.id} value={filter.id}>
                      {filter.name}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t("pictures")}</legend>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={pictureMode === "auto" ? "default" : "outline"}
                    onClick={() => form.setValue("pictureMode", "auto")}
                  >
                    {t("auto")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={pictureMode === "manual" ? "default" : "outline"}
                    onClick={() => form.setValue("pictureMode", "manual")}
                  >
                    {t("manual")}
                  </Button>
                </div>
                {pictureMode === "auto" ? (
                  <Input type="number" {...form.register("pictureCount", { valueAsNumber: true })} />
                ) : (
                  <Input placeholder="4x4, 5x4" {...form.register("manualPictures")} />
                )}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t("cutout")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => form.setValue("cutoutPresetId", preset)}
                      className={`min-h-16 rounded-lg border p-2 text-left text-xs transition-colors ${cutoutPreset === preset ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                    >
                      <PresetMark preset={preset} />
                      {t(`preset.${preset}`)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-1.5">
                <Label htmlFor="seed">Seed</Label>
                <Input id="seed" placeholder={t("randomSeed")} {...form.register("seed")} />
              </div>
              {preflight && (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                  <p className="font-medium text-foreground">{t("dictionaryReady")}</p>
                  <p className="mt-1 text-muted-foreground">
                    {Object.entries(preflight.dictionaryCounts)
                      .map(([length, count]) => `${length}: ${count}`)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    {t("forecast")}: {distribution}
                  </p>
                </div>
              )}
              {preflightError && <p className="text-sm text-destructive">{preflightError}</p>}
              <Button
                className="w-full"
                type="submit"
                disabled={!preflight || Boolean(active) || busyAction === "start"}
              >
                {busyAction === "start" ? <LoaderCircle className="animate-spin" /> : <Play />}
                {t("start")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-5">
          {job ? (
            <div className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{t("job", { id: job.id })}</h2>
                    <Badge variant="outline">{t(`status.${job.status}`)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("progress", {
                      found: job.acceptedCount,
                      total: job.requestedCount,
                      attempts: job.attempts,
                      phase: job.phase,
                    })}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">Seed: {job.seed}</p>
                </div>
                <div className="flex gap-2">
                  {active && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await fetch(`/api/template-generator/jobs/${job.id}`, { method: "DELETE" });
                        setJob({ ...job, status: "cancelled", progress: 100 });
                      }}
                    >
                      <Square />
                      {t("cancel")}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => void start()} disabled={Boolean(active)}>
                    <RotateCcw />
                    {t("repeat")}
                  </Button>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              {job.error && <p className="mt-2 text-sm text-destructive">{job.error}</p>}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center rounded-xl border border-dashed text-center text-muted-foreground">
              <div>
                <Play className="mx-auto mb-3 size-8" />
                <p>{t("empty")}</p>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b pb-4">
                <span className="mr-auto text-sm text-muted-foreground">{t("selected", { count: selected.size })}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selected.size || busyAction === "zip"}
                  onClick={() => void downloadZip(false)}
                >
                  <Download />
                  {t("downloadSelected")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyAction === "zip"}
                  onClick={() => void downloadZip(true)}
                >
                  <Download />
                  {t("downloadAll")}
                </Button>
                <select
                  value={issueId}
                  onChange={(event) => setIssueId(event.target.value)}
                  className="h-8 max-w-64 rounded-md border bg-background px-2 text-xs"
                >
                  <option value="">{t("chooseIssue")}</option>
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      {issue.edition} — {issue.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!selected.size || !issueId || busyAction === "append"}
                  onClick={() => void append()}
                >
                  {t("addToIssue")}
                </Button>
              </div>
              <ResultsGallery
                items={items}
                selected={selected}
                rejected={rejected}
                onSelectedChange={toggleSelected}
                onReject={reject}
              />
            </>
          )}
          {message && (
            <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
              <span>{message}</span>
              <Button size="icon" variant="ghost" onClick={() => setMessage(null)}>
                <X />
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
