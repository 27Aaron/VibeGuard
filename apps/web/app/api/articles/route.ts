import { NextRequest, NextResponse } from "next/server"

import { listArticles } from "@/lib/api-articles"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // 公开 API 强制使用 status=ready：移除客户端传入的所有 status 参数，
  // 防止非公开状态（如 pending、processing、failed）的文章被意外泄露给外部调用方。
  const safeParams = new URLSearchParams(request.nextUrl.searchParams)
  safeParams.delete("status")

  const payload = await listArticles(safeParams)

  return NextResponse.json(payload)
}
