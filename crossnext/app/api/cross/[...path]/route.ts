import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { hasPermissionAsync, Permissions } from "@/lib/authz";
import { fetchCrossTemplate } from "@/lib/templateGeneratorProxy";

type Context = { params: Promise<{ path: string[] }> };

async function proxyFill(req: NextRequest, context: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string | null }).role;
  if (!(await hasPermissionAsync(role, Permissions.DictionaryWrite))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { path } = await context.params;
  const pathname = `/${path.join("/")}`;
  // Only expose the fill routes used by the workspace. Admin generator routes
  // keep their separate ADMIN-only entry points.
  const allowed =
    req.method === "GET"
      ? /^\/api\/fill\/(?:latest|\d+(?:\/(?:review|stream|archive))?)$/u.test(pathname)
      : /^\/api\/fill\/(?:start|\d+\/candidates)$/u.test(pathname);
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const upstream = await fetchCrossTemplate(`${pathname}${new URL(req.url).search}`, {
      method: req.method,
      headers: req.method === "POST" ? { "content-type": "application/json" } : undefined,
      body: req.method === "POST" ? await req.text() : undefined,
      signal: req.signal,
    });
    const headers = new Headers();
    for (const name of ["content-type", "content-disposition", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (pathname.endsWith("/stream")) {
      headers.set("cache-control", "no-cache, no-transform");
      headers.set("x-accel-buffering", "no");
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error("Fill proxy failed", error);
    return NextResponse.json({ error: "Fill service is unavailable" }, { status: 502 });
  }
}

export const GET = proxyFill;
export const POST = proxyFill;
