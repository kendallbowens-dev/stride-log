import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

type DB = NodePgDatabase<typeof schema>

// Lazily instantiate the pg Pool + Drizzle client so the Neon connection string
// is only read when a query actually runs (at request time). Evaluating this at
// module load breaks `next build`, which imports route/action modules during
// page-data collection when DATABASE_URL is not in scope.
let _pool: Pool | null = null
let _db: DB | null = null

export function getPool(): Pool {
  if (_pool) return _pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add the Neon integration to provide it.")
  }
  _pool = new Pool({ connectionString })
  return _pool
}

function getDb(): DB {
  if (_db) return _db
  _db = drizzle(getPool(), { schema })
  return _db
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb()
    const value = instance[prop as keyof DB]
    return typeof value === "function" ? value.bind(instance) : value
  },
})
