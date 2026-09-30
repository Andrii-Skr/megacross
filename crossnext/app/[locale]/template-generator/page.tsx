import { getTranslations } from "next-intl/server";
import { ensureAdminAccess } from "@/app/actions/admin";
import { TemplateGeneratorClient } from "@/components/template-generator/TemplateGeneratorClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("templateGenerator");
  return { title: t("title") };
}

export default async function TemplateGeneratorPage() {
  await ensureAdminAccess();
  const [filters, editions] = await Promise.all([
    prisma.dictionaryFilterTemplate.findMany({
      where: { is_deleted: false, language: "ru" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.edition.findMany({
      where: { deletedAt: null },
      select: {
        code: true,
        name: true,
        issues: {
          where: { deletedAt: null },
          select: { id: true, issueNumber: { select: { label: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <TemplateGeneratorClient
      filters={filters.map((item) => ({ id: String(item.id), name: item.name }))}
      issues={editions.flatMap((edition) =>
        edition.issues.map((issue) => ({
          id: String(issue.id),
          name: issue.issueNumber.label,
          edition: edition.name || edition.code,
        })),
      )}
    />
  );
}
