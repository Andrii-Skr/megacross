import { Permissions } from "@/lib/authz";
import { proxyCrossTemplate } from "@/lib/templateGeneratorProxy";
import { apiRoute } from "@/utils/appRoute";

type Params = { jobId: string };
export const GET = apiRoute<unknown, Params>(
  async (req, _body, { jobId }) => {
    const query = req.nextUrl.searchParams;
    return proxyCrossTemplate(
      `/api/template-generator/jobs/${encodeURIComponent(jobId)}/results?page=${encodeURIComponent(query.get("page") ?? "1")}&pageSize=${encodeURIComponent(query.get("pageSize") ?? "24")}`,
    );
  },
  { permissions: [Permissions.AdminAccess] },
);
