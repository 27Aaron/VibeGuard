import type { Metadata } from "next";
import { Package, ShieldCheck, Terminal } from "lucide-react";

import { PublicHeader } from "@/components/public-header";
import { resolveLang } from "@/lib/i18n";
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens";

import { CopyButton } from "@/components/ui/copy-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = resolveLang(rawLang);
  const title = lang === "zh" ? "Skill - VibeGuard" : "Skill - VibeGuard";
  const description =
    lang === "zh"
      ? "为 AI 编程助手安装 VibeGuard Skill，一键完成项目安全体检。"
      : "Install the VibeGuard Skill for AI coding assistants to run project security audits.";

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

type SkillPageProps = {
  params: Promise<{ lang: string }>;
};

function getInstallCommand(lang: "zh" | "en") {
  return lang === "zh"
    ? "帮我安装这个 skill：https://github.com/27Aaron/VibeGuard/blob/main/skill/vibeguard/SKILL.md"
    : "Install this skill: https://github.com/27Aaron/VibeGuard/blob/main/skill/vibeguard/SKILL.md";
}

const features = [
  {
    zh: "仓库卫生检查：扫描硬编码密钥、env 误提交、.gitignore 缺口",
    en: "Repo hygiene scan: detect hardcoded secrets, leaked .env files, .gitignore gaps",
  },
  {
    zh: "依赖漏洞检查：调用 VibeGuard API 批量检查 npm、PyPI、Go、crates.io 依赖",
    en: "Dependency check: batch scan npm, PyPI, Go, crates.io packages via VibeGuard API",
  },
  {
    zh: "恶意包与供应链攻击情报：查询最新安全事件和 CVE",
    en: "Malicious package & supply-chain intelligence: query latest security events and CVEs",
  },
  {
    zh: "过期依赖排查：区分「只是旧」和「有漏洞」",
    en: 'Outdated dependency audit: distinguish between "old" and "vulnerable"',
  },
];

export default async function SkillPage({
  params: routeParams,
}: SkillPageProps) {
  const { lang: rawLang } = await routeParams;
  const lang = resolveLang(rawLang);

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />

      <div className={getShellClassName()}>
        <PublicHeader
          homeHref={`/${lang}`}
          currentLang={lang}
          currentSurface="skill"
        />

        <section className={getSectionOuterClassName()}>
          <div className={getSectionInnerClassName()}>
            <div className="flex flex-col gap-8">
              {/* Hero */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-[1.1rem] border border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_2px_8px_rgba(15,23,42,0.08)] dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-stone-100">
                    Skill
                  </h1>
                  <p className="mt-2 text-sm text-zinc-600 sm:whitespace-nowrap dark:text-stone-400">
                    {lang === "zh"
                      ? "为 AI 编程助手安装 VibeGuard Skill，一句话完成项目安全体检。"
                      : "Install the VibeGuard Skill for AI coding assistants — run a full project security audit with one command."}
                  </p>
                </div>
              </div>

              {/* Install Command */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Terminal className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "安装" : "Install"}
                </h2>

                <div className="rounded-[1rem] border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/4">
                  <p className="mb-3 text-xs text-zinc-500 dark:text-stone-400">
                    {lang === "zh"
                      ? "在支持 Skill 的 AI 编程助手中发送以下命令："
                      : "Send this command in any Skill-compatible AI coding assistant:"}
                  </p>
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-900/10 bg-[#f0f7f2] px-4 py-2.5 dark:border-emerald-200/10 dark:bg-emerald-300/8">
                    <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    <code className="min-w-0 flex-1 text-sm font-mono text-emerald-900 dark:text-emerald-100">
                      {getInstallCommand(lang)}
                    </code>
                    <CopyButton text={getInstallCommand(lang)} />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Package className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "功能" : "Features"}
                </h2>

                <div className="grid gap-2">
                  {features.map((feature) => (
                    <div
                      key={feature.en}
                      className="flex items-start gap-3 rounded-[0.85rem] border border-black/5 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      <p className="text-sm leading-relaxed text-zinc-600 dark:text-stone-400">
                        {lang === "zh" ? feature.zh : feature.en}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
