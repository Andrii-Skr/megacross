import { z } from "zod";
import { Permissions } from "@/lib/authz";
import { proxyCrossTemplate } from "@/lib/templateGeneratorProxy";
import { apiRoute } from "@/utils/appRoute";

type Params = { jobId: string };
const schema = z.object({ resultIds: z.array(z.string().regex(/^\d+$/u)).optional() });
export const POST = apiRoute<z.infer<typeof schema>, Params>(
  async (_req, body, { jobId }) =>
    proxyCrossTemplate(`/api/template-generator/jobs/${encodeURIComponent(jobId)}/zip`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  { schema, roles: ["ADMIN"], permissions: [Permissions.AdminAccess] },
);
