import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { normalizeInt } from "@vibeguard/shared";
import { schema } from "./schema";

// 注意：本模块采用单例模式——getPool()/getDb() 会在首次调用时惰性创建一个
// PostgreSQL 连接池和 Drizzle 实例，此后同一进程中所有调用共享同一实例。
// 由于 Node.js 事件循环是单线程的，因此不存在线程安全问题。但需要注意：
// closeDb() 会将单例重置为 undefined，允许下次调用时重新创建——调用方在
// 调用 closeDb() 前必须确保没有正在进行中的数据库操作。
//
// 注意：模块级别的可变全局变量（pool、database）导致本模块难以在隔离环境中
// 进行单元测试——同一进程内的多个测试会共享这些状态，造成测试间相互干扰。
// 如需正确测试，建议在调用方使用依赖注入（dependency injection）传入数据库
// 实例，而非在被测代码中直接导入 getDb/getPool。
let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required to initialize the database client.",
    );
  }

  return databaseUrl;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: normalizeInt(process.env.DB_POOL_MAX, 10),
      idleTimeoutMillis: normalizeInt(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
      connectionTimeoutMillis: normalizeInt(
        process.env.DB_CONNECT_TIMEOUT_MS,
        5_000,
      ),
      ssl:
        process.env.DB_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    });
  }

  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!database) {
    database = drizzle(getPool(), { schema });
  }

  return database;
}

export async function closeDb(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
  database = undefined;
}
