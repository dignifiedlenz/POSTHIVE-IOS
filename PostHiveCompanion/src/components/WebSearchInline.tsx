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

function hostnameOnly(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?sz=64&domain=example.com';
  }
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
  const list = Array.isArray(results) ? results.filter(r => r?.url) : [];

  return (
    <View>
      <MarkdownText style={styles.body}>{body}</MarkdownText>
      {list.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sourcesRow}>
          {list.slice(0, 10).map((r, i) => (
            <Pressable
              key={`${r.url}-${i}`}
              onPress={() => Linking.openURL(r.url)}
              style={({pressed}) => [styles.chip, pressed && styles.chipPressed]}>
              <Image source={{uri: faviconUrl(r.url)}} style={styles.favicon} />
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
  body: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 12,
    paddingRight: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 160,
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
  favicon: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  host: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});
