import { pathToFileURL } from "node:url"

/**
 * 判断当前模块是否为 Node.js 进程的入口文件。
 *
 * 通过比较传入的 moduleUrl 与 process.argv[1]（即命令行启动脚本路径）来判断
 * 当前模块是否被直接执行（而非被其他模块 import 引入）。
 *
 * 该函数从 sync-osv.ts 和 index.ts 中抽取为公共工具函数，避免重复实现。
 */
export function isDirectExecution(moduleUrl: string): boolean {
  return (
    typeof process.argv[1] === "string" &&
    moduleUrl === pathToFileURL(process.argv[1]).href
  )
}
