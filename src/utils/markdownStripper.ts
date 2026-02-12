// =============================================================================
// MARKDOWN STRIPPER UTILITY
// =============================================================================
// Normalizes Markdown-formatted text to plain text for parser compatibility.
// Removes bold, italic, headers, blockquotes, and converts tables to parseable format.

/**
 * Strip Markdown formatting from text to enable regex-based parsers to work.
 * 
 * This function:
 * - Strips **bold** markers → bold
 * - Strips *italic* markers → italic
 * - Strips ## header prefixes → plain text
 * - Strips > blockquote prefixes → plain text
 * - Converts Markdown table rows |col1|col2|col3| into plain text
 * - Preserves line breaks and overall structure
 * 
 * @param text - The Markdown-formatted text
 * @returns Plain text with Markdown syntax removed
 */
export function stripMarkdown(text: string): string {
  if (!text) return text;

  let result = text;

  // 1. Strip bold markers: **text** → text
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');

  // 2. Strip italic markers: *text* → text (but not * used for bullets)
  // Match *text* only when preceded by space, start of line, or other boundary
  result = result.replace(/(^|\s)\*([^*\s][^*]*?)\*(\s|$)/gm, '$1$2$3');

  // 3. Strip header markers: ## Header → Header, ### Header → Header
  result = result.replace(/^#{1,6}\s+/gm, '');

  // 4. Strip blockquote markers: > quote → quote
  result = result.replace(/^>\s*/gm, '');

  // 5. Convert Markdown table rows into plain text
  // Table row: |Year|Event|Details| → Year Event Details (space-separated)
  // Table separator: |---|---|---| → remove entirely
  result = result.replace(/^\|[-:\s|]+\|$/gm, ''); // Remove separator rows
  result = result.replace(/^\|(.+?)\|$/gm, (match, content) => {
    // Split by | and trim each cell, then join with space
    return content.split('|').map((cell: string) => cell.trim()).join(' ');
  });

  // 6. Strip inline code markers: `code` → code
  result = result.replace(/`([^`]+)`/g, '$1');

  // 7. Strip strikethrough: ~~text~~ → text
  result = result.replace(/~~([^~]+)~~/g, '$1');

  return result;
}
