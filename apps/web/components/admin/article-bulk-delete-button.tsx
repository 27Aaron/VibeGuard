"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Trash2 } from "lucide-react"

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

export function ArticleBulkDeleteButton({
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

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={selectedCount === 0}
          />
        }
      >
        <Trash2 data-icon="inline-start" />
        {lang === "zh"
          ? selectedCount > 0
            ? `删除选中 (${selectedCount})`
            : "删除选中"
          : selectedCount > 0
            ? `Delete selected (${selectedCount})`
            : "Delete selected"}
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
            variant="destructive"
            disabled={selectedCount === 0}
          >
            {lang === "zh" ? "删除" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
