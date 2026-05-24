import { notFound } from "next/navigation";

import { resolveLang } from "@/lib/i18n";
import { LangProvider } from "@/lib/lang-context";

const SUPPORTED_LANGS = new Set(["zh", "en"]);

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;

  if (!SUPPORTED_LANGS.has(rawLang)) {
    notFound();
  }

  const lang = resolveLang(rawLang);

  return <LangProvider lang={lang}>{children}</LangProvider>;
}
