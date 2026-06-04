import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { resolveLang } from "@/lib/i18n";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  getAdminBackdropClassName,
  getAdminBackgroundClassName,
  getAdminShellClassName,
} from "@/lib/admin-layout";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type AdminLayoutProps = {
  children: ReactNode;
  params: Promise<{ lang: string }>;
};

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { lang: rawLang } = await params;
  const lang = resolveLang(rawLang);
  const config = getAdminAuthConfig();
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const isAuthenticated = config
    ? await verifyAdminSessionToken(session, config)
    : false;

  return (
    <main className={getAdminBackgroundClassName()}>
      <div className={getAdminBackdropClassName()} />
      <div className={getAdminShellClassName()}>
        <AdminHeader lang={lang} isAuthenticated={isAuthenticated} />
        {children}
      </div>
    </main>
  );
}
