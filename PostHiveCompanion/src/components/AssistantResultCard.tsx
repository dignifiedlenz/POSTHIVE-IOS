import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  CalendarDays,
  Clock,
  CloudSun,
  FileText,
  Folder,
  Info,
  ListChecks,
  Sparkles,
  Sun,
  Timer,
} from 'lucide-react-native';
import {theme} from '../theme';
import {MarkdownText} from './MarkdownText';
import type {AICommandData} from '../lib/api';

/**
 * Rich UI for AI tool-call responses.
 *
 * Each card is a flat dark surface with a colored "rail" on the left, a small icon header,
 * and a structured body. We deliberately keep the visual language tight (no big borders,
 * sharp edges per theme.borderRadius=0) and let the content do the work.
 *
 * Falls back to MarkdownText when we don't recognise the result type.
 */
export type AssistantResultCardProps = {
  message: string;
  data: AICommandData | undefined;
};

const RAIL = {
  deliverable: '#facc15',
  project: '#60a5fa',
  resources: '#f472b6',
  series: '#34d399',
  schedule: '#38bdf8',
  summary: '#fb923c',
  weather: '#fde047',
  time: '#a1a1aa',
  default: 'rgba(255,255,255,0.4)',
} as const;

export function AssistantResultCard({message, data}: AssistantResultCardProps) {
  const type = (data as any)?.type as string | undefined;

  if (!type) {
    return <MarkdownText style={styles.fallbackText}>{message}</MarkdownText>;
  }

  switch (type) {
    case 'deliverable':
      return <DeliverableCard message={message} data={data as any} />;
    case 'project':
      return <ProjectCard message={message} data={data as any} />;
    case 'calendar_events':
      return <CalendarEventsCard message={message} data={data as any} />;
    case 'calendar_availability':
      return <AvailabilityCard message={message} data={data as any} />;
    case 'workspace_summary':
      return <WorkspaceSummaryCard message={message} data={data as any} />;
    case 'series_summary':
      return <SeriesCard message={message} data={data as any} />;
    case 'resources':
      return <ResourcesCard message={message} data={data as any} />;
    case 'weather':
      return <WeatherCard message={message} data={data as any} />;
    case 'time_lookup':
      return <TimeCard message={message} data={data as any} />;
    default:
      return <MarkdownText style={styles.fallbackText}>{message}</MarkdownText>;
  }
}

/* -------------------------------------------------------------------------- */
/* Generic card chrome                                                         */
/* -------------------------------------------------------------------------- */

type CardShellProps = {
  rail: string;
  icon: React.ReactNode;
  eyebrow: string;
  title?: string;
  children?: React.ReactNode;
};

function CardShell({rail, icon, eyebrow, title, children}: CardShellProps) {
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[rail, 'rgba(255,255,255,0)']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.cardSheen}
        pointerEvents="none"
      />
      <View style={[styles.cardRail, {backgroundColor: rail}]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, {borderColor: hexWithAlpha(rail, 0.5)}]}>
            {icon}
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardEyebrow}>{eyebrow}</Text>
            {title ? (
              <Text style={styles.cardTitle} numberOfLines={3}>
                {title}
              </Text>
            ) : null}
          </View>
        </View>
        {children ? <View style={styles.cardContent}>{children}</View> : null}
      </View>
    </View>
  );
}

function MetaRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIcon}>{icon}</View>
      <Text style={[styles.metaText, highlight && styles.metaTextHighlight]} numberOfLines={2}>
        {label ? <Text style={styles.metaLabel}>{label} </Text> : null}
        {value}
      </Text>
    </View>
  );
}

function Pill({label, color}: {label: string; color?: string}) {
  return (
    <View
      style={[
        styles.pill,
        color ? {borderColor: hexWithAlpha(color, 0.6), backgroundColor: hexWithAlpha(color, 0.18)} : null,
      ]}>
      <Text style={[styles.pillText, color ? {color: color} : null]}>{label}</Text>
    </View>
  );
}

