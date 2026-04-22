import React, {useState, useMemo, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Modal,
  Animated,
  PanResponder,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useFocusEffect, useNavigation} from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  CheckSquare,
  Circle,
  CheckCircle2,
  X,
  ListChecks,
  ArrowRight,
} from 'lucide-react-native';
import {
  format,
  addDays,
  subDays,
  addMonths,
  subMonths,
  isToday,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isValid,
} from 'date-fns';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {capitalizeFirst} from '../../lib/utils';
import {
  useCalendarDayData,
  filterTodosForDate,
  filterScheduledTasksForDate,
  filterBlockedTimesForDate,
  filterDeadlinesForDate,
  separateEventsByType,
  splitTodosByStatus,
  calculateTimePosition,
  formatDateKey,
  PX_PER_HOUR,
  BLOCKED_TIME_COLORS,
  ScheduledTask,
  BlockedTime,
  Deadline,
} from '../../hooks/useCalendarDayData';
import {Todo, CalendarEvent} from '../../lib/types';
import {updateTodoStatus, createEvent} from '../../lib/api';
import {supabase} from '../../lib/supabase';
import {FocusModeModal} from '../../components/FocusModeModal';
import * as Haptics from 'expo-haptics';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// Lightweight tap feedback for calendar day cells.
// On iOS this triggers a subtle selection-change haptic.
function triggerCalendarTapHaptic() {
  if (Platform.OS !== 'ios') return;
  try {
    Haptics.selectionAsync();
  } catch {
    // ignore - haptics are best-effort
  }
}

// Safe format function that handles invalid dates
function safeFormat(date: Date | number, formatStr: string, fallback: string = ''): string {
  try {
    const d = typeof date === 'number' ? new Date(date) : date;
    if (!isValid(d)) return fallback;
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}

const WEEK_STARTS_ON = 0 as const;

function getCalendarDaysForMonth(viewDate: Date): Date[] {
  try {
    if (!isValid(viewDate)) {
      return [];
    }
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const calendarStart = startOfWeek(monthStart, {weekStartsOn: WEEK_STARTS_ON});
    const calendarEnd = endOfWeek(monthEnd, {weekStartsOn: WEEK_STARTS_ON});
    return eachDayOfInterval({start: calendarStart, end: calendarEnd});
  } catch {
    return [];
  }
}

const CAL_MONTH_PAD_H = theme.spacing.md;
const CAL_CELL_GAP = 0;
const CAL_CELL_W =
  (SCREEN_WIDTH - CAL_MONTH_PAD_H * 2 - CAL_CELL_GAP * 14) / 7;
const CAL_MONTH_TITLE_BLOCK = 34;
const CAL_MONTH_SECTION_BOTTOM_PAD = 0;

function estimateMonthSectionHeight(monthStart: Date): number {
  const n = getCalendarDaysForMonth(monthStart).length;
  const rows = n / 7;
  const rowH = Math.max(48, CAL_CELL_W * 1.15);
  return (
    CAL_MONTH_TITLE_BLOCK +
    rows * rowH +
    CAL_MONTH_SECTION_BOTTOM_PAD
  );
}

const MONTH_SCROLL_RANGE_PAST = 24;
const MONTH_SCROLL_RANGE_FUTURE = 24;

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOUR_LABEL_WIDTH = 50;
const TIMELINE_WIDTH = SCREEN_WIDTH - HOUR_LABEL_WIDTH - 32;
const SWIPE_THRESHOLD = 50;

// Hours to display (12 AM to 12 AM - full 24 hours)
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;

export function CalendarScreen() {
  const {user, currentWorkspace} = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(SCREEN_HEIGHT - 300);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);
  const hasInitialMonthScroll = useRef(false);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle navigation params to focus a specific date
  useFocusEffect(
    useCallback(() => {
      const params = route.params as {date?: string; scrollToTime?: string} | undefined;
      if (params?.date) {
        const date = new Date(params.date);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
          hasInitialMonthScroll.current = false;
        }
      }
      if (params?.date || params?.scrollToTime) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigation as any).setParams({date: undefined, scrollToTime: undefined});
      }
    }, [route.params, navigation])
  );

  const {
    todos,
    scheduledTasks,
    calendarEvents,
    blockedTimes,
    deadlines,
    loading,
    refresh,
  } = useCalendarDayData({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  const monthScrollStarts = useMemo(() => {
    const anchor = startOfMonth(new Date());
    const months: Date[] = [];
    for (let i = -MONTH_SCROLL_RANGE_PAST; i <= MONTH_SCROLL_RANGE_FUTURE; i++) {
      months.push(addMonths(anchor, i));
    }
    return months;
  }, []);

  // Compute scroll Y offset for the selected month
  const initialScrollY = useMemo(() => {
    const anchorMonth = startOfMonth(selectedDate);
    const idx = monthScrollStarts.findIndex(d => isSameMonth(d, anchorMonth));
    if (idx < 0) return 0;
    let y = 0;
    for (let i = 0; i < idx; i++) {
      y += estimateMonthSectionHeight(monthScrollStarts[i]);
    }
    return Math.max(0, y);
  }, [monthScrollStarts, selectedDate]);

  // Scroll to current month when content has been measured (most reliable)
  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      if (hasInitialMonthScroll.current) return;
      if (h <= 0) return;
      scrollViewRef.current?.scrollTo({
        y: initialScrollY,
        animated: false,
      });
      hasInitialMonthScroll.current = true;
    },
    [initialScrollY],
  );

  // Build per-day maps for fast cell lookup
  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    calendarEvents.forEach(ev => {
      try {
        const startDateStr = ev.start_time.split('T')[0];
        if (ev.is_all_day) {
          const endDateStr = ev.end_time.split('T')[0];
          let cursor = new Date(`${startDateStr}T00:00:00`);
          const last = new Date(`${endDateStr}T00:00:00`);
          while (cursor < last) {
            const key = formatDateKey(cursor);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
            cursor.setDate(cursor.getDate() + 1);
          }
        } else {
          const start = new Date(ev.start_time);
          const end = new Date(ev.end_time);
          const cursor = new Date(start);
          cursor.setHours(0, 0, 0, 0);
          const lastDay = new Date(end);
          lastDay.setHours(0, 0, 0, 0);
          while (cursor.getTime() <= lastDay.getTime()) {
            const key = formatDateKey(cursor);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
            cursor.setDate(cursor.getDate() + 1);
          }
        }
      } catch {}
    });
    return map;
  }, [calendarEvents]);

  const deadlinesByDayKey = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    deadlines.forEach(dl => {
      if (!dl.due_date) return;
      const key = dl.due_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(dl);
    });
    return map;
  }, [deadlines]);

  // State for event editing
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={continuousCalendarStyles.stickyWeekRow}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <View key={`wkd-${i}`} style={continuousCalendarStyles.stickyWeekCell}>
            <Text style={continuousCalendarStyles.stickyWeekLetter}>{letter}</Text>
          </View>
        ))}
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.calendarScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentOffset={{x: 0, y: initialScrollY}}
        onContentSizeChange={handleContentSizeChange}
        onScroll={e => setScrollY(e.nativeEvent.contentOffset.y)}
        onLayout={e => setViewportHeight(e.nativeEvent.layout.height)}
        stickyHeaderIndices={monthScrollStarts.map((_, i) => i * 2)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.textPrimary}
          />
        }>
        {monthScrollStarts.flatMap(m => {
          const monthKey = format(m, 'yyyy-MM');
          return [
            <View
              key={`title-${monthKey}`}
              style={continuousCalendarStyles.monthStickyTitle}>
              <Text style={continuousCalendarStyles.monthSectionTitle}>
                {safeFormat(m, 'MMMM yyyy', '')}
              </Text>
            </View>,
            <ContinuousCalendarMonthGrid
              key={`grid-${monthKey}`}
              monthAnchor={m}
              selectedDate={selectedDate}
              onSelectDay={day => {
                setSelectedDate(day);
                setDayDetailDate(day);
                setShowDayDetail(true);
              }}
              eventsByDayKey={eventsByDayKey}
              deadlinesByDayKey={deadlinesByDayKey}
            />,
          ];
        })}
        <View style={{height: 80}} />
      </ScrollView>

      {/* Day items modal */}
      <DayItemsModal
        visible={showDayDetail}
        date={dayDetailDate}
        events={dayDetailDate ? eventsByDayKey.get(formatDateKey(dayDetailDate)) || [] : []}
        deadlines={dayDetailDate ? deadlinesByDayKey.get(formatDateKey(dayDetailDate)) || [] : []}
        onEventPress={ev => {
          setSelectedEvent(ev);
          setShowEventDetail(true);
        }}
        onClose={() => setShowDayDetail(false)}
      />

      {/* Event Detail Modal */}
      <EventDetailModal
        visible={showEventDetail}
        event={selectedEvent}
        onClose={() => {
          setShowEventDetail(false);
          setSelectedEvent(null);
        }}
        onUpdate={refresh}
        workspaceId={currentWorkspace?.id || ''}
      />
    </SafeAreaView>
  );
}

