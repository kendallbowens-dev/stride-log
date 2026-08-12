/**
 * Shared cross-cutting types used by both server actions and client
 * components. Domain types specific to the training algorithm live in
 * `lib/training/algorithm.ts`.
 */

export interface StravaStatus {
  configured: boolean
  connected: boolean
  athleteName: string | null
  lastSyncAt: string | null
}

export interface NotionStatus {
  connected: boolean
}