function FollowupHint({text}: {text: string}) {
  return (
    <View style={styles.hintRow}>
      <Sparkles size={12} color={theme.colors.textMuted} />
      <Text style={styles.hintText}>{text}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Deliverable (created)                                                       */
/* -------------------------------------------------------------------------- */

function DeliverableCard({message, data}: {message: string; data: any}) {
  const due = data.due_date ? formatLongDay(new Date(data.due_date)) : null;
  return (
    <CardShell
      rail={RAIL.deliverable}
      icon={<FileText size={14} color={RAIL.deliverable} />}
      eyebrow="DELIVERABLE CREATED"
      title={data.name}>
      {due ? (
        <MetaRow
          icon={<CalendarDays size={13} color={theme.colors.textSecondary} />}
          value={`Due ${due}`}
          highlight
        />
      ) : null}
      <View style={styles.pillRow}>
        {data.type_label ? <Pill label={String(data.type_label).toUpperCase()} color={RAIL.deliverable} /> : null}
        {data.version ? <Pill label={data.version} /> : null}
        {data.project_name ? <Pill label={data.project_name} /> : null}
      </View>
    </CardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Project                                                                     */
/* -------------------------------------------------------------------------- */

function ProjectCard({message, data}: {message: string; data: any}) {
  return (
    <CardShell
      rail={RAIL.project}
      icon={<Folder size={14} color={RAIL.project} />}
      eyebrow="PROJECT CREATED"
      title={data.name || data.project_name}>
      {data.client_name ? <MetaRow icon={<Info size={13} color={theme.colors.textSecondary} />} value={data.client_name} /> : null}
      {message ? <MarkdownText style={styles.cardMessage}>{message}</MarkdownText> : null}
    </CardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Calendar events list                                                        */
/* -------------------------------------------------------------------------- */

function CalendarEventsCard({message, data}: {message: string; data: any}) {
  const events: any[] = Array.isArray(data.events) ? data.events : [];
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const ev of events) {
      const start = new Date(ev.start);
      const key = formatLongDay(start);
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [events]);
  const timeframe = data.timeframe || 'this period';

  return (
    <CardShell
      rail={RAIL.schedule}
      icon={<CalendarDays size={14} color={RAIL.schedule} />}
      eyebrow="CALENDAR"
      title={`${events.length} event${events.length === 1 ? '' : 's'} • ${timeframe}`}>
      {events.length === 0 ? (
        <Text style={styles.emptyText}>Nothing on the calendar for that window.</Text>
      ) : (
        grouped.map(([day, items]) => (
          <View key={day} style={styles.dayGroup}>
            <Text style={styles.dayLabel}>{day}</Text>
            {items.map(ev => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={[styles.eventDot, {backgroundColor: RAIL.schedule}]} />
                <View style={{flex: 1}}>
                  <Text style={styles.eventTitle} numberOfLines={2}>
                    {ev.title}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {ev.is_all_day
                      ? 'All-day'
                      : `${formatTime(new Date(ev.start))} – ${formatTime(new Date(ev.end))}`}
                    {ev.location ? ` • ${ev.location}` : ''}
                    {ev.calendar_name ? ` • ${ev.calendar_name}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </CardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Calendar availability                                                       */
/* -------------------------------------------------------------------------- */

function AvailabilityCard({message, data}: {message: string; data: any}) {
  const slots: any[] = Array.isArray(data.slots) ? data.slots : [];
  return (
    <CardShell
      rail={RAIL.schedule}
      icon={<Clock size={14} color={RAIL.schedule} />}
      eyebrow="FREE SLOTS"
      title={`${slots.length} window${slots.length === 1 ? '' : 's'} • ${data.timeframe || ''}`}>
      {slots.length === 0 ? (
        <Text style={styles.emptyText}>No free windows in that range.</Text>
      ) : (
        slots.map((slot, i) => (
          <View key={i} style={styles.slotRow}>
            <Text style={styles.slotLabel}>{slot.label}</Text>
            <Pill label={formatDuration(slot.duration_minutes)} />
          </View>
        ))
      )}
    </CardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Workspace summary                                                           */
/* -------------------------------------------------------------------------- */

function WorkspaceSummaryCard({message, data}: {message: string; data: any}) {
  const items: string[] = Array.isArray(data.items) ? data.items : [];
  return (
    <CardShell
      rail={RAIL.summary}
      icon={<ListChecks size={14} color={RAIL.summary} />}
      eyebrow={`SUMMARY • ${(data.scope as string)?.toUpperCase() || 'WORKSPACE'}`}
      title={`${data.open_todos ?? 0} todo${data.open_todos === 1 ? '' : 's'} • ${data.deliverables ?? 0} deliverable${
        data.deliverables === 1 ? '' : 's'
      }`}>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Nothing matches that filter.</Text>
      ) : (
        items.slice(0, 12).map((line, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText} numberOfLines={3}>
              {line.replace(/^[•\-\*]\s*/, '')}
            </Text>
          </View>
        ))
      )}
      {items.length > 12 ? <Text style={styles.emptyText}>…and {items.length - 12} more.</Text> : null}
    </CardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Series summary                                                              */
/* -------------------------------------------------------------------------- */

function SeriesCard({message, data}: {message: string; data: any}) {
  const series = data.series || {};
  const deliverables: any[] = Array.isArray(data.deliverables) ? data.deliverables : [];
  const resources: any[] = Array.isArray(data.resources) ? data.resources : [];
  return (
    <CardShell
      rail={RAIL.series}
      icon={<Folder size={14} color={RAIL.series} />}
      eyebrow={`SERIES • ${series.project?.name ?? ''}`}
      title={series.name}>
      {data.due_summary ? (
        <View style={styles.pillRow}>
          {data.due_summary.earliest ? (
            <Pill label={`Next: ${formatLongDay(new Date(data.due_summary.earliest))}`} color={RAIL.series} />
          ) : null}
          {typeof data.due_summary.pending === 'number' ? (
            <Pill label={`${data.due_summary.pending} pending`} />
          ) : null}
        </View>
      ) : null}
      {deliverables.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Deliverables</Text>
          {deliverables.slice(0, 8).map((d: any) => (
            <View key={d.id} style={styles.bulletRow}>
              <View style={[styles.bulletDot, {backgroundColor: RAIL.deliverable}]} />
              <Text style={styles.bulletText} numberOfLines={2}>
                {d.name}
                {d.due_date ? ` — due ${formatShortDay(new Date(d.due_date))}` : ''}
              </Text>
            </View>
          ))}
          {deliverables.length > 8 ? (
            <Text style={styles.emptyText}>…and {deliverables.length - 8} more.</Text>
          ) : null}
        </View>
      ) : null}
      {resources.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Resources ({resources.length})</Text>
          {resources.slice(0, 6).map((r: any) => (
            <View key={r.id} style={styles.bulletRow}>
              <View style={[styles.bulletDot, {backgroundColor: RAIL.resources}]} />
              <Text style={styles.bulletText} numberOfLines={1}>
                {r.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </CardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Resources                                                                   */
/* -------------------------------------------------------------------------- */

function ResourcesCard({message, data}: {message: string; data: any}) {
  const resources: any[] = Array.isArray(data.resources) ? data.resources : [];
  return (
    <CardShell
      rail={RAIL.resources}
      icon={<FileText size={14} color={RAIL.resources} />}
      eyebrow="RESOURCES"
      title={`${data.project?.name ?? 'Project'} • ${resources.length} file${resources.length === 1 ? '' : 's'}`}>
      {resources.length === 0 ? (
        <Text style={styles.emptyText}>No resource files yet.</Text>
      ) : (
        resources.slice(0, 12).map((r: any) => (
          <View key={r.id} style={styles.bulletRow}>
            <View style={[styles.bulletDot, {backgroundColor: RAIL.resources}]} />
            <Text style={styles.bulletText} numberOfLines={1}>
              {r.name}
            </Text>
          </View>
        ))
      )}
    </CardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Weather / Time                                                              */
/* -------------------------------------------------------------------------- */

function WeatherCard({message, data}: {message: string; data: any}) {
  return (
    <CardShell
      rail={RAIL.weather}
      icon={<CloudSun size={14} color={RAIL.weather} />}
      eyebrow={`WEATHER • ${data.location || ''}`}
      title={data.summary || data.condition || ''}>
      {message ? <MarkdownText style={styles.cardMessage}>{message}</MarkdownText> : null}
    </CardShell>
  );
}

function TimeCard({message, data}: {message: string; data: any}) {
  return (
    <CardShell
      rail={RAIL.time}
      icon={<Sun size={14} color={RAIL.time} />}
      eyebrow={`TIME • ${data.location || ''}`}
      title={data.formatted || ''}>
      {message ? <MarkdownText style={styles.cardMessage}>{message}</MarkdownText> : null}
    </CardShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatLongDay(d: Date): string {
  return d.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
}

function formatShortDay(d: Date): string {
  return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
}

function formatTimeFromHHMM(hhmm: string): string | null {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatTime(d);
}

function formatDuration(minutes: number | undefined | null): string {
  if (!minutes || minutes <= 0) return '';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

/** Convert a hex color to rgba with a given alpha. Accepts colors that already include alpha. */
function hexWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba') || color.startsWith('rgb(')) return color;
  const hex = color.replace('#', '');
  if (hex.length !== 6 && hex.length !== 8) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  fallbackText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  cardSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    opacity: 0.7,
  },
  cardRail: {
    width: 3,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    paddingTop: 1,
  },
  cardEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '600',
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 20,
  },
  cardContent: {
    marginTop: 10,
    gap: 6,
  },
  cardMessage: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 19,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 1,
  },
  metaIcon: {
    width: 16,
    alignItems: 'center',
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  metaTextHighlight: {
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  metaLabel: {
    color: theme.colors.textMuted,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    opacity: 0.85,
  },
  hintText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    flex: 1,
  },
  dayGroup: {
    marginTop: 6,
  },
  dayLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  eventTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
  eventMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  slotLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 3,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
    backgroundColor: theme.colors.textMuted,
  },
  bulletText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
    lineHeight: 19,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    fontStyle: 'italic',
  },
  section: {
    marginTop: 8,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 4,
  },
});

export default AssistantResultCard;

// Suppress unused-Timer-import lint (kept in case we add ETA chips later).
void Timer;
