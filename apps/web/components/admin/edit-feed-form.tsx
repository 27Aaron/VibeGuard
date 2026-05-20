"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getAdminSelectClassName, getAdminSubtlePanelClassName } from "@/lib/admin-layout"
import {
  IDLE_FORM_ACTION_RESULT,
  type FormActionResult,
} from "@/lib/action-result"
import type { AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type EditFeedFormProps = {
  lang: AppLang
  initialValues: {
    id: string
    name: string
    siteUrl: string
    feedUrl: string
    feedType: string
    pollIntervalMinutes: number
    enabled: boolean
  }
  action: (
    previousState: FormActionResult,
    formData: FormData,
  ) => Promise<FormActionResult>
}

function SubmitButton({ lang }: { lang: AppLang }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (lang === "zh" ? "保存中..." : "Saving...") : lang === "zh" ? "保存来源" : "Save source"}
    </Button>
  )
}

export function EditFeedForm({ initialValues, action, lang }: EditFeedFormProps) {
  const [state, formAction] = useActionState(action, IDLE_FORM_ACTION_RESULT)

  return (
    <form key={initialValues.id} action={formAction}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="id" value={initialValues.id} />
      <Card>
        <CardHeader>
          <CardTitle>{lang === "zh" ? "编辑来源" : "Edit source"}</CardTitle>
          <CardDescription>
            {lang === "zh"
              ? "更新来源信息、抓取频率和当前启停状态。"
              : "Update source details, polling cadence, and enabled state."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              {lang === "zh" ? "名称" : "Name"}
            </label>
            <Input id="name" name="name" defaultValue={initialValues.name} required />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="feedType" className="text-sm font-medium">
              {lang === "zh" ? "订阅类型" : "Feed type"}
            </label>
            <select
              id="feedType"
              name="feedType"
              defaultValue={initialValues.feedType}
              className={getAdminSelectClassName()}
            >
              <option value="rss">RSS</option>
              <option value="atom">Atom</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="siteUrl" className="text-sm font-medium">
              {lang === "zh" ? "站点地址" : "Site URL"}
            </label>
            <Input
              id="siteUrl"
              name="siteUrl"
              type="url"
              defaultValue={initialValues.siteUrl}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="feedUrl" className="text-sm font-medium">
              {lang === "zh" ? "订阅地址" : "Feed URL"}
            </label>
            <Input
              id="feedUrl"
              name="feedUrl"
              type="url"
              defaultValue={initialValues.feedUrl}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="pollIntervalMinutes" className="text-sm font-medium">
              {lang === "zh" ? "抓取间隔（分钟）" : "Polling interval (minutes)"}
            </label>
            <Input
              id="pollIntervalMinutes"
              name="pollIntervalMinutes"
              type="number"
              min={1}
              defaultValue={initialValues.pollIntervalMinutes}
              required
            />
          </div>
          <label className={cn("flex items-center gap-3 text-sm", getAdminSubtlePanelClassName())}>
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initialValues.enabled}
            />
            {lang === "zh" ? "启用该来源" : "Enable this source"}
          </label>
          {state.status !== "idle" ? (
            <div
              className={`md:col-span-2 rounded-[1.15rem] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:shadow-none ${
                state.status === "error"
                  ? "border-destructive/40 bg-destructive/5 text-destructive dark:bg-destructive/10"
                  : "border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
              }`}
              aria-live="polite"
            >
              {state.message}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton lang={lang} />
        </CardFooter>
      </Card>
    </form>
  )
}
