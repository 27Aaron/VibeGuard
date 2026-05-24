"use client";

import { createContext, useContext } from "react";

import type { AppLang } from "./i18n";

const LangContext = createContext<AppLang>("zh");

export function LangProvider({
  lang,
  children,
}: {
  lang: AppLang;
  children: React.ReactNode;
}) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): AppLang {
  return useContext(LangContext);
}
