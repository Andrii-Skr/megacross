import { Permissions } from "@/lib/authz";
import { proxyCrossTemplate } from "@/lib/templateGeneratorProxy";
import { apiRoute } from "@/utils/appRoute";

type Params = { jobId: string; resultId: string };
export const GET = apiRoute<unknown, Params>(
  async (_req, _body, { jobId, resultId }) =>
    proxyCrossTemplate(
      `/api/template-generator/jobs/${encodeURIComponent(jobId)}/results/${encodeURIComponent(resultId)}/fsh`,
    ),
  { permissions: [Permissions.AdminAccess] },
);
