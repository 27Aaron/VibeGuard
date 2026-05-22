import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { THEME_COOKIE_KEY } from "@/lib/theme";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "VibeGuard",
  description: "面向中文用户的供应链攻击、依赖风险与开源安全内容流。",
  icons: {
    icon: "/icon.svg",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const lang = cookieStore.get("lang")?.value === "en" ? "en" : "zh";
  const themePreference = cookieStore.get(THEME_COOKIE_KEY)?.value
  const resolvedTheme = themePreference === "light" ? "light" : "dark"

  return (
    <html
      lang={lang === "en" ? "en" : "zh"}
      className={cn("font-sans", geist.variable, resolvedTheme === "dark" && "dark")}
      data-theme={resolvedTheme}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
