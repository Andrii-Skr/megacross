import type { Request, Response } from "express";

/** Subscribe before reading the snapshot so updates during the read cannot be lost. */
export async function streamJobEvents<Job>(
  req: Request,
  res: Response,
  { read, subscribe }: {
    read: () => Promise<Job | null>;
    subscribe: (listener: (job: Job) => void) => () => void;
  },
): Promise<void> {
  let closed = false;
  let updatedDuringRead = false;
  let unsubscribe: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(ping);
    unsubscribe?.();
    res.off("close", cleanup);
    req.off("aborted", cleanup);
  };
  res.once("close", cleanup);
  req.once("aborted", cleanup);
  if (req.aborted || res.destroyed) { cleanup(); return; }
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    unsubscribe = subscribe((job) => {
      if (closed) return;
      updatedDuringRead = true;
      res.write(`data: ${JSON.stringify(job)}\n\n`);
    });
    const current = await read();
    if (closed) return;
    // A live event is newer than the in-flight snapshot; do not send stale state after it.
    if (current && !updatedDuringRead) res.write(`data: ${JSON.stringify(current)}\n\n`);
    ping = setInterval(() => res.write("event: ping\ndata: {}\n\n"), 15_000);
  } catch (error) {
    cleanup();
    throw error;
  }
}
