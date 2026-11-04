import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScanwordFill } from "@/components/scanwords/workspace/hooks/useScanwordFill";

vi.mock("@/app/actions/scanwords", () => ({
  getScanwordEditionSvgLayoutSettingsAction: async () => null,
  getScanwordFillArchivesAction: async () => [],
  getScanwordFillSettingsAction: async () => null,
  getScanwordIssueSvgSettingsAction: async () => null,
  listScanwordSvgFontsAction: async () => [],
  saveScanwordEditionSvgLayoutSettingsAction: vi.fn(),
  saveScanwordFillSettingsAction: vi.fn(),
  saveScanwordIssueSvgSettingsAction: vi.fn(),
}));
class Stream {
  static instances: Stream[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(readonly url: string) {
    Stream.instances.push(this);
  }
}
beforeEach(() => {
  Stream.instances = [];
  vi.stubGlobal("EventSource", Stream);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ id: "1", status: "running", progress: 10 }))),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("fill status stream", () => {
  it.each(["start", "regenerate"])("ignores a late %s response after switching issues", async (action) => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/start") || url.endsWith("/regenerate-template")) return pending;
        const id = url.includes("issueId=2") ? "2" : "1";
        return new Response(JSON.stringify({ id, status: "running", progress: 10 }));
      }),
    );
    const translate = ((key: string) => key) as Parameters<typeof useScanwordFill>[0]["t"];
    const { result, rerender } = renderHook(
      ({ issueId }) =>
        useScanwordFill({
          selectedEditionId: 1,
          selectedIssueId: issueId,
          selectedTemplateId: 1,
          filesSignature: "files",
          crossApiBase: "/api/cross",
          templateSetup: null,
          t: translate,
        }),
      { initialProps: { issueId: "1" } },
    );
    await waitFor(() => expect(result.current.fillJob?.id).toBe("1"));
    let request: Promise<void>;
    act(() => {
      request = action === "start" ? result.current.handleFillStart() : result.current.regenerateTemplate("tpl-1");
    });
    rerender({ issueId: "2" });
    await waitFor(() => expect(result.current.fillJob?.id).toBe("2"));
    await act(async () => {
      resolveResponse(new Response(JSON.stringify({ id: "old-result", status: "running", progress: 10 })));
      await request;
    });
    expect(result.current.fillJob?.id).toBe("2");
  });

  it("allows native reconnection after a transient stream error and closes on completion", async () => {
    const { result, unmount } = renderHook(() =>
      useScanwordFill({
        selectedEditionId: 1,
        selectedIssueId: "1",
        selectedTemplateId: 1,
        filesSignature: "files",
        crossApiBase: "/api/cross",
        templateSetup: null,
        t: ((key: string) => key) as Parameters<typeof useScanwordFill>[0]["t"],
      }),
    );
    await waitFor(() => expect(Stream.instances).toHaveLength(1));
    const stream = Stream.instances[0];
    act(() => stream.onerror?.());
    expect(stream.close).not.toHaveBeenCalled();
    act(() => stream.onmessage?.({ data: JSON.stringify({ id: "1", status: "done", progress: 100 }) }));
    await waitFor(() => expect(result.current.fillStatus).toBe("done"));
    expect(stream.close).toHaveBeenCalledOnce();
    unmount();
  });
});
