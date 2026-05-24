"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RotateCcw, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { AppLang } from "@/lib/i18n"

export function ArticleBulkActions({
  formId,
  inputName,
  lang,
}: {
  formId: string
  inputName: string
  lang: AppLang
}) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [selectedCount, setSelectedCount] = useState(0)

  const syncSelectedCount = useCallback(() => {
    const form = formRef.current
    if (!form) {
      setSelectedCount(0)
      return
    }

    const count = Array.from(form.elements).filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement &&
        element.type === "checkbox" &&
        element.name === inputName &&
        element.checked,
    ).length

    setSelectedCount(count)
  }, [inputName])

  useEffect(() => {
    formRef.current = document.getElementById(formId) as HTMLFormElement | null
    syncSelectedCount()

    function handleChange(event: Event) {
      const target = event.target
      if (!(target instanceof HTMLInputElement)) return
      if (target.form?.id === formId && target.name === inputName) {
        syncSelectedCount()
      }
    }

    document.addEventListener("change", handleChange)
    return () => {
      document.removeEventListener("change", handleChange)
    }
  }, [formId, inputName, syncSelectedCount])

  const disabled = selectedCount === 0

  return (
    <>
      <Button
        type="submit"
        form={formId}
        name="intent"
        value="regenerate"
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-label={
          lang === "zh"
            ? selectedCount > 0
              ? `重试 ${selectedCount} 篇已选文章`
              : "重试已选文章"
            : selectedCount > 0
              ? `Regenerate ${selectedCount} selected articles`
              : "Regenerate selected articles"
        }
      >
        <RotateCcw data-icon="inline-start" />
        {lang === "zh" ? "重试" : "Regenerate"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={disabled}
              aria-label={
                lang === "zh"
                  ? selectedCount > 0
                    ? `删除 ${selectedCount} 篇已选文章`
                    : "删除已选文章"
                  : selectedCount > 0
                    ? `Delete ${selectedCount} selected articles`
                    : "Delete selected articles"
              }
            />
          }
        >
          <Trash2 data-icon="inline-start" />
          {lang === "zh" ? "删除" : "Delete"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "zh" ? "删除文章确认" : "Confirm article deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "zh"
                ? `确定要删除已选中的 ${selectedCount} 篇文章吗？关联处理任务和用量记录也会一起清理，此操作不可撤销。`
                : `Delete ${selectedCount} selected article${selectedCount === 1 ? "" : "s"}? Related processing jobs and usage logs will also be removed. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {lang === "zh" ? "取消" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              form={formId}
              name="intent"
              value="delete"
              variant="destructive"
              disabled={disabled}
            >
              {lang === "zh" ? "删除" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
