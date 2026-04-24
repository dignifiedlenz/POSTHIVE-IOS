import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {format, isValid} from 'date-fns';
import {theme} from '../theme';
import {MarkdownText} from './MarkdownText';
import type {AICommandData} from '../lib/api';

/** Default PostHive workspace event accent (matches CalendarScreen). */
const WORKSPACE_EVENT_BLUE = '#3b82f6';
const PRIVATE_EVENT_PURPLE = '#a855f7';

function safeFormat(d: Date, fmt: string, fallback: string): string {
  return isValid(d) ? format(d, fmt) : fallback;
}

function eventBorderColor(data: Record<string, unknown>): string {
  const cal = data.calendar_color as string | undefined;
  const vis = data.visibility as string | undefined;
  if (vis === 'private') return PRIVATE_EVENT_PURPLE;
  if (typeof cal === 'string' && cal.length > 0) return cal;
  return WORKSPACE_EVENT_BLUE;
}

type Props = {
  message?: string;
  data: AICommandData;
};

/**
 * Compact event preview aligned with timed / all-day rows on CalendarScreen
 * (left border, title, time — no rich card chrome).
 */
export function AssistantEventInline({message, data}: Props) {
  const raw = data as Record<string, unknown>;
  const updated = !!raw.updated;
  const title = (raw.title as string) || 'Untitled';
  const isAllDay = !!raw.is_all_day;
  const start = raw.start_time ? new Date(raw.start_time as string) : null;
  const end = raw.end_time ? new Date(raw.end_time as string) : null;
  const borderColor = eventBorderColor(raw);

  let timeLine: string | null = null;
  if (isAllDay) {
    timeLine = 'All day';
  } else if (start && end && isValid(start) && isValid(end)) {
    timeLine = `${safeFormat(start, 'h:mm a', '--:--')} - ${safeFormat(end, 'h:mm a', '--:--')}`;
  } else if (start && isValid(start)) {
    timeLine = safeFormat(start, 'h:mm a', '--:--');
  }

  return (
    <View>
      <Text style={styles.intro}>
        {updated ? "Here's your updated event:" : "Here's your new event:"}
      </Text>
      <View style={[styles.eventCard, {borderLeftColor: borderColor}]}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {title}
        </Text>
        {timeLine ? <Text style={styles.eventTime}>{timeLine}</Text> : null}
      </View>
      {message?.trim() ? (
        <MarkdownText style={styles.followupText}>{message}</MarkdownText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: 8,
    fontFamily: theme.typography.fontFamily.regular,
  },
  eventCard: {
    borderLeftWidth: 4,
    paddingLeft: 8,
    paddingRight: 4,
    paddingTop: 2,
    paddingBottom: 2,
    overflow: 'hidden',
  },
  eventTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    lineHeight: 14,
  },
  eventTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    marginTop: 1,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: 12,
  },
  followupText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    marginTop: 10,
    lineHeight: 20,
  },
});
