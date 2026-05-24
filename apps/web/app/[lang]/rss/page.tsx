import type { Metadata } from "next";

import { PublicHeader } from "@/components/public-header";
import { resolveLang } from "@/lib/i18n";
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens";

import { RssPageClient } from "./rss-page-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = resolveLang(rawLang);
  const title = lang === "zh" ? "RSS 订阅 - VibeGuard" : "RSS Feed - VibeGuard";
  const description =
    lang === "zh"
      ? "通过 RSS 订阅 VibeGuard 供应链安全情报，获取最新的攻击事件、恶意包与高危漏洞动态。"
      : "Subscribe to VibeGuard supply-chain security intelligence via RSS for the latest attack incidents, malicious packages, and critical vulnerabilities.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: lang === "zh" ? "zh_CN" : "en_US",
    },
  };
}

type RssPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function RssPage({ params: routeParams }: RssPageProps) {
  const { lang: rawLang } = await routeParams;
  const lang = resolveLang(rawLang);

  const zhFeedUrl = "/zh/feed.xml";
  const enFeedUrl = "/en/feed.xml";

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />

      <div className={getShellClassName()}>
        <PublicHeader
          homeHref={`/${lang}`}
          currentLang={lang}
          currentSurface="rss"
        />

        <section className={getSectionOuterClassName()}>
          <div className={getSectionInnerClassName()}>
            <RssPageClient
              lang={lang}
              zhFeedUrl={zhFeedUrl}
              enFeedUrl={enFeedUrl}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
