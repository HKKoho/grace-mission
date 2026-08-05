/** Generic, flat YAML frontmatter (`key: value` lines only — no nesting). */
export function parseSimpleYaml(lines: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed
      .slice(colonIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}

function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Returns the parsed `key: value` map from a leading `---` frontmatter block, or null if none. */
export function parseFrontmatter(content: string): Record<string, string> | null {
  const normalized = normalize(content);
  const lines = normalized.split('\n');
  if (lines[0] !== '---') return null;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return null;

  return parseSimpleYaml(lines.slice(1, endIndex));
}

/** Returns the content with a leading frontmatter block (if any) removed. */
export function stripFrontmatter(content: string): string {
  const normalized = normalize(content);
  const lines = normalized.split('\n');
  if (lines[0] !== '---') return content;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return lines
        .slice(i + 1)
        .join('\n')
        .replace(/^\n+/, '');
    }
  }
  return content;
}

function serializeFrontmatter(fields: Record<string, string>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    const needsQuotes = /[:#]/.test(value) || value !== value.trim();
    lines.push(`${key}: ${needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value}`);
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Merges `updates` into `content`'s frontmatter, adding a frontmatter block if the
 * file doesn't have one yet, and re-serializes. Existing keys not present in `updates`
 * are preserved; body content is untouched.
 */
export function mergeFrontmatter(content: string, updates: Record<string, string>): string {
  const existing = parseFrontmatter(content) ?? {};
  const merged = { ...existing, ...updates };
  const body = stripFrontmatter(content);
  return `${serializeFrontmatter(merged)}\n\n${body}`;
}
