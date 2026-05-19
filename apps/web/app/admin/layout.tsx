import { Suspense, type ReactNode } from "react"

import { AdminHeader } from "@/components/admin/admin-header"
import {
  getAdminBackdropClassName,
  getAdminBackgroundClassName,
  getAdminShellClassName,
} from "@/lib/admin-layout"

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
