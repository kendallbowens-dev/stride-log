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
  /** The exact redirect_uri the app sends to Strava during OAuth. */
  redirectUri: string
  /** The bare host of redirectUri — paste this into Strava's "Authorization Callback Domain". */
  callbackDomain: string
}

export interface NotionStatus {
  connected: boolean
}
