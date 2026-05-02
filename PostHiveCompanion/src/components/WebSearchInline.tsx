import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import {MarkdownText} from './MarkdownText';
import {theme} from '../theme';

export type WebSearchResultItem = {title: string; url: string; snippet?: string};

const MAX_HOST_LABEL = 28;
const FAVICON_BOX = 16;

function hostnameOnly(url: string): string {
  try {
    const raw = new URL(url).hostname.replace(/^www\./, '');
    return raw.length > MAX_HOST_LABEL ? `${raw.slice(0, MAX_HOST_LABEL)}…` : raw;
  } catch {
    const fallback = url.replace(/^https?:\/\//i, '').split('/')[0] || url;
    return fallback.length > MAX_HOST_LABEL
      ? `${fallback.slice(0, MAX_HOST_LABEL)}…`
      : fallback;
  }
}

function faviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  } catch {
    return 'https://www.google.com/s2/favicons?sz=32&domain=example.com';
  }
}

function normalizeWebResults(raw: WebSearchResultItem[] | null | undefined): WebSearchResultItem[] {
  if (!Array.isArray(raw)) return [];
  const out: WebSearchResultItem[] = [];
  for (const r of raw) {
    if (!r || typeof r.url !== 'string') continue;
    const url = r.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (!parsed.hostname) continue;
    out.push({
      title: typeof r.title === 'string' ? r.title.slice(0, 300) : '',
      url,
      snippet: typeof r.snippet === 'string' ? r.snippet.slice(0, 500) : undefined,
    });
  }
  return out;
}

/** Strip the trailing Sources block the API adds so we render chips from structured `results`. */
export function webSearchAnswerBody(fullMessage: string): string {
  let body = fullMessage;
  const cut = body.search(/\n\n\*\*Sources\*\*/i);
  if (cut !== -1) body = body.slice(0, cut).trim();
  else {
    const cut2 = body.search(/\n\nSources:\n/i);
    if (cut2 !== -1) body = body.slice(0, cut2).trim();
  }
  body = body.replace(/\n{4,}/g, '\n\n\n').trim();
  if (body.length > 12000) {
    body = `${body.slice(0, 12000).trim()}\n\n…`;
  }
  return body;
}

/**
 * Chat-style web search: prose + horizontal source chips with favicons (ChatGPT-style).
 */
export function WebSearchInline({
  message,
  results,
}: {
  message: string;
  results?: WebSearchResultItem[] | null;
}) {
  const body = webSearchAnswerBody(message);
  const list = normalizeWebResults(results).slice(0, 10);

  return (
    <View style={styles.root}>
      <MarkdownText style={styles.body} dense>
        {body}
      </MarkdownText>
      {list.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sourcesScroll}
          contentContainerStyle={styles.sourcesRow}>
          {list.map((r, i) => (
            <Pressable
              key={`${r.url}-${i}`}
              onPress={() => Linking.openURL(r.url)}
              style={({pressed}) => [styles.chip, pressed && styles.chipPressed]}>
              <View style={styles.faviconBox}>
                <Image
                  source={{uri: faviconUrl(r.url)}}
                  style={styles.favicon}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.host} numberOfLines={1}>
                {hostnameOnly(r.url)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    maxWidth: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  body: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
  },
  /** Horizontal ScrollView must have a bounded width or it expands to fit all chips and blows the bubble layout. */
  sourcesScroll: {
    width: '100%',
    maxWidth: '100%',
    flexGrow: 0,
    marginTop: 12,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    maxWidth: 168,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipPressed: {
    opacity: 0.85,
  },
  faviconBox: {
    width: FAVICON_BOX,
    height: FAVICON_BOX,
    borderRadius: 3,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  favicon: {
    width: FAVICON_BOX,
    height: FAVICON_BOX,
  },
  host: {
    flexShrink: 1,
    minWidth: 0,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});
