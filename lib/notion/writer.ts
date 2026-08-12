import "server-only"
import type { Client } from "@notionhq/client"
import { markdownToBlocks, richText } from "@/lib/notion/blocks"

/**
 * Finds a parent page the Connect-authorized integration can access.
 * The user selects which pages to share during the Notion OAuth consent.
 */
async function findParentPageId(notion: Client): Promise<string | null> {
  const res = await notion.search({
    filter: { property: "object", value: "page" },
    page_size: 10,
  })
  const page = res.results.find((r) => (r as { object?: string }).object === "page")
  return page ? (page as { id: string }).id : null
}

export interface NotionWriteResult {
  pageId: string
  url: string
}

/**
 * Creates a new Notion page for a weekly running log under the first
 * accessible parent page. Returns the created page id and URL.
 */
export async function writeLogToNotion(
  notion: Client,
  title: string,
  markdown: string,
): Promise<NotionWriteResult> {
  const parentId = await findParentPageId(notion)
  if (!parentId) {
    throw new Error(
      "No accessible Notion page found. Open the Notion connection and share at least one page with the integration.",
    )
  }

  const created = await notion.pages.create({
    parent: { type: "page_id", page_id: parentId },
    properties: {
      title: { title: richText(title) },
    },
    children: markdownToBlocks(markdown),
  })

  return {
    pageId: created.id,
    url: (created as { url?: string }).url ?? `https://notion.so/${created.id.replace(/-/g, "")}`,
  }
}
