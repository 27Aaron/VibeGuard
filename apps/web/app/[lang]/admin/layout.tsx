import type { Metadata } from "next"
import type { ReactNode } from "react"

import { resolveLang } from "@/lib/i18n"
import { AdminHeader } from "@/components/admin/admin-header"
import {
  getAdminBackdropClassName,
  getAdminBackgroundClassName,
  getAdminShellClassName,
} from "@/lib/admin-layout"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

type AdminLayoutProps = {
  children: ReactNode
  params: Promise<{ lang: string }>
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { lang: rawLang } = await params
  const lang = resolveLang(rawLang)

  return (
    <main className={getAdminBackgroundClassName()}>
      <div className={getAdminBackdropClassName()} />
      <div className={getAdminShellClassName()}>
        <AdminHeader
          lang={lang}
        />
        {children}
      </div>
    </main>
  )
}
