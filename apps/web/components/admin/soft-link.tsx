"use client"

import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

type SoftLinkProps = {
  href: string
  className?: string
  children: ReactNode
  disabled?: boolean
}

export function SoftLink({ href, className, children, disabled }: SoftLinkProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={() => router.push(href, { scroll: false })}
      className={className}
    >
      {children}
    </button>
  )
}
