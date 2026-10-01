import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TemplateGeneratorClient } from "@/components/template-generator/TemplateGeneratorClient";
import type { GenerationJob, GenerationResult } from "@/components/template-generator/types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { id?: string }) => (values?.id ? `${key} ${values.id}` : key),
}));
vi.mock("next/dynamic", () => ({
  default:
    () =>
    ({ items }: { items: GenerationResult[] }) => (
      <div>
        {items.map((item) => (
          <span key={item.id}>result {item.id}</span>
        ))}
      </div>
    ),
}));

class FakeEvents {
  static instances: FakeEvents[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEvents.instances.push(this);
  }
  close = vi.fn();
  send(job: GenerationJob) {
    this.onmessage?.({ data: JSON.stringify(job) });
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const job = (id = "1", status: GenerationJob["status"] = "running", acceptedCount = 1): GenerationJob => ({
  id,
  status,
  acceptedCount,
  phase: status,
  progress: 10,
  requestedCount: 12,
  attempts: 1,
  seed: "test",
  error: null,
  parameters: { rows: 23, cols: 31, resultCount: 12, pictures: { mode: "auto", count: 1 }, cutoutPresetId: "none" },
});
const results = (...ids: string[]) => json({ items: ids.map((id) => ({ id })), total: ids.length });
beforeEach(() => {
  window.localStorage.clear();
  FakeEvents.instances = [];
  vi.stubGlobal("EventSource", FakeEvents);
});
afterEach(() => vi.unstubAllGlobals());

it("ignores an older gallery response that arrives after the latest event", async () => {
  const older = deferred<Response>();
  const newer = deferred<Response>();
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/template-generator/jobs") return Promise.resolve(json(job()));
    if (url.includes("/results"))
      return fetchMock.mock.calls.filter(([value]) => String(value).includes("/results")).length === 1
        ? older.promise
        : newer.promise;
    return Promise.resolve(json({ dictionaryCounts: {}, targetDistribution: {} }));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TemplateGeneratorClient filters={[]} issues={[]} />);
  await waitFor(() => expect(FakeEvents.instances).toHaveLength(1));
  act(() => FakeEvents.instances[0].send(job("1", "completed", 2)));
  await act(async () => {
    newer.resolve(results("1", "2"));
  });
  expect(await screen.findByText("result 2")).toBeInTheDocument();
  await act(async () => {
    older.resolve(results("1"));
  });
  expect(screen.getByText("result 2")).toBeInTheDocument();
});

it("ignores old results after starting a new job", async () => {
  const older = deferred<Response>();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/template-generator/jobs")
        return Promise.resolve(json(options?.method === "POST" ? job("2", "running", 0) : job("1", "completed")));
      if (url.includes("/jobs/1/results")) return older.promise;
      if (url.includes("/jobs/2/results")) return Promise.resolve(results("new"));
      return Promise.resolve(json({ dictionaryCounts: {}, targetDistribution: {} }));
    }),
  );
  render(<TemplateGeneratorClient filters={[]} issues={[]} />);
  fireEvent.click(await screen.findByRole("button", { name: "repeat" }));
  await screen.findByText("job 2");
  await waitFor(() => expect(FakeEvents.instances).toHaveLength(1));
  act(() => FakeEvents.instances[0].send(job("2", "completed", 1)));
  expect(await screen.findByText("result new")).toBeInTheDocument();
  await act(async () => {
    older.resolve(results("old"));
  });
  expect(screen.queryByText("result old")).not.toBeInTheDocument();
  expect(screen.getByText("result new")).toBeInTheDocument();
});

it("retains the current gallery when starting another job fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/template-generator/jobs")
        return Promise.resolve(
          options?.method === "POST"
            ? new Response(JSON.stringify({ message: "start failed" }), { status: 409 })
            : json(job("1", "completed")),
        );
      if (url.includes("/results")) return Promise.resolve(results("saved"));
      return Promise.resolve(json({ dictionaryCounts: {}, targetDistribution: {} }));
    }),
  );
  render(<TemplateGeneratorClient filters={[]} issues={[]} />);
  expect(await screen.findByText("result saved")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "repeat" }));
  await screen.findByText("start failed");
  expect(screen.getByText("result saved")).toBeInTheDocument();
});

it("ignores a late restoration response after creating a new job", async () => {
  const restored = deferred<Response>();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/template-generator/jobs")
        return options?.method === "POST" ? Promise.resolve(json(job("2", "running", 0))) : restored.promise;
      return Promise.resolve(json({ dictionaryCounts: {}, targetDistribution: {} }));
    }),
  );
  render(<TemplateGeneratorClient filters={[]} issues={[]} />);
  const start = screen.getByRole("button", { name: "start" });
  await waitFor(() => expect(start).toBeEnabled());
  fireEvent.click(start);
  await screen.findByText("job 2");
  await act(async () => {
    restored.resolve(json(job("1", "completed")));
  });
  expect(screen.queryByText("job 1")).not.toBeInTheDocument();
  expect(screen.getByText("job 2")).toBeInTheDocument();
});

it("ignores an older paginated response after the final results have loaded", async () => {
  const pageTwo = deferred<Response>();
  let firstPages = 0;
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/template-generator/jobs") return Promise.resolve(json(job()));
    if (url.includes("page=2")) return pageTwo.promise;
    if (url.includes("/results"))
      return Promise.resolve(++firstPages === 1 ? json({ items: [{ id: "old" }], total: 51 }) : results("latest"));
    return Promise.resolve(json({ dictionaryCounts: {}, targetDistribution: {} }));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TemplateGeneratorClient filters={[]} issues={[]} />);
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("page=2"))).toBe(true));
  act(() => FakeEvents.instances[0].send(job("1", "completed", 51)));
  expect(await screen.findByText("result latest")).toBeInTheDocument();
  await act(async () => {
    pageTwo.resolve(results("old-page-two"));
  });
  expect(screen.queryByText("result old")).not.toBeInTheDocument();
  expect(screen.queryByText("result old-page-two")).not.toBeInTheDocument();
  expect(screen.getByText("result latest")).toBeInTheDocument();
});
