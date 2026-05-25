import { loginAction } from "@/lib/actions/auth";
import { resolveLang } from "@/lib/i18n";
import {
  getAdminBackgroundClassName,
  getAdminBackdropClassName,
  getAdminShellClassName,
} from "@/lib/admin-layout";
import { buttonVariants } from "@/components/ui/button";
import { getAdminAuthConfig, sanitizeAdminReturnPath } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ error?: string; from?: string }>;
};

export default async function AdminLoginPage({
  params: routeParams,
  searchParams,
}: LoginPageProps) {
  const { lang: rawLang } = await routeParams;
  const params = (await searchParams) ?? {};
  const lang = resolveLang(rawLang);
  const returnPath = sanitizeAdminReturnPath(params.from, lang);
  const isConfigured = Boolean(getAdminAuthConfig());
  const errorMessage = resolveLoginErrorMessage(params.error, lang);

  return (
    <main className={getAdminBackgroundClassName()}>
      <div className={getAdminBackdropClassName()} />
      <div className={getAdminShellClassName()}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="w-full max-w-sm rounded-[1.4rem] border border-black/6 bg-white/80 p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_2px_8px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/5.5 dark:shadow-none">
            <h1 className="text-lg font-semibold text-zinc-950 dark:text-stone-100">
              {lang === "zh" ? "后台登录" : "Admin login"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "zh"
                ? "请输入管理密码以继续。"
                : "Enter the admin password to continue."}
            </p>

            {!isConfigured ? (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive dark:bg-destructive/10">
                {lang === "zh"
                  ? "后台密码或会话密钥尚未安全配置。"
                  : "Admin password or session secret is not configured safely."}
              </div>
            ) : errorMessage ? (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive dark:bg-destructive/10">
                {errorMessage}
              </div>
            ) : null}

            <form action={loginAction} className="mt-6 flex flex-col gap-4">
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="from" value={returnPath} />
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-zinc-950 dark:text-stone-100"
                >
                  {lang === "zh" ? "密码" : "Password"}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoFocus
                  disabled={!isConfigured}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-full border border-black/6 bg-[#fcfcfa] px-3 text-base text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none placeholder:text-zinc-400 focus-visible:border-emerald-700/30 focus-visible:ring-2 focus-visible:ring-emerald-700/10 dark:border-white/10 dark:bg-white/5.5 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus-visible:border-emerald-200/30 dark:focus-visible:ring-emerald-200/10"
                />
              </div>
              <button
                type="submit"
                disabled={!isConfigured}
                className={cn(buttonVariants(), "w-full rounded-full")}
              >
                {lang === "zh" ? "登录" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function resolveLoginErrorMessage(
  error: string | undefined,
  lang: "zh" | "en",
) {
  if (error === "rate") {
    return lang === "zh"
      ? "尝试次数过多，请稍后再试。"
      : "Too many attempts. Try again later.";
  }

  if (error === "config") {
    return lang === "zh"
      ? "后台密码或会话密钥尚未安全配置。"
      : "Admin password or session secret is not configured safely.";
  }

  if (error) {
    return lang === "zh" ? "密码错误，请重试。" : "Wrong password. Try again.";
  }

  return "";
}
