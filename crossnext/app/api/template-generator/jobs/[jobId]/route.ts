import { Permissions } from "@/lib/authz";
import { proxyCrossTemplate } from "@/lib/templateGeneratorProxy";
import { apiRoute } from "@/utils/appRoute";

type Params = { jobId: string };
export const GET = apiRoute<unknown, Params>(
  async (_req, _body, { jobId }) => proxyCrossTemplate(`/api/template-generator/jobs/${encodeURIComponent(jobId)}`),
  { permissions: [Permissions.AdminAccess] },
);
export const DELETE = apiRoute<unknown, Params>(
  async (_req, _body, { jobId }) =>
    proxyCrossTemplate(`/api/template-generator/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" }),
  { permissions: [Permissions.AdminAccess] },
);
