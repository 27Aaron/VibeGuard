"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import {
  IDLE_FORM_ACTION_RESULT,
  type FormActionResult,
} from "@/lib/action-result"
import type { AppLang } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type CreateFeedFormProps = {
  lang: AppLang
  action: (
    previousState: FormActionResult,
    formData: FormData,
  ) => Promise<FormActionResult>
}

function SubmitButton({ lang }: { lang: AppLang }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (lang === "zh" ? "创建中..." : "Creating...") : lang === "zh" ? "新增来源" : "Add source"}
    </Button>
  )
}

export function CreateFeedForm({ action, lang }: CreateFeedFormProps) {
  const [state, formAction] = useActionState(action, IDLE_FORM_ACTION_RESULT)

  return (
    <form action={formAction}>
      <input type="hidden" name="lang" value={lang} />
      <Card>
        <CardHeader>
          <CardTitle>{lang === "zh" ? "新增来源" : "Add source"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "zh"
              ? "先保存少量高质量来源，后续再逐步扩充，会更容易定位处理链路里的问题。"
              : "Start with a small set of high-signal sources. It makes pipeline issues easier to isolate."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              {lang === "zh" ? "名称" : "Name"}
            </label>
            <Input id="name" name="name" placeholder="SafeDep Blog" required />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="feedType" className="text-sm font-medium">
              {lang === "zh" ? "订阅类型" : "Feed type"}
            </label>
            <select
              id="feedType"
              name="feedType"
              defaultValue="rss"
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
              placeholder="https://safedep.io/blog"
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
              placeholder="https://safedep.io/rss.xml"
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
              defaultValue={30}
              required
            />
          </div>
          <label className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/30">
            <span className="flex flex-col gap-1">
              <span className="font-medium">
                {lang === "zh" ? "创建后立即启用" : "Enable after creation"}
              </span>
              <span className="text-xs text-muted-foreground">
                {lang === "zh"
                  ? "创建后会参与后续 Worker 抓取"
                  : "The worker can fetch this source after it is saved."}
              </span>
            </span>
            <input
              type="checkbox"
              name="enabled"
              defaultChecked
              className="h-4 w-4 shrink-0 accent-foreground"
            />
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
