"use client"

import { useEffect } from "react"
import { toast } from "sonner"

type SearchToastProps = {
  status?: string
  message?: string
}

export function SearchToast({ status, message }: SearchToastProps) {
  useEffect(() => {
    if (!message) return

    if (status === "success") {
      toast.success(message)
    } else if (status === "error") {
      toast.error(message)
    } else {
      toast(message)
    }
  }, [status, message])

  return null
}
