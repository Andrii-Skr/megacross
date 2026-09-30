import { NextResponse } from "next/server";
import { Permissions } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { proxyCrossTemplate } from "@/lib/templateGeneratorProxy";
import { templateGenerationSchema } from "@/lib/templateGeneratorSchema";
import { getNumericUserId } from "@/lib/user";
import { apiRoute } from "@/utils/appRoute";

export const POST = apiRoute(
  async (_req, body, _params, user) =>
    proxyCrossTemplate("/api/template-generator/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, userId: getNumericUserId(user) }),
    }),
  { schema: templateGenerationSchema, permissions: [Permissions.AdminAccess] },
);

export const GET = apiRoute(
  async (_req, _body, _params, user) => {
    const userId = getNumericUserId(user);
    if (!userId) return NextResponse.json(null);
    try {
      const upstream = await proxyCrossTemplate(`/api/template-generator/jobs?userId=${userId}`);
      if (upstream.status !== 404) return upstream;
    } catch {
      // Older cross processes may still be running an in-progress generation.
    }
    const where = { userId, expiresAt: { gt: new Date() } };
    const [active, latest] = await Promise.all([
      prisma.scanwordTemplateGenerationJob.findFirst({
        where: { ...where, status: { in: ["queued", "running"] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      prisma.scanwordTemplateGenerationJob.findFirst({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    ]);
    const job = active ?? latest;
    return NextResponse.json(
      job
        ? {
            ...job,
            id: job.id.toString(),
            rngPosition: job.rngPosition.toString(),
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
            expiresAt: job.expiresAt.toISOString(),
          }
        : null,
    );
  },
  { permissions: [Permissions.AdminAccess] },
);
