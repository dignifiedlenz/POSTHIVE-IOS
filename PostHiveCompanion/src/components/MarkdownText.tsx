import React, {useMemo} from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import {theme} from '../theme';

/**
 * Lightweight markdown renderer for assistant chat bubbles.
 *
 * Supports the subset of markdown that GPT typically emits:
 *  - paragraphs separated by blank lines
 *  - `#`, `##`, `###` headings
 *  - `- ` / `* ` / `• ` bulleted lists (single level)
 *  - `1.` / `2.` numbered lists (single level)
 *  - blockquotes (`> ...`)
 *  - fenced code blocks (```lang ... ```) and inline `code`
 *  - **bold**, __bold__, *italic*, _italic_, ~~strike~~
 *  - [label](https://link) links
 *
 * No external deps, no native modules, safe inside RN <Text>.
 */
export type MarkdownTextProps = {
  children: string;
  style?: StyleProp<TextStyle>;
  linkColor?: string;
};

type Inline =
  | {kind: 'text'; value: string; bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean}
  | {kind: 'link'; label: string; href: string};

type Block =
  | {kind: 'p'; inline: Inline[]}
  | {kind: 'h'; level: 1 | 2 | 3; inline: Inline[]}
  | {kind: 'ul'; items: Inline[][]}
  | {kind: 'ol'; items: Inline[][]; start: number}
  | {kind: 'quote'; inline: Inline[]}
  | {kind: 'code'; value: string};

const BOLD_RE = /\*\*(.+?)\*\*|__(.+?)__/g;
const ITALIC_RE = /(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)|(^|[^_])_(?!\s)([^_\n]+?)_(?!_)/g;
const STRIKE_RE = /~~(.+?)~~/g;
const CODE_RE = /`([^`]+)`/g;
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function parseInline(raw: string): Inline[] {
  if (!raw) return [];
  // Tokenize by replacing matches with sentinel placeholders, then rebuild.
  type Token = {start: number; end: number; node: Inline};
  const tokens: Token[] = [];

  const pushNonOverlapping = (start: number, end: number, node: Inline) => {
    for (const t of tokens) if (start < t.end && end > t.start) return;
    tokens.push({start, end, node});
  };

  let m: RegExpExecArray | null;

  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(raw))) {
    pushNonOverlapping(m.index, m.index + m[0].length, {
      kind: 'text',
      value: m[1],
      code: true,
    });
  }

  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(raw))) {
    pushNonOverlapping(m.index, m.index + m[0].length, {
      kind: 'link',
      label: m[1],
      href: m[2],
    });
  }

  BOLD_RE.lastIndex = 0;
  while ((m = BOLD_RE.exec(raw))) {
    const inner = m[1] ?? m[2] ?? '';
    pushNonOverlapping(m.index, m.index + m[0].length, {
      kind: 'text',
      value: inner,
      bold: true,
    });
  }

  STRIKE_RE.lastIndex = 0;
  while ((m = STRIKE_RE.exec(raw))) {
    pushNonOverlapping(m.index, m.index + m[0].length, {
      kind: 'text',
      value: m[1],
      strike: true,
    });
  }

  ITALIC_RE.lastIndex = 0;
  while ((m = ITALIC_RE.exec(raw))) {
    const lead = (m[1] ?? m[3] ?? '');
    const inner = (m[2] ?? m[4] ?? '');
    const matchStart = m.index + lead.length;
    const matchEnd = m.index + m[0].length;
    pushNonOverlapping(matchStart, matchEnd, {
      kind: 'text',
      value: inner,
      italic: true,
    });
  }

  tokens.sort((a, b) => a.start - b.start);

  const out: Inline[] = [];
  let cursor = 0;
  for (const t of tokens) {
    if (t.start > cursor) {
      out.push({kind: 'text', value: raw.slice(cursor, t.start)});
    }
    out.push(t.node);
    cursor = t.end;
  }
  if (cursor < raw.length) {
    out.push({kind: 'text', value: raw.slice(cursor)});
  }
  return out;
}

function parseBlocks(input: string): Block[] {
  const text = input.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = line.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      blocks.push({kind: 'code', value: buf.join('\n')});
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        kind: 'h',
        level: headingMatch[1].length as 1 | 2 | 3,
        inline: parseInline(headingMatch[2].trim()),
      });
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({kind: 'quote', inline: parseInline(buf.join(' '))});
      continue;
    }

    // Numbered list
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const items: Inline[][] = [];
      const start = parseInt(olMatch[1], 10) || 1;
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\.\s+(.*)$/);
        if (!m) break;
        let body = m[1];
        i++;
        // continuation lines (indented, non-empty, non-list)
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^(\d+\.|\s*[-*•])\s+/.test(lines[i])
        ) {
          body += ' ' + lines[i].trim();
          i++;
        }
        items.push(parseInline(body));
      }
      blocks.push({kind: 'ol', items, start});
      continue;
    }

    // Bulleted list
    const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ulMatch) {
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*•]\s+(.*)$/);
        if (!m) break;
        let body = m[1];
        i++;
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^(\d+\.|\s*[-*•])\s+/.test(lines[i])
        ) {
          body += ' ' + lines[i].trim();
          i++;
        }
        items.push(parseInline(body));
      }
      blocks.push({kind: 'ul', items});
      continue;
    }

    // Paragraph (consume contiguous non-blank, non-special lines)
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|>\s?|\d+\.\s|\s*[-*•]\s|```)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({kind: 'p', inline: parseInline(buf.join(' '))});
  }

  return blocks;
}

