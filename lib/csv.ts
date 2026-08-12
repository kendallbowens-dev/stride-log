/**
 * Minimal CSV parsing for client-side file imports.
 *
 * Returns a list of row objects keyed by the header row. This is intentionally
 * simple (no quoted-comma handling) to match the flat exports Runna/Strava and
 * spreadsheets produce for run logs.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(",")
    const row: Record<string, string> = {}
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()))
    return row
  })
}
