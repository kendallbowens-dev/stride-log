import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

type DB = NeonHttpDatabase<typeof schema>

// Lazily instantiate the Drizzle client so the Neon connection string is only
// read when a query actually runs (at request time). Evaluating `neon()` at
// module load breaks `next build`, which imports route/action modules during
// page-data collection when DATABASE_URL is not in scope.
let _db: DB | null = null

function getDb(): DB {
  if (_db) return _db
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add the Neon integration to provide it.")
  }
  _db = drizzle(neon(connectionString), { schema })
  return _db
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb()
    const value = instance[prop as keyof DB]
    return typeof value === "function" ? value.bind(instance) : value
  },
})
