import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  return (
    <section aria-labelledby="not-found-title" className="not-found-page">
      <div className="not-found-content">
        <span aria-hidden className="not-found-code">
          {404}
        </span>
        <h1 id="not-found-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("notFoundTitle")}
        </h1>
        <p className="not-found-description">{t("notFoundDescription")}</p>
        <Button asChild size="lg" className="not-found-action">
          <Link href={`/${locale}/dictionary`}>
            <ArrowLeft aria-hidden className="size-4" />
            {t("backToDictionary")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
