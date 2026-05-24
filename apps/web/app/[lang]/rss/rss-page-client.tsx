"use client";

import { useEffect, useState } from "react";
import {
  Rss,
  Copy,
  Check,
  Globe,
  BookOpen,
  Zap,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppLang } from "@/lib/i18n";

type RssPageClientProps = {
  lang: AppLang;
  zhFeedUrl: string;
  enFeedUrl: string;
};

export function RssPageClient({
  lang,
  zhFeedUrl,
  enFeedUrl,
}: RssPageClientProps) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-[1.1rem] border border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_2px_8px_rgba(15,23,42,0.08)] dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Rss className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-stone-100">
            {lang === "zh" ? "RSS 订阅" : "RSS Feed"}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600 dark:text-stone-400">
            {lang === "zh"
              ? "用你喜欢的阅读器订阅 VibeGuard，供应链攻击、恶意包和高危漏洞的最新动态会自动推送到你面前。"
              : "Subscribe with your favorite reader — the latest supply-chain attacks, malicious packages, and critical vulnerabilities delivered automatically."}
          </p>
        </div>
      </div>

      {/* Feed cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FeedCard
          lang={lang}
          feedLang="zh"
          title={lang === "zh" ? "中文订阅" : "Chinese Feed"}
          description={
            lang === "zh"
              ? "面向中文用户的安全情报流，包含中文摘要与标题。"
              : "Security intelligence stream for Chinese readers with Chinese summaries and titles."
          }
          feedUrl={zhFeedUrl}
          origin={origin}
        />
        <FeedCard
          lang={lang}
          feedLang="en"
          title={lang === "zh" ? "英文订阅" : "English Feed"}
          description={
            lang === "zh"
              ? "面向英文用户的安全情报流，包含英文摘要与标题。"
              : "Security intelligence stream for English readers with English summaries and titles."
          }
          feedUrl={enFeedUrl}
          origin={origin}
        />
      </div>

      {/* How to use */}
      <div className="rounded-[1.5rem] border border-black/5 bg-white/30 p-5 dark:border-white/8 dark:bg-white/[0.025]">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
          <BookOpen className="size-4 text-emerald-700 dark:text-emerald-300" />
          {lang === "zh" ? "如何使用" : "How to use"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StepCard
            icon={<Globe className="size-4" />}
            title={lang === "zh" ? "选择阅读器" : "Pick a reader"}
            description={
              lang === "zh"
                ? "NetNewsWire、Feedly、Inoreader 等主流阅读器均支持。"
                : "NetNewsWire, Feedly, Inoreader, or any RSS-compatible reader."
            }
          />
          <StepCard
            icon={<Copy className="size-4" />}
            title={lang === "zh" ? "复制链接" : "Copy the link"}
            description={
              lang === "zh"
                ? "点击上方卡片中的复制按钮，获取订阅地址。"
                : "Click the copy button on the feed card above to grab the URL."
            }
          />
          <StepCard
            icon={<Zap className="size-4" />}
            title={lang === "zh" ? "自动同步" : "Auto sync"}
            description={
              lang === "zh"
                ? "阅读器会定期拉取最新内容，无需手动刷新。"
                : "Your reader will fetch new content automatically — no manual refresh needed."
            }
          />
        </div>
      </div>
    </div>
  );
}

function FeedCard({
  lang,
  feedLang,
  title,
  description,
  feedUrl,
  origin,
}: {
  lang: AppLang;
  feedLang: "zh" | "en";
  title: string;
  description: string;
  feedUrl: string;
  origin: string;
}) {
  const [copied, setCopied] = useState(false);
  const fullUrl = origin ? `${origin}${feedUrl}` : feedUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-[1.4rem] border border-black/5 bg-white/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="flex items-center gap-2.5">
        <Rss className="size-4 text-emerald-700 dark:text-emerald-300" />
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-stone-100">
          {title}
        </h3>
        <Badge variant="secondary" className="text-[0.6rem]">
          {feedLang === "zh" ? "ZH" : "EN"}
        </Badge>
      </div>

      <p className="text-xs leading-relaxed text-zinc-600 dark:text-stone-400">
        {description}
      </p>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-full border border-black/6 bg-[#f7f7f5] px-3 py-1.5 font-mono text-[0.65rem] text-zinc-600 dark:border-white/8 dark:bg-white/[0.04] dark:text-stone-400">
          <span className="block truncate">{fullUrl}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={feedUrl}
            target="_blank"
            className="flex size-8 items-center justify-center rounded-full border border-black/8 bg-white text-zinc-600 transition-colors hover:bg-black/5 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100"
            aria-label="XML"
          >
            <ExternalLink className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border border-black/8 bg-white text-zinc-600 transition-colors hover:bg-black/5 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100",
              copied &&
                "border-emerald-900/15 bg-emerald-50 text-emerald-800 dark:border-emerald-200/20 dark:bg-emerald-900/20 dark:text-emerald-200",
            )}
            aria-label={lang === "zh" ? "复制订阅链接" : "Copy feed URL"}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[1.1rem] border border-black/5 bg-white/40 p-3.5 dark:border-white/8 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <p className="text-[0.7rem] leading-relaxed text-zinc-600 dark:text-stone-400">
        {description}
      </p>
    </div>
  );
}
