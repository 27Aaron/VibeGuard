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
import {
  IDLE_FORM_ACTION_RESULT,
  type FormActionResult,
} from "@/lib/action-result"
import type { AppLang } from "@/lib/i18n"

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
    <form action={formAction}>
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
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
          <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initialValues.enabled}
              className="h-4 w-4 accent-foreground"
            />
            {lang === "zh" ? "启用该来源" : "Enable this source"}
          </label>
          {state.status !== "idle" ? (
            <div
              className={`md:col-span-2 rounded-md border px-3 py-2 text-sm ${
                state.status === "error"
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-border bg-muted/40 text-foreground"
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
