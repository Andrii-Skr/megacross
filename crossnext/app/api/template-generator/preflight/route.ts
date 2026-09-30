import { Permissions } from "@/lib/authz";
import { proxyCrossTemplate } from "@/lib/templateGeneratorProxy";
import { templateGenerationSchema } from "@/lib/templateGeneratorSchema";
import { apiRoute } from "@/utils/appRoute";

export const POST = apiRoute(
  async (_req, body) =>
    proxyCrossTemplate("/api/template-generator/preflight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  { schema: templateGenerationSchema, permissions: [Permissions.AdminAccess] },
);