// ===== SKELETON COMPONENT =====

function TimelineSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {/* Summary skeleton */}
      <View style={styles.skeletonSummary}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={styles.skeletonSummaryItem}>
            <View style={styles.skeletonCount} />
            <View style={styles.skeletonLabel} />
          </View>
        ))}
      </View>

      {/* Timeline skeleton */}
      <View style={styles.skeletonTimeline}>
        {[9, 10, 11, 14, 15].map(hour => (
          <View
            key={hour}
            style={[
              styles.skeletonEvent,
              {top: (hour - START_HOUR) * PX_PER_HOUR},
            ]}>
            <View style={styles.skeletonEventContent} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ===== MONTH PICKER MODAL =====

interface MonthPickerModalProps {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  todos: Todo[];
  scheduledTasks: ScheduledTask[];
  calendarEvents: CalendarEvent[];
}

function MonthPickerModal({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  todos,
  scheduledTasks,
  calendarEvents,
}: MonthPickerModalProps) {
  const [viewDate, setViewDate] = useState(selectedDate);
  const translateY = useRef(new Animated.Value(0)).current;
  const calendarOpacity = useRef(new Animated.Value(1)).current;

  // Reset view date when modal opens
  React.useEffect(() => {
    if (visible) {
      setViewDate(selectedDate);
    }
  }, [visible, selectedDate]);

  // Animate calendar grid when month changes
  React.useEffect(() => {
    if (visible) {
      // Fade out, change month, fade in
      Animated.sequence([
        Animated.timing(calendarOpacity, {
          toValue: 0.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(calendarOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [viewDate, visible]);

  // Pan responder for month swiping
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dx) < 30;
        },
        onPanResponderMove: (_, gestureState) => {
          translateY.setValue(gestureState.dy);
          // Add slight opacity change during drag for visual feedback
          const opacity = 1 - Math.min(Math.abs(gestureState.dy) / 200, 0.3);
          calendarOpacity.setValue(opacity);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > SWIPE_THRESHOLD) {
            // Swipe down - previous month
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 200,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
              }),
              Animated.timing(calendarOpacity, {
                toValue: 0.2,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start(() => {
              setViewDate(prev => subMonths(prev, 1));
              translateY.setValue(0);
              calendarOpacity.setValue(1);
            });
          } else if (gestureState.dy < -SWIPE_THRESHOLD) {
            // Swipe up - next month
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: -200,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
              }),
              Animated.timing(calendarOpacity, {
                toValue: 0.2,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start(() => {
              setViewDate(prev => addMonths(prev, 1));
              translateY.setValue(0);
              calendarOpacity.setValue(1);
            });
          } else {
            // Snap back smoothly
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 10,
              }),
              Animated.spring(calendarOpacity, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
              }),
            ]).start();
          }
        },
      }),
    [translateY, calendarOpacity],
  );

  // Handle close
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    return getCalendarDaysForMonth(viewDate);
  }, [viewDate]);

  // Check if a day has events and get event counts
  const getDayEventCounts = useCallback(
    (date: Date) => {
      try {
        if (!isValid(date)) return {hasEvents: false, todos: 0, scheduled: 0, events: 0, total: 0};
        const todosCount = filterTodosForDate(todos, date).length;
        const scheduledCount = filterScheduledTasksForDate(scheduledTasks, date).length;
        const eventsCount = separateEventsByType(calendarEvents, date).timedEvents.length;
        const total = todosCount + scheduledCount + eventsCount;
        return {
          hasEvents: total > 0,
          todos: todosCount,
          scheduled: scheduledCount,
          events: eventsCount,
          total,
        };
      } catch {
        return {hasEvents: false, todos: 0, scheduled: 0, events: 0, total: 0};
      }
    },
    [todos, scheduledTasks, calendarEvents],
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={monthPickerStyles.container} edges={['bottom']}>
        {/* Drag Handle */}
        <View style={monthPickerStyles.dragHandleContainer}>
          <View style={monthPickerStyles.dragHandle} />
        </View>

        {/* Header */}
        <View style={monthPickerStyles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={monthPickerStyles.closeButton}
            hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
            activeOpacity={0.7}>
            <X size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={monthPickerStyles.title}>SELECT DATE</Text>
          <TouchableOpacity
            onPress={() => {
              onSelectDate(new Date());
            }}
            style={monthPickerStyles.todayButton}
            activeOpacity={0.7}>
            <Text style={monthPickerStyles.todayText}>TODAY</Text>
          </TouchableOpacity>
        </View>

        {/* Month navigation */}
        <View style={monthPickerStyles.monthNav}>
          <TouchableOpacity
            onPress={() => {
              translateY.setValue(100);
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
              }).start();
              setViewDate(prev => subMonths(prev, 1));
            }}
            style={monthPickerStyles.monthNavButton}
            activeOpacity={0.6}>
            <ChevronLeft size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Animated.Text
            style={[
              monthPickerStyles.monthTitle,
              {opacity: calendarOpacity},
            ]}>
            {safeFormat(viewDate, 'MMMM yyyy', 'SELECT MONTH').toUpperCase()}
          </Animated.Text>
          <TouchableOpacity
            onPress={() => {
              translateY.setValue(-100);
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
              }).start();
              setViewDate(prev => addMonths(prev, 1));
            }}
            style={monthPickerStyles.monthNavButton}
            activeOpacity={0.6}>
            <ChevronRight size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Calendar content - scrollable */}
        <ScrollView
          style={monthPickerStyles.calendarScrollView}
          contentContainerStyle={monthPickerStyles.calendarScrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Week day labels */}
          <View style={monthPickerStyles.weekDays}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => (
              <Text key={`${day}-${i}`} style={monthPickerStyles.weekDayLabel}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          <Animated.View
            style={[
              monthPickerStyles.calendarGrid,
              {
                transform: [{translateY}],
                opacity: calendarOpacity,
              },
            ]}
            {...panResponder.panHandlers}>
            {calendarDays.map((day, index) => {
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const eventCounts = getDayEventCounts(day);

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    monthPickerStyles.dayCell,
                    isSelected && monthPickerStyles.selectedDay,
                    isTodayDate && !isSelected && monthPickerStyles.todayDay,
                  ]}
                  onPress={() => onSelectDate(day)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      monthPickerStyles.dayText,
                      !isCurrentMonth && monthPickerStyles.otherMonthDay,
                      isSelected && monthPickerStyles.selectedDayText,
                      isTodayDate && !isSelected && monthPickerStyles.todayDayText,
                    ]}>
                    {safeFormat(day, 'd', '-')}
                  </Text>
                  {eventCounts.hasEvents && isCurrentMonth && (
                    <View style={monthPickerStyles.eventIndicators}>
                      {eventCounts.total <= 3 ? (
                        // Show individual dots for 1-3 events
                        Array.from({length: Math.min(eventCounts.total, 3)}).map((_, i) => (
                          <View
                            key={i}
                            style={[
                              monthPickerStyles.eventDot,
                              isSelected && monthPickerStyles.selectedEventDot,
                            ]}
                          />
                        ))
                      ) : (
                        // Show count badge for 4+ events
                        <View
                          style={[
                            monthPickerStyles.eventBadge,
                            isSelected && monthPickerStyles.selectedEventBadge,
                          ]}>
                          <Text
                            style={[
                              monthPickerStyles.eventBadgeText,
                              isSelected && monthPickerStyles.selectedEventBadgeText,
                            ]}>
                            {eventCounts.total}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ===== SUB-COMPONENTS =====

function AllDayEventCard({event}: {event: CalendarEvent}) {
  // Use different colors based on visibility
  let baseColor = event.calendar_color || theme.colors.accent;
  if (event.source_type === 'posthive' && event.visibility === 'private') {
    baseColor = '#a855f7'; // Purple for private events
  } else if (event.source_type === 'posthive' && (!event.visibility || event.visibility === 'workspace')) {
    baseColor = event.calendar_color || theme.colors.accent; // Blue for workspace events
  }

  return (
    <View
      style={[
        styles.allDayCard,
        {borderLeftColor: baseColor},
      ]}>
      <Text style={styles.allDayTitle} numberOfLines={1}>
        {event.title}
      </Text>
      {event.location && (
        <View style={styles.eventMeta}>
          <MapPin size={8} color={theme.colors.textMuted} />
          <Text style={styles.eventMetaText}>{event.location}</Text>
        </View>
      )}
    </View>
  );
}

function AllDayDeadlineCard({deadline}: {deadline: Deadline}) {
  // Check if deliverable has final version
  const isFinal = deadline.type === 'deliverable' && (
    deadline.version === 'FINAL' ||
    (typeof deadline.version === 'string' && parseInt(deadline.version) >= 100) ||
    deadline.version === '100'
  );

  // Check if deadline is overdue
  const now = new Date();
  const deadlineDateTime = new Date(`${deadline.due_date}T${deadline.due_time || '23:59:59'}`);
  const isOverdue = deadlineDateTime < now;

  // Determine colors based on status
  let bgColor: string;
  let borderColor: string;
  if (isFinal) {
    bgColor = 'rgba(22,163,74,0.3)';
    borderColor = '#22c55e';
  } else if (isOverdue) {
    bgColor = 'rgba(220,38,38,0.3)';
    borderColor = '#ef4444';
  } else {
    bgColor = 'rgba(37,99,235,0.3)';
    borderColor = '#3b82f6';
  }

  return (
    <View
      style={[
        styles.allDayDeadlineCard,
        {backgroundColor: bgColor, borderLeftColor: borderColor},
      ]}>
      <View style={styles.deadlineIcon}>
        <ArrowRight size={12} color={borderColor} />
      </View>
      <Text style={styles.allDayDeadlineTitle} numberOfLines={1}>
        {deadline.title}
      </Text>
      {isFinal && (
        <View style={styles.finalBadge}>
          <Text style={styles.finalBadgeText}>FINAL</Text>
        </View>
      )}
    </View>
  );
}

function TaskCard({todo, isOverdue}: {todo: Todo; isOverdue?: boolean}) {
  const isCompleted = todo.status === 'completed';
  const isInProgress = todo.status === 'in_progress';

  return (
    <View
      style={[
        styles.taskCard,
        isCompleted && styles.taskCardCompleted,
      ]}>
      {/* Overdue indicator - subtle left border */}
      {isOverdue && <View style={styles.taskOverdueIndicator} />}
      {/* In progress indicator */}
      {isInProgress && !isOverdue && <View style={styles.taskInProgressIndicator} />}
      
      <View style={styles.taskCheckbox}>
        {isCompleted ? (
          <CheckCircle2 size={18} color={theme.colors.success} />
        ) : (
          <Circle
            size={18}
            color={theme.colors.textMuted}
          />
        )}
      </View>
      <View style={styles.taskContent}>
        <Text
          style={[styles.taskTitle, isCompleted && styles.taskTitleCompleted]}
          numberOfLines={1}>
          {capitalizeFirst(todo.title)}
        </Text>
        <View style={styles.taskMeta}>
          {todo.due_time && (
            <>
              <Clock size={10} color={theme.colors.textMuted} />
              <Text style={styles.taskMetaText}>{todo.due_time}</Text>
            </>
          )}
          {isInProgress && (
            <Text style={styles.taskStatusLabel}>In Progress</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function ScheduledTaskCard({task}: {task: ScheduledTask}) {
  const startTime = new Date(task.scheduled_start);
  const endTime = new Date(task.scheduled_end);
  
  // Skip rendering if dates are invalid
  if (!isValid(startTime) || !isValid(endTime)) {
    return null;
  }
  
  const position = calculateTimePosition(startTime, endTime);
  const isCompleted = task.status === 'completed';

  // Adjust position for START_HOUR offset
  const adjustedTop = position.top - START_HOUR * PX_PER_HOUR;

  if (
    adjustedTop + position.height < 0 ||
    adjustedTop > TOTAL_HOURS * PX_PER_HOUR
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.scheduledTaskCard,
        isCompleted && styles.scheduledTaskCompleted,
        {
          top: Math.max(0, adjustedTop),
          height: position.height,
          left: HOUR_LABEL_WIDTH + 8,
          right: 16,
        },
      ]}>
      <View style={styles.scheduledTaskHeader}>
        <CheckSquare
          size={14}
          color={isCompleted ? theme.colors.success : theme.colors.accent}
        />
        <Text
          style={[
            styles.scheduledTaskTitle,
            isCompleted && styles.scheduledTaskTitleCompleted,
          ]}
          numberOfLines={2}>
          {task.title}
        </Text>
      </View>
      <Text style={styles.scheduledTaskTime}>
        {safeFormat(startTime, 'h:mm a', '--:--')} - {safeFormat(endTime, 'h:mm a', '--:--')}
      </Text>
    </View>
  );
}

function EventCard({event, onPress, collisionPosition}: {event: CalendarEvent; onPress?: () => void; collisionPosition?: {left: number; width: number}}) {
  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);
  
  // Skip rendering if dates are invalid
  if (!isValid(startTime) || !isValid(endTime)) {
    return null;
  }
  
  const position = calculateTimePosition(startTime, endTime);

  // Adjust position for START_HOUR offset
  const adjustedTop = position.top - START_HOUR * PX_PER_HOUR;

  if (
    adjustedTop + position.height < 0 ||
    adjustedTop > TOTAL_HOURS * PX_PER_HOUR
  ) {
    return null;
  }

  // Use different colors based on visibility
  let baseColor = event.calendar_color || '#3b82f6';
  if (event.source_type === 'posthive' && event.visibility === 'private') {
    baseColor = '#a855f7'; // Purple for private events
  } else if (event.source_type === 'posthive' && (!event.visibility || event.visibility === 'workspace')) {
    baseColor = event.calendar_color || '#3b82f6'; // Blue for workspace events
  }

  // Use collision position if available, otherwise default
  const leftPos = collisionPosition?.left ?? (HOUR_LABEL_WIDTH + 4);
  const width = collisionPosition?.width ?? (SCREEN_WIDTH - HOUR_LABEL_WIDTH - 20);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.eventCardContainer,
        {
          top: Math.max(0, adjustedTop),
          height: Math.max(position.height, 20),
          left: leftPos,
          width: width,
        },
      ]}>
      <View
        style={[
          styles.eventCard,
          {
            borderLeftColor: baseColor,
          },
        ]}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.eventTime}>
          {safeFormat(startTime, 'h:mm a', '--:--')} - {safeFormat(endTime, 'h:mm a', '--:--')}
        </Text>
        {event.meeting_link && (
          <View style={styles.eventMeta}>
            <Video size={8} color={theme.colors.textMuted} />
            <Text style={styles.eventMetaText}>Video</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function DeadlineIndicator({deadline}: {deadline: Deadline}) {
  // Parse deadline time
  let deadlineHour = 23; // Default to end of day (11 PM)
  if (deadline.due_time) {
    const [hours] = deadline.due_time.split(':').map(Number);
    deadlineHour = hours;
  }

  const adjustedTop = (deadlineHour - START_HOUR) * PX_PER_HOUR;

  // Check if deliverable has final version
  const isFinal = deadline.type === 'deliverable' && (
    deadline.version === 'FINAL' ||
    (typeof deadline.version === 'string' && parseInt(deadline.version) >= 100) ||
    deadline.version === '100'
  );

  // Check if deadline is overdue
  const now = new Date();
  const deadlineDateTime = new Date(`${deadline.due_date}T${deadline.due_time || '23:59:59'}`);
  const isOverdue = deadlineDateTime < now;

  // Determine colors based on status
  let bgColor: string;
  let lineColor: string;
  if (isFinal) {
    bgColor = 'rgba(22,163,74,0.6)';
    lineColor = '#22c55e';
  } else if (isOverdue) {
    bgColor = 'rgba(220,38,38,0.6)';
    lineColor = '#ef4444';
  } else {
    bgColor = 'rgba(37,99,235,0.6)';
    lineColor = '#3b82f6';
  }

  return (
    <View
      style={[
        styles.deadlineContainer,
        {top: adjustedTop},
      ]}>
      {/* The line across the timeline */}
      <View style={[styles.deadlineLine, {backgroundColor: lineColor}]} />
      {/* The label */}
      <View style={[styles.deadlineLabel, {backgroundColor: bgColor}]}>
        <Text style={styles.deadlineLabelText} numberOfLines={1}>
          {deadline.title}
        </Text>
        {deadline.due_time && (
          <Text style={styles.deadlineTime}>
            {deadline.due_time.substring(0, 5)}
          </Text>
        )}
      </View>
    </View>
  );
}

function BlockedTimeCard({blocked}: {blocked: BlockedTime}) {
  const startTime = new Date(blocked.start_time);
  const endTime = new Date(blocked.end_time);
  
  // Skip rendering if dates are invalid
  if (!isValid(startTime) || !isValid(endTime)) {
    return null;
  }
  
  const position = calculateTimePosition(startTime, endTime);
  const colors = BLOCKED_TIME_COLORS[blocked.type];

  // Adjust position for START_HOUR offset
  const adjustedTop = position.top - START_HOUR * PX_PER_HOUR;

  if (
    adjustedTop + position.height < 0 ||
    adjustedTop > TOTAL_HOURS * PX_PER_HOUR
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.blockedTimeCard,
        {
          top: Math.max(0, adjustedTop),
          height: position.height,
          left: HOUR_LABEL_WIDTH,
          width: TIMELINE_WIDTH,
          backgroundColor: colors.bg,
          borderLeftColor: colors.border,
        },
      ]}>
      <Text style={[styles.blockedTimeTitle, {color: colors.text}]}>
        {blocked.reason || blocked.type.replace('_', ' ').toUpperCase()}
      </Text>
    </View>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const top = (currentHour - START_HOUR) * PX_PER_HOUR;

  if (top < 0 || top > TOTAL_HOURS * PX_PER_HOUR) {
    return null;
  }

  return (
    <View style={[styles.currentTimeIndicator, {top}]}>
      <View style={styles.currentTimeDot} />
      <View style={styles.currentTimeLine} />
    </View>
  );
}

// ===== NEXT EVENT BAR =====

interface NextEventItem {
  type: 'event' | 'scheduled_task';
  title: string;
  startTime: Date;
  endTime: Date;
  color?: string;
  location?: string | null;
  meetingLink?: string | null;
}

function NextEventBar({item, onPress}: {item: NextEventItem; onPress: () => void}) {
  const now = new Date();
  const timeUntil = item.startTime.getTime() - now.getTime();
  const minutesUntil = Math.floor(timeUntil / (1000 * 60));
  const hoursUntil = Math.floor(minutesUntil / 60);
  const remainingMinutes = minutesUntil % 60;

  // Format time until
  let timeUntilText = '';
  if (hoursUntil > 24) {
    const days = Math.floor(hoursUntil / 24);
    timeUntilText = `${days}d`;
  } else if (hoursUntil > 0) {
    timeUntilText = remainingMinutes > 0 ? `${hoursUntil}h ${remainingMinutes}m` : `${hoursUntil}h`;
  } else if (minutesUntil > 0) {
    timeUntilText = `${minutesUntil}m`;
  } else {
    timeUntilText = 'NOW';
  }

  const isEvent = item.type === 'event';
  const accentColor = isEvent ? (item.color || '#3b82f6') : theme.colors.accent;

  return (
    <View style={styles.nextEventContainer}>
      {/* Gradient fade above the bar */}
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 1)']}
        locations={[0, 0.3, 1]}
        style={styles.nextEventGradient}
        pointerEvents="none"
      />
      
      <TouchableOpacity 
        style={styles.nextEventBar} 
        onPress={onPress}
        activeOpacity={0.7}>
        {/* Left accent bar */}
        <View style={[styles.nextEventAccent, {backgroundColor: accentColor}]} />
        
        {/* Content */}
        <View style={styles.nextEventContent}>
          <View style={styles.nextEventTopRow}>
            <Text style={styles.nextEventLabel}>NEXT</Text>
            <View style={styles.nextEventDot} />
            <Text style={styles.nextEventTimeLabel}>
              {safeFormat(item.startTime, 'h:mm a', '--:--')}
            </Text>
          </View>
          <Text style={styles.nextEventTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>

        {/* Time until */}
        <View style={styles.nextEventTimeContainer}>
          <Text style={[styles.nextEventCountdown, {color: accentColor}]}>
            {timeUntilText}
          </Text>
          <ArrowRight size={14} color={theme.colors.textMuted} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ===== MONTH PICKER STYLES =====

const monthPickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs / 2,
    backgroundColor: theme.colors.background,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  closeButton: {
    padding: theme.spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -theme.spacing.xs,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  todayButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceElevated,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: 12,
  },
  monthNavButton: {
    padding: theme.spacing.sm,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  monthTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 1,
  },
  swipeHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontStyle: 'italic',
  },
  calendarScrollView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  calendarScrollContent: {
    flexGrow: 1,
    paddingTop: theme.spacing.xs,
    backgroundColor: theme.colors.background,
  },
  weekDays: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    backgroundColor: theme.colors.background,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  dayCell: {
    width: (SCREEN_WIDTH - theme.spacing.lg * 2 - 14) / 7, // Account for padding and margin
    height: (SCREEN_WIDTH - theme.spacing.lg * 2 - 14) / 7, // Make it square
    paddingVertical: theme.spacing.xs / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 1,
    backgroundColor: theme.colors.surface,
  },
  selectedDay: {
    backgroundColor: theme.colors.accent,
  },
  todayDay: {
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  dayText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: 0,
  },
  otherMonthDay: {
    color: theme.colors.textMuted,
  },
  selectedDayText: {
    color: theme.colors.accentText,
    fontFamily: theme.typography.fontFamily.bold,
  },
  todayDayText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.bold,
  },
  eventIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.colors.accent,
    marginHorizontal: 2,
  },
  selectedEventDot: {
    backgroundColor: theme.colors.accentText,
  },
  eventBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  selectedEventBadge: {
    backgroundColor: theme.colors.accentText,
  },
  eventBadgeText: {
    color: theme.colors.accentText,
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    lineHeight: 10,
  },
  selectedEventBadgeText: {
    color: theme.colors.accent,
  },
});

const STICKY_WEEK_HEADER_HEIGHT =
  theme.spacing.xs + theme.spacing.xs + 18 + theme.spacing.xs / 2;

const DEADLINE_COLOR = '#f59e0b';
const DEFAULT_EVENT_COLOR = '#3b82f6';
const PRIVATE_EVENT_COLOR = '#a855f7';
const MAX_BARS_PER_DAY = 3;

const CAL_DAY_CELL_HEIGHT = Math.max(48, CAL_CELL_W * 1.15);

const continuousCalendarStyles = StyleSheet.create({
  stickyWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH,
    paddingHorizontal: CAL_MONTH_PAD_H,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  stickyWeekCell: {
    width: CAL_CELL_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyWeekLetter: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  monthSection: {
    paddingHorizontal: CAL_MONTH_PAD_H,
    paddingTop: 2,
    paddingBottom: CAL_MONTH_SECTION_BOTTOM_PAD,
  },
  monthStickyTitle: {
    paddingHorizontal: CAL_MONTH_PAD_H,
    paddingVertical: 6,
    backgroundColor: theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  monthSectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: '800',
    letterSpacing: -0.2,
    paddingHorizontal: 2,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDayCell: {
    width: CAL_CELL_W,
    height: CAL_DAY_CELL_HEIGHT,
    paddingTop: 2,
    paddingHorizontal: 1,
    borderRadius: 6,
    backgroundColor: 'transparent',
    alignItems: 'stretch',
  },
  monthDayCellSelected: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  monthDayCellPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{scale: 0.96}],
  },
  dayNumberRow: {
    alignItems: 'center',
    marginBottom: 2,
  },
  dayNumber: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'center',
  },
  dayNumberOther: {
    color: theme.colors.textMuted,
    opacity: 0.5,
  },
  dayNumberToday: {
    color: '#000',
    backgroundColor: '#fff',
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 20,
  },
  barsStack: {
    marginTop: 2,
    gap: 2,
  },
  bar: {
    height: 3,
    borderRadius: 1.5,
    width: '100%',
  },
  moreText: {
    color: theme.colors.textMuted,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 1,
  },
});

function ContinuousCalendarMonthGrid({
  monthAnchor,
  selectedDate,
  onSelectDay,
  eventsByDayKey,
  deadlinesByDayKey,
}: {
  monthAnchor: Date;
  selectedDate: Date;
  onSelectDay: (d: Date) => void;
  eventsByDayKey: Map<string, CalendarEvent[]>;
  deadlinesByDayKey: Map<string, Deadline[]>;
}) {
  const calendarDays = useMemo(
    () => getCalendarDaysForMonth(monthAnchor),
    [monthAnchor],
  );

  return (
    <View style={continuousCalendarStyles.monthSection}>
      <View style={continuousCalendarStyles.monthGrid}>
        {calendarDays.map((day, index) => {
          const inMonth = isSameMonth(day, monthAnchor);
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const key = formatDateKey(day);
          const dayEvents = eventsByDayKey.get(key) || [];
          const dayDeadlines = deadlinesByDayKey.get(key) || [];

          // Build colored bars: events (with calendar color) first, then deadlines
          const bars: {key: string; color: string}[] = [];
          for (const ev of dayEvents) {
            if (bars.length >= MAX_BARS_PER_DAY) break;
            const color = ev.calendar_color
              || (ev.visibility === 'private' ? PRIVATE_EVENT_COLOR : DEFAULT_EVENT_COLOR);
            bars.push({key: `e-${ev.id}`, color});
          }
          for (const dl of dayDeadlines) {
            if (bars.length >= MAX_BARS_PER_DAY) break;
            bars.push({key: `d-${dl.id}`, color: DEADLINE_COLOR});
          }
          const overflow = (dayEvents.length + dayDeadlines.length) - bars.length;

          return (
            <Pressable
              key={`${day.toISOString()}-${index}`}
              onPress={() => {
                triggerCalendarTapHaptic();
                onSelectDay(day);
              }}
              unstable_pressDelay={120}
              hitSlop={2}
              style={({pressed}) => [
                continuousCalendarStyles.monthDayCell,
                isSelected && continuousCalendarStyles.monthDayCellSelected,
                pressed && continuousCalendarStyles.monthDayCellPressed,
              ]}>
              <View style={continuousCalendarStyles.dayNumberRow}>
                <Text
                  style={[
                    continuousCalendarStyles.dayNumber,
                    !inMonth && continuousCalendarStyles.dayNumberOther,
                    isTodayDate && continuousCalendarStyles.dayNumberToday,
                  ]}>
                  {safeFormat(day, 'd', '-')}
                </Text>
              </View>
              {inMonth && bars.length > 0 && (
                <View style={continuousCalendarStyles.barsStack}>
                  {bars.map(b => (
                    <View
                      key={b.key}
                      style={[continuousCalendarStyles.bar, {backgroundColor: b.color}]}
                    />
                  ))}
                  {overflow > 0 && (
                    <Text style={continuousCalendarStyles.moreText}>+{overflow}</Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ===== DAY ITEMS MODAL =====

const dayItemsStyles = StyleSheet.create({
  overlayLayer: {
    zIndex: 900,
    elevation: 30,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 12,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.bold,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  itemColorBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  itemMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    marginTop: 2,
  },
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
});

function DayItemsModal({
  visible,
  date,
  events,
  deadlines,
  onEventPress,
  onClose,
}: {
  visible: boolean;
  date: Date | null;
  events: CalendarEvent[];
  deadlines: Deadline[];
  onEventPress: (e: CalendarEvent) => void;
  onClose: () => void;
}) {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const at = new Date(a.start_time).getTime();
      const bt = new Date(b.start_time).getTime();
      return at - bt;
    });
  }, [events]);

  // We need this drawer to render OVER the iOS native UITabBar (which is a
  // sibling UIView outside our React tree). Only `Modal` reliably escapes
  // that hierarchy on iOS. To avoid the native Modal slide latency
  // (~300–350ms), we mount the Modal with `animationType="none"` so the
  // window appears instantly, then drive the slide ourselves via the
  // native-driver Animated API for a snappy ~180ms in / ~140ms out.
  const slideY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const mountedRef = useRef(false);
  // Snapshot the last shown date/events/deadlines so the list doesn't blank
  // out while the sheet is animating closed.
  const lastDateRef = useRef<Date | null>(date);
  const lastEventsRef = useRef(sortedEvents);
  const lastDeadlinesRef = useRef(deadlines);
  if (date) lastDateRef.current = date;
  if (visible) {
    lastEventsRef.current = sortedEvents;
    lastDeadlinesRef.current = deadlines;
  }
  const shownEvents = visible ? sortedEvents : lastEventsRef.current;
  const shownDeadlines = visible ? deadlines : lastDeadlinesRef.current;

  useEffect(() => {
    if (visible) {
      // Reset to off-screen so the open animation always plays from the
      // bottom, then mount the Modal. We use a ref (not state) to track
      // mount status so this effect doesn't retrigger when we flip it.
      slideY.setValue(SCREEN_HEIGHT);
      fade.setValue(0);
      if (!mountedRef.current) {
        mountedRef.current = true;
        setMounted(true);
      }
      // Kick the animation off on the next frame so the Modal has had a
      // chance to lay out before the native driver starts driving.
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fade, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.spring(slideY, {
            toValue: 0,
            damping: 26,
            stiffness: 320,
            mass: 0.55,
            overshootClamping: true,
            restSpeedThreshold: 0.5,
            restDisplacementThreshold: 0.5,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (mountedRef.current) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: SCREEN_HEIGHT,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished) {
          mountedRef.current = false;
          setMounted(false);
        }
      });
    }
  }, [visible, fade, slideY]);

  const displayDate = date || lastDateRef.current;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFillObject, dayItemsStyles.overlayLayer, {opacity: fade}]}>
        <Pressable style={dayItemsStyles.overlay} onPress={onClose}>
          <Animated.View
            style={[dayItemsStyles.sheet, {transform: [{translateY: slideY}]}]}
            // Stop touches on the sheet from closing the overlay.
            onStartShouldSetResponder={() => true}>
          <View style={dayItemsStyles.handle} />
          <View style={dayItemsStyles.header}>
            <Text style={dayItemsStyles.title}>
              {displayDate ? safeFormat(displayDate, 'EEEE, MMM d', '') : ''}
            </Text>
            <TouchableOpacity style={dayItemsStyles.closeBtn} onPress={onClose}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={dayItemsStyles.list}>
            {shownEvents.length === 0 && shownDeadlines.length === 0 && (
              <Text style={dayItemsStyles.emptyText}>No events or deadlines</Text>
            )}
            {shownEvents.map(ev => {
              const color =
                ev.calendar_color
                || (ev.visibility === 'private' ? '#a855f7' : '#3b82f6');
              const timeStr = ev.is_all_day
                ? 'All day'
                : `${safeFormat(new Date(ev.start_time), 'h:mm a', '')} – ${safeFormat(new Date(ev.end_time), 'h:mm a', '')}`;
              return (
                <TouchableOpacity
                  key={`ev-${ev.id}`}
                  style={dayItemsStyles.itemRow}
                  onPress={() => onEventPress(ev)}
                  activeOpacity={0.7}>
                  <View style={[dayItemsStyles.itemColorBar, {backgroundColor: color}]} />
                  <View style={dayItemsStyles.itemBody}>
                    <Text style={dayItemsStyles.itemTitle} numberOfLines={2}>
                      {ev.title || 'Untitled event'}
                    </Text>
                    <Text style={dayItemsStyles.itemMeta}>
                      {timeStr}
                      {ev.calendar_name ? `  •  ${ev.calendar_name}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {shownDeadlines.map(dl => (
              <View key={`dl-${dl.id}`} style={dayItemsStyles.itemRow}>
                <View style={[dayItemsStyles.itemColorBar, {backgroundColor: '#f59e0b'}]} />
                <View style={dayItemsStyles.itemBody}>
                  <Text style={dayItemsStyles.itemTitle} numberOfLines={2}>
                    {dl.title}
                  </Text>
                  <Text style={dayItemsStyles.itemMeta}>
                    Deadline{dl.due_time ? `  •  ${dl.due_time.slice(0, 5)}` : ''}
                  </Text>
                </View>
              </View>
            ))}
            <View style={{height: 24}} />
          </ScrollView>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ===== EVENT DETAIL MODAL =====

interface EventDetailModalProps {
  visible: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onUpdate: () => void;
  workspaceId: string;
}

function EventDetailModal({visible, event, onClose, onUpdate, workspaceId}: EventDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [visibility, setVisibility] = useState<'workspace' | 'private'>('workspace');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when event changes
  React.useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setStartTime(new Date(event.start_time));
      setEndTime(new Date(event.end_time));
      setVisibility(event.visibility || 'workspace');
      // Auto-enter edit mode for new events
      const isNewEvent = event.id.startsWith('temp-');
      setIsEditing(isNewEvent);
      setShowDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
    }
  }, [event]);

  const handleDateChange = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      // Update both start and end times to the new date, keeping times
      const newStart = new Date(startTime);
      newStart.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setStartTime(newStart);

      const newEnd = new Date(endTime);
      newEnd.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setEndTime(newEnd);
    }
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const handleStartTimeChange = (selectedTime: Date | undefined) => {
    if (selectedTime) {
      const newStart = new Date(startTime);
      newStart.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setStartTime(newStart);
      
      // If end time is before start time, adjust it
      if (newStart >= endTime) {
        const newEnd = new Date(newStart);
        newEnd.setHours(newStart.getHours() + 1);
        setEndTime(newEnd);
      }
    }
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }
  };

  const handleEndTimeChange = (selectedTime: Date | undefined) => {
    if (selectedTime) {
      const newEnd = new Date(endTime);
      newEnd.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      
      // Ensure end is after start
      if (newEnd > startTime) {
        setEndTime(newEnd);
      }
    }
    if (Platform.OS === 'android') {
      setShowEndTimePicker(false);
    }
  };

  const handleSave = async () => {
    if (!event || !workspaceId) return;
    
    setIsLoading(true);
    try {
      const isNewEvent = event.id.startsWith('temp-');
      
      if (isNewEvent) {
        // Create new event
        await createEvent(workspaceId, {
          title: title.trim(),
          description: description.trim() || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          is_all_day: false,
          visibility: visibility,
        });
        
        Alert.alert('Success', 'Event created');
      } else {
        // Update existing event
        const {error} = await supabase
          .from('calendar_events')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            visibility: visibility,
          })
          .eq('id', event.id);

        if (error) throw error;
        Alert.alert('Success', 'Event updated');
      }

      onUpdate();
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving event:', err);
      Alert.alert('Error', isNewEvent ? 'Failed to create event' : 'Failed to update event');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!event) return;
    
    // Don't allow deleting new events that haven't been saved
    const isNewEvent = event.id.startsWith('temp-');
    if (isNewEvent) {
      onClose();
      return;
    }

    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const {error} = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', event.id);

              if (error) throw error;

              onUpdate();
              onClose();
            } catch (err) {
              console.error('Error deleting event:', err);
              Alert.alert('Error', 'Failed to delete event');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  if (!event) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={eventDetailStyles.overlay}>
        <View style={eventDetailStyles.container}>
          {/* Header */}
          <View style={eventDetailStyles.header}>
            <TouchableOpacity onPress={onClose} style={eventDetailStyles.closeButton}>
              <X size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={eventDetailStyles.headerTitle}>Event Details</Text>
            <TouchableOpacity 
              onPress={isEditing ? handleSave : () => setIsEditing(true)} 
              style={eventDetailStyles.editButton}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Text style={eventDetailStyles.editButtonText}>
                  {isEditing ? 'Save' : 'Edit'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={eventDetailStyles.content}>
            {/* Title */}
            <View style={eventDetailStyles.field}>
              {isEditing ? (
                <TextInput
                  style={eventDetailStyles.titleInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What's happening?"
                  placeholderTextColor={theme.colors.textMuted}
                  autoFocus={event.id.startsWith('temp-')}
                />
              ) : (
                <Text style={eventDetailStyles.titleDisplay}>{event.title}</Text>
              )}
            </View>

            {/* Time */}
            <View style={eventDetailStyles.field}>
              {isEditing ? (
                <View style={eventDetailStyles.timeEditContainer}>
                  {/* Date Picker */}
                  <TouchableOpacity 
                    style={eventDetailStyles.timeButton}
                    onPress={() => setShowDatePicker(!showDatePicker)}
                    activeOpacity={0.7}>
                    <CalendarIcon size={18} color={theme.colors.textPrimary} />
                    <Text style={eventDetailStyles.timeButtonText}>
                      {safeFormat(startTime, 'EEEE, MMMM d', 'Select date')}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={startTime}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_, date) => handleDateChange(date)}
                      themeVariant="dark"
                      style={Platform.OS === 'ios' ? eventDetailStyles.picker : undefined}
                    />
                  )}

                  {/* Time Range */}
                  <View style={eventDetailStyles.timeRangeContainer}>
                    <TouchableOpacity 
                      style={eventDetailStyles.timeRangeButton}
                      onPress={() => setShowStartTimePicker(!showStartTimePicker)}
                      activeOpacity={0.7}>
                      <Clock size={18} color={theme.colors.textPrimary} />
                      <View style={eventDetailStyles.timeRangeContent}>
                        <Text style={eventDetailStyles.timeRangeLabel}>Starts</Text>
                        <Text style={eventDetailStyles.timeRangeValue}>
                          {safeFormat(startTime, 'h:mm a', 'Select time')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {showStartTimePicker && (
                      <DateTimePicker
                        value={startTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, time) => handleStartTimeChange(time)}
                        themeVariant="dark"
                        style={Platform.OS === 'ios' ? eventDetailStyles.picker : undefined}
                      />
                    )}

                    <TouchableOpacity 
                      style={eventDetailStyles.timeRangeButton}
                      onPress={() => setShowEndTimePicker(!showEndTimePicker)}
                      activeOpacity={0.7}>
                      <Clock size={18} color={theme.colors.textPrimary} />
                      <View style={eventDetailStyles.timeRangeContent}>
                        <Text style={eventDetailStyles.timeRangeLabel}>Ends</Text>
                        <Text style={eventDetailStyles.timeRangeValue}>
                          {safeFormat(endTime, 'h:mm a', 'Select time')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {showEndTimePicker && (
                      <DateTimePicker
                        value={endTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, time) => handleEndTimeChange(time)}
                        themeVariant="dark"
                        style={Platform.OS === 'ios' ? eventDetailStyles.picker : undefined}
                      />
                    )}
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  onPress={() => setIsEditing(true)}
                  style={eventDetailStyles.timeDisplayButton}
                  activeOpacity={0.7}>
                  <Clock size={18} color={theme.colors.accent} />
                  <View style={eventDetailStyles.timeDisplayContent}>
                    <Text style={eventDetailStyles.timeDisplayDate}>
                      {safeFormat(startTime, 'EEEE, MMMM d', '--')}
                    </Text>
                    <Text style={eventDetailStyles.timeDisplayTime}>
                      {safeFormat(startTime, 'h:mm a', '--:--')} - {safeFormat(endTime, 'h:mm a', '--:--')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Location */}
            {event.location && (
              <View style={eventDetailStyles.metaRow}>
                <MapPin size={16} color={theme.colors.textMuted} />
                <Text style={eventDetailStyles.metaText}>{event.location}</Text>
              </View>
            )}

            {/* Meeting Link */}
            {event.meeting_link && (
              <View style={eventDetailStyles.metaRow}>
                <Video size={16} color={theme.colors.accent} />
                <Text style={[eventDetailStyles.metaText, {color: theme.colors.accent}]}>
                  {event.meeting_link}
                </Text>
              </View>
            )}

            {/* Description */}
            <View style={eventDetailStyles.field}>
              {isEditing ? (
                <TextInput
                  style={eventDetailStyles.descriptionInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add notes..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  numberOfLines={4}
                />
              ) : (
                event.description ? (
                  <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.7}>
                    <Text style={eventDetailStyles.descriptionDisplay}>{event.description}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.7}>
                    <Text style={eventDetailStyles.descriptionPlaceholder}>Add notes...</Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            {/* Visibility Toggle */}
            {isEditing && (
              <View style={eventDetailStyles.field}>
                <View style={eventDetailStyles.visibilityContainer}>
                  <TouchableOpacity
                    style={[
                      eventDetailStyles.visibilityButton,
                      visibility === 'workspace' && eventDetailStyles.visibilityButtonActive,
                    ]}
                    onPress={() => setVisibility('workspace')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        eventDetailStyles.visibilityButtonText,
                        visibility === 'workspace' && eventDetailStyles.visibilityButtonTextActive,
                      ]}>
                      Workspace
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      eventDetailStyles.visibilityButton,
                      visibility === 'private' && eventDetailStyles.visibilityButtonActive,
                    ]}
                    onPress={() => setVisibility('private')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        eventDetailStyles.visibilityButtonText,
                        visibility === 'private' && eventDetailStyles.visibilityButtonTextActive,
                      ]}>
                      Me
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={eventDetailStyles.visibilityHint}>
                  {visibility === 'workspace'
                    ? 'Visible to all workspace members'
                    : 'Only visible to you'}
                </Text>
              </View>
            )}

            {/* Calendar Info */}
            {event.calendar_name && (
              <View style={eventDetailStyles.calendarInfo}>
                <View style={[eventDetailStyles.calendarDot, {backgroundColor: event.calendar_color || '#3b82f6'}]} />
                <Text style={eventDetailStyles.calendarName}>{event.calendar_name}</Text>
              </View>
            )}

            {/* Delete button */}
            {!event.google_event_id && (
              <TouchableOpacity
                style={eventDetailStyles.deleteButton}
                onPress={handleDelete}
                disabled={isLoading}>
                <Text style={eventDetailStyles.deleteButtonText}>Delete Event</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const eventDetailStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  closeButton: {
    padding: 4,
  },
  editButton: {
    padding: 4,
  },
  editButtonText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  content: {
    padding: theme.spacing.md,
  },
  field: {
    marginBottom: theme.spacing.xl,
  },
  titleInput: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textPrimary,
    paddingVertical: 4,
  },
  titleDisplay: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.textPrimary,
    lineHeight: 32,
  },
  timeDisplayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  timeDisplayContent: {
    flex: 1,
  },
  timeDisplayDate: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  timeDisplayTime: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
  },
  descriptionInput: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    paddingVertical: 8,
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  descriptionDisplay: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    lineHeight: 22,
    paddingVertical: 4,
  },
  descriptionPlaceholder: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  calendarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginTop: theme.spacing.md,
  },
  calendarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calendarName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
  },
  visibilityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  visibilityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  visibilityButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  visibilityButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
  },
  visibilityButtonTextActive: {
    color: theme.colors.accentText || '#000',
  },
  visibilityHint: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    marginBottom: theme.spacing.sm,
  },
  metaText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  deleteButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  // Time editing styles
  timeEditContainer: {
    gap: 16,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  timeButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
  },
  timeRangeContainer: {
    gap: 12,
    paddingLeft: 30, // Align with date picker icon
  },
  timeRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  timeRangeContent: {
    flex: 1,
  },
  timeRangeLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  timeRangeValue: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  picker: {
    height: 150,
    marginTop: -8,
    marginBottom: -8,
  },
});

// ===== MAIN STYLES =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Show wave background
  },
  contentContainer: {
    flex: 1,
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.accent,
    backgroundColor: 'rgba(255, 199, 0, 0.05)',
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  tabTextActive: {
    color: theme.colors.accent,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  tabBadgeActive: {
    backgroundColor: theme.colors.accent,
  },
  tabBadgeText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
  },
  tabBadgeTextActive: {
    color: theme.colors.accentText,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  focusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 0, // Sharp edges - on brand
  },
  focusButtonText: {
    color: '#000',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 1,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  todayButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  todayButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: theme.spacing.sm,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  dateDisplayFullWidth: {
    flex: 1,
    justifyContent: 'center',
  },
  dateText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    minHeight: TOTAL_HOURS * PX_PER_HOUR + 400, // Ensure enough height for all hours + padding
    paddingBottom: 200, // Extra padding at bottom for events after 11 PM
  },
  calendarScrollContent: {
    paddingBottom: 120,
  },
  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryCount: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontFamily.bold,
  },
  summaryCountMuted: {
    color: theme.colors.textMuted,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
  },
  // Skeleton
  skeletonContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  skeletonSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.xl,
  },
  skeletonSummaryItem: {
    alignItems: 'center',
  },
  skeletonCount: {
    width: 30,
    height: 24,
    backgroundColor: theme.colors.surfaceElevated,
    marginBottom: 4,
  },
  skeletonLabel: {
    width: 50,
    height: 10,
    backgroundColor: theme.colors.surfaceElevated,
  },
  skeletonTimeline: {
    height: TOTAL_HOURS * PX_PER_HOUR,
    position: 'relative',
  },
  skeletonEvent: {
    position: 'absolute',
    left: HOUR_LABEL_WIDTH,
    right: theme.spacing.md,
    height: 60,
  },
  skeletonEventContent: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.border,
  },
  // All-day section
  allDaySection: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  allDayLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  allDayCard: {
    borderLeftWidth: 4,
    paddingLeft: 8,
    paddingRight: 4,
    paddingTop: 2,
    paddingBottom: 2,
    marginBottom: theme.spacing.xs,
  },
  allDayTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    lineHeight: 14,
  },
  allDayDeadlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderRadius: 4,
    gap: 8,
  },
  allDayDeadlineTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
    flex: 1,
  },
  deadlineIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalBadge: {
    backgroundColor: 'rgba(22,163,74,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  finalBadgeText: {
    color: '#22c55e',
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  // Tasks tab content
  tasksTabContent: {
    paddingVertical: theme.spacing.md,
    paddingBottom: 200, // Extra space for NextEventBar + floating tab bar
  },
  taskCategorySection: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  taskCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  taskCategoryLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
    flex: 1,
  },
  taskCategoryCount: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    minWidth: 24,
    textAlign: 'right',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
    overflow: 'hidden',
  },
  taskCardCompleted: {
    opacity: 0.5,
  },
  taskOverdueIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.colors.error,
  },
  taskInProgressIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.colors.accent,
  },
  taskCheckbox: {
    width: 24,
    alignItems: 'center',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  taskMetaText: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  taskStatusLabel: {
    color: theme.colors.accent,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    marginLeft: 8,
  },
  // Timeline
  timelineContainer: {
    paddingLeft: 4, // Reduced padding-left
    paddingRight: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: 300, // Extra space for events after 11 PM + NextEventBar + floating tab bar
  },
  timeline: {
    height: TOTAL_HOURS * PX_PER_HOUR,
    position: 'relative',
  },
  timelineInner: {
    flex: 1,
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: HOUR_LABEL_WIDTH - 8,
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    textAlign: 'right',
    marginRight: 8,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.divider,
    marginTop: 6,
  },
  eventsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Scheduled task card
  scheduledTaskCard: {
    position: 'absolute',
    backgroundColor: 'rgba(39, 39, 42, 0.8)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent,
    borderRadius: 6,
    padding: theme.spacing.sm,
    overflow: 'hidden',
  },
  scheduledTaskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduledTaskCompleted: {
    borderLeftColor: theme.colors.success,
    backgroundColor: theme.colors.successBackground,
  },
  scheduledTaskTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semibold,
    flex: 1,
  },
  scheduledTaskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  scheduledTaskTime: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontFamily: theme.typography.fontFamily.medium,
  },
  // Event card
  eventCardContainer: {
    position: 'absolute',
  },
  eventCard: {
    flex: 1,
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
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventMetaText: {
    color: theme.colors.textMuted,
    fontSize: 9,
  },
  // Deadline indicator
  deadlineContainer: {
    position: 'absolute',
    left: HOUR_LABEL_WIDTH,
    right: 0,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 25,
  },
  deadlineLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.8,
  },
  deadlineLabel: {
    position: 'absolute',
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
    maxWidth: TIMELINE_WIDTH * 0.5,
  },
  deadlineLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    flexShrink: 1,
  },
  deadlineTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
  },
  // Blocked time card
  blockedTimeCard: {
    position: 'absolute',
    borderLeftWidth: 3,
    padding: theme.spacing.xs,
    justifyContent: 'center',
    opacity: 0.8,
  },
  blockedTimeTitle: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.5,
  },
  // Current time indicator
  currentTimeIndicator: {
    position: 'absolute',
    left: HOUR_LABEL_WIDTH,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    marginLeft: -4,
  },
  currentTimeLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.error,
  },
  // Scroll indicators
  scrollIndicatorTop: {
    position: 'absolute',
    top: 8,
    left: HOUR_LABEL_WIDTH + 8,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
    zIndex: 100,
  },
  scrollIndicatorBottom: {
    position: 'absolute',
    bottom: 100,
    left: HOUR_LABEL_WIDTH + 8,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
    zIndex: 100,
  },
  scrollIndicatorText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderHover,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  // Next Event Bar
  nextEventContainer: {
    position: 'absolute',
    bottom: 90, // Above the floating tab bar
    left: 0,
    right: 0,
  },
  nextEventGradient: {
    position: 'absolute',
    bottom: -90, // Extend gradient down to cover tab bar area
    left: 0,
    right: 0,
    height: 180,
  },
  nextEventBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    paddingRight: theme.spacing.md,
    paddingLeft: theme.spacing.md + 4, // Account for accent bar
    overflow: 'hidden',
  },
  nextEventAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  nextEventContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  nextEventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  nextEventLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  nextEventDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.textMuted,
    marginHorizontal: 6,
  },
  nextEventTimeLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
  },
  nextEventTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  nextEventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextEventCountdown: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
  },
  // Imports Popup
});