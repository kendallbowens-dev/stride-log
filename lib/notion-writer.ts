import "server-only"
import type { Client } from "@notionhq/client"

type Block = Record<string, unknown>

function richText(text: string) {
  return [{ type: "text", text: { content: text.slice(0, 2000) } }]
}

/**
 * Minimal Markdown -> Notion blocks converter covering the subset our log
 * generator emits: h1/h2/h3, bullet lists, and paragraphs.
 */
export function markdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = []
  const lines = markdown.split("\n")

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) continue

    if (line.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: richText(line.slice(4)) } })
    } else if (line.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: richText(line.slice(3)) } })
    } else if (line.startsWith("# ")) {
      blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: richText(line.slice(2)) } })
    } else if (/^[-*] /.test(line.trim())) {
      const content = line.trim().replace(/^[-*] /, "")
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: richText(stripInlineMarkers(content)) },
      })
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: richText(stripInlineMarkers(line)) },
      })
    }
  }
  // Notion caps children at 100 blocks per request.
  return blocks.slice(0, 100)
}

function stripInlineMarkers(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1")
}

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
    children: markdownToBlocks(markdown) as never,
  })

  return {
    pageId: (created as { id: string }).id,
    url: (created as { url?: string }).url ?? `https://notion.so/${(created as { id: string }).id.replace(/-/g, "")}`,
  }
}
