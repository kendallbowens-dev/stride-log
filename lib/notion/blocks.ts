import type { BlockObjectRequest, RichTextItemRequest } from "@notionhq/client/build/src/api-endpoints"

/**
 * Pure Markdown -> Notion conversion.
 *
 * This module has no IO — it only transforms the Markdown our log generator
 * emits into the block/rich-text shapes the Notion API expects. Keeping it
 * pure makes the converter trivially testable in isolation from the writer.
 */

/** Wrap plain text into a Notion rich-text array (Notion caps text at 2000 chars). */
export function richText(text: string): RichTextItemRequest[] {
  return [{ type: "text", text: { content: text.slice(0, 2000) } }]
}

/** Strip the inline Markdown markers (`**bold**`, `` `code` ``) our generator uses. */
export function stripInlineMarkers(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1")
}

/**
 * Convert the Markdown subset our log generator emits (h1/h2/h3, bullet lists,
 * and paragraphs) into Notion blocks. Notion caps children at 100 blocks per
 * request, so the result is truncated accordingly.
 */
export function markdownToBlocks(markdown: string): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = []

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd()
    if (!line.trim()) continue

    if (line.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: richText(line.slice(4)) } })
    } else if (line.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: richText(line.slice(3)) } })
    } else if (line.startsWith("# ")) {
      blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: richText(line.slice(2)) } })
    } else if (/^[-*] /.test(line.trim())) {
      const content = stripInlineMarkers(line.trim().replace(/^[-*] /, ""))
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: richText(content) },
      })
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: richText(stripInlineMarkers(line)) },
      })
    }
  }

  return blocks.slice(0, 100)
}
