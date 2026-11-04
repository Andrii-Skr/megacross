import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamJobEvents } from "../../../cross/server/src/templateGenerator/events";

type Job = { id: string; status: string };
function setup() {
  const req = Object.assign(new EventEmitter(), { aborted: false });
  const res = Object.assign(new EventEmitter(), {
    destroyed: false,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
  });
  let send: (job: Job) => void = () => {
    throw new Error("No subscription");
  };
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((listener: (job: Job) => void) => {
    send = listener;
    return unsubscribe;
  });
  let resolve!: (job: Job | null) => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<Job | null>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  const read = vi.fn(() => pending);
  const start = () => streamJobEvents(req as unknown as Request, res as unknown as Response, { read, subscribe });
  return { req, res, read, subscribe, unsubscribe, resolve, reject, start, send: (job: Job) => send(job) };
}
afterEach(() => vi.useRealTimers());

describe("template generation SSE", () => {
  it("keeps a terminal update received while reading, without sending the stale running snapshot", async () => {
    vi.useFakeTimers();
    const h = setup();
    const streaming = h.start();
    expect(h.subscribe).toHaveBeenCalledBefore(h.read);
    h.send({ id: "1", status: "completed" });
    h.resolve({ id: "1", status: "running" });
    await streaming;
    expect(h.res.write.mock.calls.map(([value]) => value)).toEqual(['data: {"id":"1","status":"completed"}\n\n']);
    h.res.emit("close");
    expect(h.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("sends the initial snapshot and subsequent updates in order", async () => {
    vi.useFakeTimers();
    const h = setup();
    const streaming = h.start();
    h.resolve({ id: "1", status: "running" });
    await streaming;
    h.send({ id: "1", status: "partial" });
    expect(h.res.write.mock.calls.map(([value]) => JSON.parse(value.slice(6)).status)).toEqual(["running", "partial"]);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(h.res.write).toHaveBeenLastCalledWith("event: ping\ndata: {}\n\n");
    h.res.emit("close");
  });
  it.each(["response close", "request abort"])("cleans up a %s during the initial read", async (event) => {
    vi.useFakeTimers();
    const h = setup();
    const streaming = h.start();
    if (event === "response close") h.res.emit("close");
    else h.req.emit("aborted");
    h.send({ id: "1", status: "completed" });
    h.resolve({ id: "1", status: "running" });
    await streaming;
    expect(h.unsubscribe).toHaveBeenCalledOnce();
    expect(h.res.write).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(h.res.listenerCount("close")).toBe(0);
    expect(h.req.listenerCount("aborted")).toBe(0);
  });
  it("removes the subscription if reading the initial snapshot fails", async () => {
    vi.useFakeTimers();
    const h = setup();
    const streaming = h.start();
    h.reject(new Error("database unavailable"));
    await expect(streaming).rejects.toThrow("database unavailable");
    expect(h.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not subscribe or query after the response is already closed", async () => {
    const h = setup();
    h.res.destroyed = true;
    await h.start();
    expect(h.subscribe).not.toHaveBeenCalled();
    expect(h.read).not.toHaveBeenCalled();
    expect(h.res.listenerCount("close")).toBe(0);
  });
});
