import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VibeGuard API</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8f9fa; color: #1a1a1a; line-height: 1.6; padding: 2rem; max-width: 860px; margin: 0 auto; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  .desc { color: #666; margin-bottom: 2rem; font-size: 0.95rem; }
  .endpoint { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
  .endpoint-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
  .method { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
  .method-get { background: #dbeafe; color: #1e40af; }
  .method-post { background: #fef3c7; color: #92400e; }
  .path { font-family: "SF Mono", Menlo, monospace; font-size: 0.9rem; font-weight: 600; }
  .endpoint-desc { font-size: 0.85rem; color: #555; margin-bottom: 0.75rem; }
  .params { font-size: 0.8rem; color: #777; margin-bottom: 0.75rem; }
  .params strong { color: #444; }
  .example { display: block; font-family: "SF Mono", Menlo, monospace; font-size: 0.78rem; background: #f3f4f6; padding: 0.6rem 0.8rem; border-radius: 6px; color: #2563eb; text-decoration: none; word-break: break-all; transition: background 0.15s; }
  .example:hover { background: #e5e7eb; }
  .section-title { font-size: 1.1rem; font-weight: 700; margin: 2rem 0 0.75rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
  .tag { display: inline-block; font-size: 0.65rem; font-weight: 600; padding: 1px 6px; border-radius: 3px; background: #f0fdf4; color: #166534; margin-left: 0.5rem; }
</style>
</head>
<body>
<h1>VibeGuard API</h1>
<p class="desc">供应链安全情报公开接口。所有接口均为只读 GET 请求，无需认证，浏览器直接访问即可。</p>

<div class="section-title">文章</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="method method-get">GET</span>
    <span class="path">/api/articles</span>
  </div>
  <div class="endpoint-desc">查询文章列表，支持关键词搜索、标签筛选、来源过滤与分页。</div>
  <div class="params">
    <strong>q</strong> 关键词 &nbsp;
    <strong>tag</strong> 标签 &nbsp;
    <strong>source</strong> 来源 &nbsp;
    <strong>ecosystem</strong> 生态(npm/pypi/go/crates-io) &nbsp;
    <strong>riskCategory</strong> 风险类别 &nbsp;
    <strong>limit</strong> 每页数量(1-100, 默认20) &nbsp;
    <strong>page</strong> 页码 &nbsp;
    <strong>lang</strong> 语言(zh/en)
  </div>
  <a class="example" href="/api/articles?limit=5">/api/articles?limit=5</a>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="method method-get">GET</span>
    <span class="path">/api/articles/{id}</span>
  </div>
  <div class="endpoint-desc">获取单篇文章详情。</div>
  <div class="params"><strong>lang</strong> 语言(zh/en)</div>
</div>

<div class="section-title">来源与概览</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="method method-get">GET</span>
    <span class="path">/api/sources</span>
    <span class="tag">无参数</span>
  </div>
  <div class="endpoint-desc">返回所有已启用的内容来源及其文章数量。</div>
  <a class="example" href="/api/sources">/api/sources</a>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="method method-get">GET</span>
    <span class="path">/api/overview</span>
    <span class="tag">无参数</span>
  </div>
  <div class="endpoint-desc">返回文章总数与来源总数概览。</div>
  <a class="example" href="/api/overview">/api/overview</a>
</div>

<div class="section-title">安全检查</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="method method-get">GET</span>
    <span class="path">/api/security/check/overview</span>
    <span class="tag">无参数</span>
  </div>
  <div class="endpoint-desc">返回本地 OSV 数据库的漏洞统计概览。</div>
  <a class="example" href="/api/security/check/overview">/api/security/check/overview</a>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="method method-post">POST</span>
    <span class="path">/api/security/check/packages</span>
  </div>
  <div class="endpoint-desc">检查指定依赖包是否存在已知安全漏洞。需 JSON Body，格式：{"{"}"packages": [{"{"}"ecosystem": "npm", "name": "lodash", "version": "4.17.20"{"}"}]{"}"}</div>
</div>

<div class="section-title">订阅</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="method method-get">GET</span>
    <span class="path">/zh/feed.xml</span>
  </div>
  <div class="endpoint-desc">中文 RSS 订阅源。</div>
  <a class="example" href="/zh/feed.xml">/zh/feed.xml</a>
</div>

<div class="endpoint">
  <div class="endpoint-header">
    <span class="method method-get">GET</span>
    <span class="path">/en/feed.xml</span>
  </div>
  <div class="endpoint-desc">English RSS feed.</div>
  <a class="example" href="/en/feed.xml">/en/feed.xml</a>
</div>

</body>
</html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
