import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { NextResponse } from "next/server"

import { resolveLang } from "@/lib/i18n"

type OpenApiRouteProps = {
  params: Promise<{
    lang: string
  }>
}

export async function GET(_request: Request, { params }: OpenApiRouteProps) {
  const { lang: rawLang } = await params
  const lang = resolveLang(rawLang)
  const filePath = resolve("public", `openapi.${lang}.yaml`)
  const content = await readFile(filePath, "utf-8")

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