function openLink(href: string) {
  Linking.openURL(href).catch(() => {
    /* swallow */
  });
}

function renderInline(
  inline: Inline[],
  baseStyle: StyleProp<TextStyle>,
  linkColor: string,
  keyPrefix: string,
): React.ReactNode[] {
  return inline.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (node.kind === 'link') {
      return (
        <Text
          key={key}
          style={[baseStyle, {color: linkColor, textDecorationLine: 'underline'}]}
          onPress={() => openLink(node.href)}>
          {node.label}
        </Text>
      );
    }
    const style: TextStyle[] = [];
    if (node.bold) style.push(styles.bold);
    if (node.italic) style.push(styles.italic);
    if (node.strike) style.push(styles.strike);
    if (node.code) style.push(styles.codeInline);
    return (
      <Text key={key} style={[baseStyle, ...style]}>
        {node.value}
      </Text>
    );
  });
}

export function MarkdownText({
  children,
  style,
  linkColor = '#7CC4FF',
}: MarkdownTextProps) {
  const blocks = useMemo(() => parseBlocks(children ?? ''), [children]);

  return (
    <View>
      {blocks.map((block, bi) => {
        const key = `b-${bi}`;
        switch (block.kind) {
          case 'p':
            return (
              <Text key={key} style={[styles.paragraph, style]}>
                {renderInline(block.inline, [styles.paragraph, style], linkColor, key)}
              </Text>
            );
          case 'h': {
            const headingStyle =
              block.level === 1
                ? styles.h1
                : block.level === 2
                ? styles.h2
                : styles.h3;
            return (
              <Text key={key} style={[headingStyle, style]}>
                {renderInline(block.inline, [headingStyle, style], linkColor, key)}
              </Text>
            );
          }
          case 'ul':
            return (
              <View key={key} style={styles.list}>
                {block.items.map((item, ii) => (
                  <View key={`${key}-${ii}`} style={styles.listRow}>
                    <Text style={[styles.bullet, style]}>•</Text>
                    <Text style={[styles.listItemText, style]}>
                      {renderInline(
                        item,
                        [styles.listItemText, style],
                        linkColor,
                        `${key}-${ii}`,
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'ol':
            return (
              <View key={key} style={styles.list}>
                {block.items.map((item, ii) => (
                  <View key={`${key}-${ii}`} style={styles.listRow}>
                    <Text style={[styles.olMarker, style]}>{block.start + ii}.</Text>
                    <Text style={[styles.listItemText, style]}>
                      {renderInline(
                        item,
                        [styles.listItemText, style],
                        linkColor,
                        `${key}-${ii}`,
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'quote':
            return (
              <View key={key} style={styles.quote}>
                <Text style={[styles.quoteText, style]}>
                  {renderInline(
                    block.inline,
                    [styles.quoteText, style],
                    linkColor,
                    key,
                  )}
                </Text>
              </View>
            );
          case 'code':
            return (
              <View key={key} style={styles.codeBlock}>
                <Text style={styles.codeBlockText}>{block.value}</Text>
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const baseFamily = theme.typography.fontFamily.regular;
const semiboldFamily =
  theme.typography.fontFamily.semibold ?? theme.typography.fontFamily.medium ?? baseFamily;

const styles = StyleSheet.create({
  paragraph: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
    fontFamily: baseFamily,
    marginTop: 0,
    marginBottom: 8,
  },
  h1: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xl + 2,
    lineHeight: 28,
    fontFamily: semiboldFamily,
    marginTop: 4,
    marginBottom: 8,
  },
  h2: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg + 1,
    lineHeight: 24,
    fontFamily: semiboldFamily,
    marginTop: 4,
    marginBottom: 6,
  },
  h3: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
    fontFamily: semiboldFamily,
    marginTop: 4,
    marginBottom: 4,
  },
  list: {
    marginBottom: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingRight: 4,
  },
  bullet: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
    width: 16,
    textAlign: 'center',
  },
  olMarker: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
    minWidth: 22,
    fontVariant: ['tabular-nums'],
    fontFamily: semiboldFamily,
  },
  listItemText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
    flex: 1,
    fontFamily: baseFamily,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255,255,255,0.18)',
    paddingLeft: 10,
    marginBottom: 8,
  },
  quoteText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
    fontStyle: 'italic',
    fontFamily: baseFamily,
  },
  bold: {
    fontFamily: semiboldFamily,
    fontWeight: '600',
  },
  italic: {
    fontStyle: 'italic',
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  codeInline: {
    fontFamily: 'Menlo',
    fontSize: theme.typography.fontSize.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: theme.colors.textPrimary,
  },
  codeBlock: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  codeBlockText: {
    fontFamily: 'Menlo',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
});
