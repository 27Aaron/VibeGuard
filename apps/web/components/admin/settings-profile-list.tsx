import Link from "next/link"
import { Bot, PlusCircle } from "lucide-react"

import type { LlmSettingsRow } from "@/components/admin/types"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { activateLlmSettingsAction, testLlmSettingsAction } from "@/lib/actions/settings"
import type { AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type SettingsProfileListProps = {
  profiles: LlmSettingsRow[]
  selectedProfileId?: string
  lang: AppLang
}

export function SettingsProfileList({
  profiles,
  selectedProfileId,
  lang,
}: SettingsProfileListProps) {
  const activeProfile = profiles.find((profile) => profile.isActive)
  const copy =
    lang === "zh"
      ? {
          title: "已保存配置",
          description: "在不同模型服务配置之间切换，并测试当前保存的访问凭证。",
          savedCountLabel: `已保存 ${profiles.length} 套配置`,
          activeModelLabel: activeProfile
            ? `当前生效模型：${activeProfile.model}`
            : "当前还没有生效配置",
          newProfile: "新建配置",
          emptyTitle: "先创建第一套模型配置",
          emptyBody: "保存一套可用的模型服务地址、密钥和默认模型，后台处理链路才会真正开始工作。",
        }
      : {
          title: "Saved profiles",
          description: "Switch between model service profiles and test the saved credentials.",
          savedCountLabel: `${profiles.length} saved profiles`,
          activeModelLabel: activeProfile
            ? `Active model: ${activeProfile.model}`
            : "No active profile yet",
          newProfile: "New profile",
          emptyTitle: "Create your first model profile",
          emptyBody:
            "Save a working model endpoint, key, and default model before the processing pipeline can run end to end.",
        }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>
          {copy.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-slate-900 dark:text-stone-100">
                {copy.savedCountLabel}
              </p>
              <p className="text-sm text-muted-foreground">{copy.activeModelLabel}</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-stone-300">
              <Bot className="size-4" />
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.025]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-stone-100">
              {lang === "zh" ? "配置列表" : "Profiles"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "zh"
                ? "保留一套稳定可用的配置，再逐步补充其他模型服务。"
                : "Keep one stable working profile, then add other model services over time."}
            </p>
          </div>
          <Link
            href={`/admin/settings?profile=new&lang=${lang}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex shrink-0 items-center gap-2",
            )}
          >
            <PlusCircle className="size-4" />
            {copy.newProfile}
          </Link>
        </div>
        {profiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/70 px-4 py-5 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-medium text-slate-900 dark:text-stone-100">
              {copy.emptyTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{copy.emptyBody}</p>
          </div>
        ) : (
          profiles.map((profile) => {
            const isSelected = selectedProfileId === profile.id

            return (
              <div
                key={profile.id}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border border-border px-4 py-3",
                  isSelected && "border-foreground/20 bg-muted/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Link
                      href={`/admin/settings?profile=${profile.id}&lang=${lang}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {profile.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {profile.baseUrl}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile.model} · {lang === "zh" ? "更新于" : "Updated"} {profile.updatedAt}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {profile.isActive ? (
                      <Badge variant="secondary">{lang === "zh" ? "当前生效" : "Active"}</Badge>
                    ) : null}
                    {!profile.hasStoredApiKey ? (
                      <Badge variant="outline">
                        {lang === "zh" ? "未存储密钥" : "No stored key"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/settings?profile=${profile.id}&lang=${lang}`}
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    {lang === "zh" ? "编辑" : "Edit"}
                  </Link>
                  {!profile.isActive ? (
                    <form action={activateLlmSettingsAction}>
                      <input type="hidden" name="id" value={profile.id} />
                      <input type="hidden" name="lang" value={lang} />
                      <Button type="submit" size="sm" variant="outline">
                        {lang === "zh" ? "设为生效配置" : "Set active"}
                      </Button>
                    </form>
                  ) : null}
                  <form action={testLlmSettingsAction}>
                    <input type="hidden" name="id" value={profile.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <Button type="submit" size="sm" variant="outline">
                      {lang === "zh" ? "测试连接" : "Test connection"}
                    </Button>
                  </form>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
