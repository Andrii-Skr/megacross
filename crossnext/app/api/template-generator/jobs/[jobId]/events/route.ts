import { NextResponse } from "next/server";
import { Permissions } from "@/lib/authz";
import { fetchCrossTemplate } from "@/lib/templateGeneratorProxy";
import { apiRoute } from "@/utils/appRoute";

type Params = { jobId: string };
export const GET = apiRoute<unknown, Params>(
  async (_req, _body, { jobId }) => {
    const upstream = await fetchCrossTemplate(`/api/template-generator/jobs/${encodeURIComponent(jobId)}/events`, {
      headers: { accept: "text/event-stream" },
    });
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  },
  { roles: ["ADMIN"], permissions: [Permissions.AdminAccess] },
);
