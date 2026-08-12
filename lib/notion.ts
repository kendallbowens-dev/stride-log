import "server-only"
import { getToken, startAuthorization, UserAuthorizationRequiredError } from "@vercel/connect"
import { Client } from "@notionhq/client"
import { OWNER_ID } from "@/lib/owner"

// Opaque Vercel Connect connector UID (identifies the connector; grants no access by itself).
const NOTION_CONNECTOR = "mcp.notion.com/running-log-notion"

// This is a single-owner personal app, so the Connect "user" subject is our stable owner id.
const subject = { type: "user" as const, id: OWNER_ID }

/**
 * Returns an authenticated Notion client, or null if the owner has not yet
 * authorized Notion access through Vercel Connect.
 */
export async function getNotionClient(): Promise<Client | null> {
  try {
    const token = await getToken(NOTION_CONNECTOR, { subject, scopes: ["*"] }, { forceRefresh: false })
    return new Client({ auth: token })
  } catch (err) {
    if (err instanceof UserAuthorizationRequiredError) return null
    throw err
  }
}

export async function isNotionConnected(): Promise<boolean> {
  return (await getNotionClient()) !== null
}

/**
 * Begin the Notion OAuth flow. Returns a URL the browser must visit to grant access.
 */
export async function startNotionAuthorization(callbackUrl: string): Promise<string> {
  const res = await startAuthorization(NOTION_CONNECTOR, { subject, scopes: ["*"] }, { callbackUrl })
  return res.url
}
