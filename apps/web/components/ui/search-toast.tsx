"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

type SearchToastProps = {
  status?: string
  message?: string
}

export function SearchToast({ status, message }: SearchToastProps) {
  const lastToastRef = useRef<string | null>(null)

  useEffect(() => {
    if (!message) return

    const key = `${status}:${message}`
    if (lastToastRef.current === key) return
    lastToastRef.current = key

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
