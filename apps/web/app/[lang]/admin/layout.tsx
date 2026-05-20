import type { Metadata } from "next"
import { Suspense, type ReactNode } from "react"

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
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <main className={getAdminBackgroundClassName()}>
      <div className={getAdminBackdropClassName()} />
      <div className={getAdminShellClassName()}>
        <Suspense>
          <AdminHeader />
        </Suspense>
        {children}
      </div>
    </main>
  )
}
