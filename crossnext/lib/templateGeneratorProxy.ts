import { NextResponse } from "next/server";

function bases(): string[] {
  const configured = [process.env.CROSS_API_URL, process.env.NEXT_PUBLIC_CROSS_API_URL]
    .map((value) => value?.trim().replace(/\/$/u, ""))
    .filter((value): value is string => Boolean(value));
  return [
    ...new Set([
      ...configured,
      "http://cross:3001",
      "http://host.docker.internal:3001",
      "http://127.0.0.1:3001",
      "http://localhost:3001",
    ]),
  ];
}

export async function fetchCrossTemplate(pathname: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (const base of bases()) {
    try {
      const response = await fetch(`${base}${pathname}`, { ...init, cache: "no-store" });
      if (response.status !== 502 && response.status !== 503) return response;
      lastError = new Error(`cross responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw Object.assign(new Error(lastError instanceof Error ? lastError.message : "cross service is unavailable"), {
    status: 502,
  });
}

export async function proxyCrossTemplate(pathname: string, init?: RequestInit): Promise<NextResponse> {
  const upstream = await fetchCrossTemplate(pathname, init);
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(body, { status: upstream.status, headers });
}
