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

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
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
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedule' | 'tasks'>('schedule');
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(SCREEN_HEIGHT - 300);
  const pendingScrollToTime = useRef<string | null>(null);
  const hasScrolledToCurrentTime = useRef(false);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle scroll to time when viewport height is available
  const performScrollToTime = useCallback((timeString: string) => {
    if (!scrollViewRef.current || viewportHeight <= 0) return;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;
    
    // Calculate scroll position using PX_PER_HOUR constant (matches how calendar renders)
    // Hour position: (hour - START_HOUR) * PX_PER_HOUR
    const hourPosition = (hours - START_HOUR) * PX_PER_HOUR;
    // Minutes offset: (minutes / 60) * PX_PER_HOUR
    const minutesOffset = (minutes / 60) * PX_PER_HOUR;
    // Event position in the timeline
    const eventPosition = hourPosition + minutesOffset;
    // Center the event vertically: scroll so event is at middle of viewport
    const scrollPosition = eventPosition - (viewportHeight / 2);
    
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, scrollPosition),
        animated: true,
      });
    }, 100);
  }, [viewportHeight]);

  // Handle navigation params to set date and scroll to time
  useFocusEffect(
    useCallback(() => {
      const params = route.params as {date?: string; scrollToTime?: string} | undefined;
      if (params?.date) {
        const date = new Date(params.date);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
        }
      }
      if (params?.scrollToTime) {
        // Store the scrollToTime to perform after layout completes
        pendingScrollToTime.current = params.scrollToTime;
        // Clear params immediately
        navigation.setParams({date: undefined, scrollToTime: undefined});
      } else if (params?.date) {
        // Clear date param if no scrollToTime
        navigation.setParams({date: undefined});
      } else if (!hasScrolledToCurrentTime.current) {
        // No params and haven't done initial scroll - scroll to current time if viewing today
        const now = new Date();
        if (isToday(selectedDate)) {
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          pendingScrollToTime.current = currentTime;
          hasScrolledToCurrentTime.current = true;
        }
      }
    }, [route.params, navigation, selectedDate])
  );

  // Perform scroll when viewport height is available and we have a pending scroll
  useEffect(() => {
    if (pendingScrollToTime.current && viewportHeight > 0) {
      performScrollToTime(pendingScrollToTime.current);
      pendingScrollToTime.current = null;
    }
  }, [viewportHeight, performScrollToTime]);

  // Swipe animation
  const panX = useRef(new Animated.Value(0)).current;
  const swipeDirection = useRef<'left' | 'right' | null>(null);

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

  // State for event editing
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);

  // Filter data for selected date
  const todosForDay = useMemo(
    () => filterTodosForDate(todos, selectedDate),
    [todos, selectedDate],
  );

  const scheduledTasksForDay = useMemo(
    () => filterScheduledTasksForDate(scheduledTasks, selectedDate),
    [scheduledTasks, selectedDate],
  );

  const blockedTimesForDay = useMemo(
    () => filterBlockedTimesForDate(blockedTimes, selectedDate),
    [blockedTimes, selectedDate],
  );

  const deadlinesForDay = useMemo(
    () => filterDeadlinesForDate(deadlines, selectedDate),
    [deadlines, selectedDate],
  );

  // Separate deadlines into all-day (no time or end-of-day) and timed
  const {allDayDeadlines, timedDeadlines} = useMemo(() => {
    const allDay: Deadline[] = [];
    const timed: Deadline[] = [];
    
    deadlinesForDay.forEach(deadline => {
      // If no due_time, or time is 23:59, show as all-day deadline at top
      if (!deadline.due_time || deadline.due_time.startsWith('23:')) {
        allDay.push(deadline);
      } else {
        timed.push(deadline);
      }
    });
    
    return {allDayDeadlines: allDay, timedDeadlines: timed};
  }, [deadlinesForDay]);

  const {timedEvents, allDayEvents} = useMemo(
    () => separateEventsByType(calendarEvents, selectedDate),
    [calendarEvents, selectedDate],
  );

  // Calculate collision positions for overlapping events (split evenly)
  const eventPositions = useMemo(() => {
    const positions = new Map<string, {left: number; width: number}>();
    
    if (timedEvents.length === 0) return positions;
    
    // Sort events by start time, then by end time
    const sortedEvents = [...timedEvents].sort((a, b) => {
      const aStart = new Date(a.start_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      if (aStart !== bStart) return aStart - bStart;
      const aEnd = new Date(a.end_time).getTime();
      const bEnd = new Date(b.end_time).getTime();
      return aEnd - bEnd;
    });

    // Group overlapping events using a more robust algorithm
    const groups: CalendarEvent[][] = [];
    const eventToGroup = new Map<string, number>();
    
    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      const eventStart = new Date(event.start_time).getTime();
      const eventEnd = new Date(event.end_time).getTime();
      
      // Find all groups this event overlaps with
      const overlappingGroupIndices = new Set<number>();
      for (let j = 0; j < i; j++) {
        const prevEvent = sortedEvents[j];
        const prevStart = new Date(prevEvent.start_time).getTime();
        const prevEnd = new Date(prevEvent.end_time).getTime();
        
        // Check if events overlap
        if (!(eventEnd <= prevStart || eventStart >= prevEnd)) {
          const prevGroupIndex = eventToGroup.get(prevEvent.id);
          if (prevGroupIndex !== undefined) {
            overlappingGroupIndices.add(prevGroupIndex);
          }
        }
      }
      
      if (overlappingGroupIndices.size === 0) {
        // No overlap - create new group
        const newGroupIndex = groups.length;
        groups.push([event]);
        eventToGroup.set(event.id, newGroupIndex);
      } else {
        // Merge all overlapping groups into one
        const groupIndices = Array.from(overlappingGroupIndices).sort((a, b) => b - a);
        const targetGroupIndex = groupIndices[groupIndices.length - 1];
        const targetGroup = groups[targetGroupIndex];
        
        // Merge other groups into target group
        for (let k = groupIndices.length - 2; k >= 0; k--) {
          const mergeIndex = groupIndices[k];
          const mergeGroup = groups[mergeIndex];
          mergeGroup.forEach(e => {
            targetGroup.push(e);
            eventToGroup.set(e.id, targetGroupIndex);
          });
          groups.splice(mergeIndex, 1);
          // Update indices for events in groups after the merged one
          eventToGroup.forEach((groupIdx, eventId) => {
            if (groupIdx > mergeIndex) {
              eventToGroup.set(eventId, groupIdx - 1);
            }
          });
        }
        
        // Add current event to target group
        targetGroup.push(event);
        eventToGroup.set(event.id, targetGroupIndex);
      }
    }

    // Calculate positions for each group
    const timelineStart = HOUR_LABEL_WIDTH + 4; // Reduced padding
    const timelineEnd = SCREEN_WIDTH - 16;
    const availableWidth = timelineEnd - timelineStart;

    for (const group of groups) {
      if (group.length === 1) {
        // Single event - full width
        positions.set(group[0].id, {
          left: timelineStart,
          width: availableWidth,
        });
      } else {
        // Multiple overlapping events - split evenly (50/50 for 2, 33/33/33 for 3, etc.)
        const eventWidth = availableWidth / group.length;
        group.forEach((event, index) => {
          positions.set(event.id, {
            left: timelineStart + (index * eventWidth),
            width: eventWidth,
          });
        });
      }
    }

    return positions;
  }, [timedEvents]);

  // Calculate off-screen events for scroll indicators
  const {eventsAbove, eventsBelow} = useMemo(() => {
    const allItems = [
      ...timedEvents.map(e => ({
        title: e.title,
        startHour: new Date(e.start_time).getHours() + new Date(e.start_time).getMinutes() / 60,
      })),
      ...scheduledTasksForDay.map(t => ({
        title: t.title,
        startHour: new Date(t.scheduled_start).getHours() + new Date(t.scheduled_start).getMinutes() / 60,
      })),
    ];

    const visibleTopHour = scrollY / PX_PER_HOUR;
    const visibleBottomHour = (scrollY + viewportHeight) / PX_PER_HOUR;

    const above = allItems.filter(item => item.startHour < visibleTopHour);
    const below = allItems.filter(item => item.startHour > visibleBottomHour);

    return {eventsAbove: above.length, eventsBelow: below.length};
  }, [timedEvents, scheduledTasksForDay, scrollY, viewportHeight]);

  const {overdueTodos, pendingTodos, inProgressTodos, completedTodos} = useMemo(() => splitTodosByStatus(todos), [todos]);

  // Handle tab switching with animation
  const handleTabChange = useCallback((tab: 'schedule' | 'tasks') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  }, []);

  // Active task for Focus Mode - use first in-progress todo
  const activeTask = useMemo(() => todos.find(t => t.status === 'in_progress') || null, [todos]);

  // Pan responder for swipe gestures
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30;
        },
        onPanResponderGrant: () => {
          swipeDirection.current = null;
        },
        onPanResponderMove: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
            panX.setValue(gestureState.dx);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > SWIPE_THRESHOLD) {
            // Swipe right - go to previous day
            Animated.timing(panX, {
              toValue: SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              setSelectedDate(prev => subDays(prev, 1));
              panX.setValue(0);
            });
          } else if (gestureState.dx < -SWIPE_THRESHOLD) {
            // Swipe left - go to next day
            Animated.timing(panX, {
              toValue: -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              setSelectedDate(prev => addDays(prev, 1));
              panX.setValue(0);
            });
          } else {
            // Snap back
            Animated.spring(panX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 10,
            }).start();
          }
        },
      }),
    [panX],
  );

  // Navigation
  const goToPreviousDay = useCallback(() => {
    setSelectedDate(prev => subDays(prev, 1));
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate(prev => addDays(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setShowMonthPicker(false);
  }, []);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  // Date display
  const dateDisplay = useMemo(() => {
    if (isToday(selectedDate)) {
      return 'TODAY';
    }
    return safeFormat(selectedDate, 'EEE, MMM d', 'SELECT DATE').toUpperCase();
  }, [selectedDate]);

  // Check if there's any content for the day (schedule tab)
  const hasScheduleContent =
    scheduledTasksForDay.length > 0 ||
    timedEvents.length > 0 ||
    allDayEvents.length > 0 ||
    blockedTimesForDay.length > 0;

  // Check if there are any tasks
  const hasTasksContent = 
    pendingTodos.length > 0 || 
    inProgressTodos.length > 0 ||
    completedTodos.length > 0;

  // Open tasks count for the tab badge (only show open, not completed)
  const openTasksCount = pendingTodos.length + inProgressTodos.length;

  // Find the next upcoming event or scheduled task
  const nextUpcoming = useMemo(() => {
    const now = new Date();
    
    // Collect all upcoming items
    const upcomingItems: Array<{
      type: 'event' | 'scheduled_task';
      title: string;
      startTime: Date;
      endTime: Date;
      color?: string;
      location?: string | null;
      meetingLink?: string | null;
    }> = [];

    // Add calendar events
    calendarEvents.forEach(event => {
      try {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        if (isValid(start) && start > now) {
          upcomingItems.push({
            type: 'event',
            title: event.title,
            startTime: start,
            endTime: end,
            color: event.calendar_color || '#3b82f6',
            location: event.location,
            meetingLink: event.meeting_link,
          });
        }
      } catch {}
    });

    // Add scheduled tasks
    scheduledTasks.forEach(task => {
      try {
        const start = new Date(task.scheduled_start);
        const end = new Date(task.scheduled_end);
        if (isValid(start) && start > now && task.status !== 'completed') {
          upcomingItems.push({
            type: 'scheduled_task',
            title: task.title,
            startTime: start,
            endTime: end,
          });
        }
      } catch {}
    });

    // Sort by start time and return the first one
    upcomingItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return upcomingItems[0] || null;
  }, [calendarEvents, scheduledTasks]);

  // Handle navigation to next event
  const handleNextEventPress = useCallback(() => {
    if (!nextUpcoming) return;

    // Switch to schedule tab
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab('schedule');

    // Navigate to the event's date
    setSelectedDate(nextUpcoming.startTime);

    // Calculate scroll position based on event start time
    const eventHour = nextUpcoming.startTime.getHours() + nextUpcoming.startTime.getMinutes() / 60;
    const scrollPosition = Math.max(0, (eventHour - START_HOUR - 1) * PX_PER_HOUR); // -1 hour offset to show context

    // Delay scroll slightly to allow date change to render
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: scrollPosition,
        animated: true,
      });
    }, 100);
  }, [nextUpcoming]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.sectionLabel}>CALENDAR</Text>
          <View style={styles.headerActions}>
            {!isToday(selectedDate) && (
              <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
                <Text style={styles.todayButtonText}>TODAY</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Date Navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={goToPreviousDay}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <ChevronLeft size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateDisplay}
            onPress={() => setShowMonthPicker(true)}>
            <CalendarIcon size={16} color={theme.colors.textMuted} />
            <Text style={styles.dateText}>{dateDisplay}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={goToNextDay}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <ChevronRight size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'schedule' && styles.tabActive]}
          onPress={() => handleTabChange('schedule')}
          activeOpacity={0.7}>
          <CalendarIcon 
            size={16} 
            color={activeTab === 'schedule' ? theme.colors.accent : theme.colors.textMuted} 
          />
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>
            SCHEDULE
          </Text>
          {(scheduledTasksForDay.length + timedEvents.length) > 0 && (
            <View style={[styles.tabBadge, activeTab === 'schedule' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'schedule' && styles.tabBadgeTextActive]}>
                {scheduledTasksForDay.length + timedEvents.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tasks' && styles.tabActive]}
          onPress={() => handleTabChange('tasks')}
          activeOpacity={0.7}>
          <ListChecks 
            size={16} 
            color={activeTab === 'tasks' ? theme.colors.accent : theme.colors.textMuted} 
          />
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>
            TASKS
          </Text>
          {openTasksCount > 0 && (
            <View style={[
              styles.tabBadge, 
              activeTab === 'tasks' && styles.tabBadgeActive,
            ]}>
              <Text style={[
                styles.tabBadgeText, 
                activeTab === 'tasks' && styles.tabBadgeTextActive,
              ]}>
                {openTasksCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Swipeable content */}
      <Animated.View
        style={[styles.contentContainer, {transform: [{translateX: panX}]}]}
        {...panResponder.panHandlers}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
          onLayout={(e) => {
            const height = e.nativeEvent.layout.height;
            setViewportHeight(height);
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.textPrimary}
            />
          }>
          {/* Loading skeleton or content */}
          {loading && !isRefreshing ? (
            <TimelineSkeleton />
          ) : (
            <>
              {/* SCHEDULE TAB CONTENT */}
              {activeTab === 'schedule' && (
                <>
                  {/* All-day events & deadlines section */}
                  {(allDayEvents.length > 0 || allDayDeadlines.length > 0) && (
                    <View style={styles.allDaySection}>
                      {allDayDeadlines.length > 0 && (
                        <>
                          <Text style={styles.allDayLabel}>DEADLINES</Text>
                          {allDayDeadlines.map(deadline => (
                            <AllDayDeadlineCard key={deadline.id} deadline={deadline} />
                          ))}
                        </>
                      )}
                      {allDayEvents.length > 0 && (
                        <>
                          <Text style={styles.allDayLabel}>ALL DAY</Text>
                          {allDayEvents.map(event => (
                            <AllDayEventCard key={event.id} event={event} />
                          ))}
                        </>
                      )}
                    </View>
                  )}

                  {/* Timeline */}
                  <View style={styles.timelineContainer}>
                    <Pressable
                      style={styles.timeline}
                      onLongPress={(e) => {
                        // Calculate which hour was long-pressed
                        // locationY is relative to the Pressable (timeline), which starts at 0
                        // Hour markers are positioned absolutely at: (hour - START_HOUR) * PX_PER_HOUR
                        // So hour 0 (START_HOUR) is at position 0, hour 1 is at PX_PER_HOUR, etc.
                        // locationY directly tells us the position within the timeline content
                        const locationY = e.nativeEvent.locationY;
                        
                        // Calculate which hour was pressed based on position
                        // locationY / PX_PER_HOUR gives us the hour offset from START_HOUR
                        const hourOffset = locationY / PX_PER_HOUR;
                        const hour = Math.floor(hourOffset) + START_HOUR;
                        const clampedHour = Math.max(START_HOUR, Math.min(END_HOUR - 1, hour));
                        
                        // Create new event at this hour in local time
                        // Get the date components from selectedDate (which is in local time)
                        const year = selectedDate.getFullYear();
                        const month = selectedDate.getMonth();
                        const day = selectedDate.getDate();
                        
                        // Create dates in local timezone using the Date constructor
                        // This ensures the hour is interpreted as local time, not UTC
                        const eventDate = new Date(year, month, day, clampedHour, 0, 0, 0);
                        const endDate = new Date(year, month, day, clampedHour + 1, 0, 0, 0);
                        
                        // Verify the date was created correctly
                        const actualHour = eventDate.getHours();
                        if (actualHour !== clampedHour) {
                          console.warn('Date hour mismatch:', {
                            locationY,
                            hourOffset,
                            calculatedHour: hour,
                            clampedHour,
                            actualHour,
                          });
                        }
                        
                        const newEvent: CalendarEvent = {
                          id: `temp-${Date.now()}`,
                          title: '',
                          description: '',
                          start_time: eventDate.toISOString(),
                          end_time: endDate.toISOString(),
                          is_all_day: false,
                          source_type: 'posthive',
                          calendar_name: 'PostHive',
                          calendar_color: theme.colors.accent,
                          created_by: user?.id || '',
                          workspace_id: currentWorkspace?.id || '',
                          visibility: 'workspace',
                        };
                        
                        setSelectedEvent(newEvent);
                        setShowEventDetail(true);
                      }}
                    >
                      <View style={styles.timelineInner}>
                      {/* Hour markers */}
                      {Array.from({length: TOTAL_HOURS}, (_, i) => i + START_HOUR).map(
                        hour => (
                          <View
                            key={hour}
                            style={[
                              styles.hourRow,
                              {top: (hour - START_HOUR) * PX_PER_HOUR},
                            ]}>
                            <Text style={styles.hourLabel}>
                              {safeFormat(new Date(2024, 0, 1, hour, 0), 'h a', `${hour}:00`)}
                            </Text>
                            <View style={styles.hourLine} />
                          </View>
                        ),
                      )}

                      {/* Events layer */}
                      <View style={styles.eventsContainer}>
                        {/* Blocked times */}
                        {blockedTimesForDay.map(blocked => (
                          <BlockedTimeCard key={blocked.id} blocked={blocked} />
                        ))}

                        {/* Scheduled tasks */}
                        {scheduledTasksForDay.map(task => (
                          <ScheduledTaskCard key={task.id} task={task} />
                        ))}

                        {/* Calendar events */}
                        {timedEvents.map(event => {
                          const position = eventPositions.get(event.id);
                          return (
                            <EventCard 
                              key={event.id} 
                              event={event}
                              collisionPosition={position}
                              onPress={() => {
                                setSelectedEvent(event);
                                setShowEventDetail(true);
                              }}
                            />
                          );
                        })}

                        {/* Deadline indicators (only timed deadlines, all-day shown at top) */}
                        {timedDeadlines.map(deadline => (
                          <DeadlineIndicator key={deadline.id} deadline={deadline} />
                        ))}

                        {/* Current time indicator */}
                        {isToday(selectedDate) && <CurrentTimeIndicator />}
                      </View>
                      </View>
                    </Pressable>
                  </View>

                  {/* Scroll indicators for off-screen events */}
                  {eventsAbove > 0 && (
                    <TouchableOpacity 
                      style={styles.scrollIndicatorTop}
                      onPress={() => scrollViewRef.current?.scrollTo({y: 0, animated: true})}>
                      <ChevronUp size={16} color={theme.colors.accent} />
                      <Text style={styles.scrollIndicatorText}>{eventsAbove} above</Text>
                    </TouchableOpacity>
                  )}
                  {eventsBelow > 0 && (
                    <TouchableOpacity 
                      style={styles.scrollIndicatorBottom}
                      onPress={() => scrollViewRef.current?.scrollToEnd({animated: true})}>
                      <Text style={styles.scrollIndicatorText}>{eventsBelow} below</Text>
                      <ChevronDown size={16} color={theme.colors.accent} />
                    </TouchableOpacity>
                  )}

                  {/* Empty state for schedule */}
                  {!hasScheduleContent && (
                    <View style={styles.emptyState}>
                      <CalendarIcon size={40} color={theme.colors.textMuted} />
                      <Text style={styles.emptyTitle}>NO EVENTS</Text>
                      <Text style={styles.emptySubtitle}>
                        Your schedule is clear for this day
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* TASKS TAB CONTENT */}
              {activeTab === 'tasks' && (
                <View style={styles.tasksTabContent}>
                  {/* Open Tasks (pending + in_progress) */}
                  {(pendingTodos.length > 0 || inProgressTodos.length > 0) && (
                    <View style={styles.taskCategorySection}>
                      <View style={styles.taskCategoryHeader}>
                        <Text style={styles.taskCategoryLabel}>OPEN</Text>
                        <Text style={styles.taskCategoryCount}>
                          {pendingTodos.length + inProgressTodos.length}
                        </Text>
                      </View>
                      {inProgressTodos.map(todo => (
                        <TaskCard 
                          key={todo.id} 
                          todo={todo} 
                          isOverdue={overdueTodos.some(t => t.id === todo.id)}
                        />
                      ))}
                      {pendingTodos.map(todo => (
                        <TaskCard 
                          key={todo.id} 
                          todo={todo} 
                          isOverdue={overdueTodos.some(t => t.id === todo.id)}
                        />
                      ))}
                    </View>
                  )}

                  {/* Completed Tasks */}
                  {completedTodos.length > 0 && (
                    <View style={styles.taskCategorySection}>
                      <View style={styles.taskCategoryHeader}>
                        <Text style={styles.taskCategoryLabel}>COMPLETED</Text>
                        <Text style={styles.taskCategoryCount}>{completedTodos.length}</Text>
                      </View>
                      {completedTodos.map(todo => (
                        <TaskCard key={todo.id} todo={todo} />
                      ))}
                    </View>
                  )}

                  {/* Empty state for tasks */}
                  {!hasTasksContent && (
                    <View style={styles.emptyState}>
                      <ListChecks size={40} color={theme.colors.textMuted} />
                      <Text style={styles.emptyTitle}>NO TASKS</Text>
                      <Text style={styles.emptySubtitle}>
                        No tasks to show
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Next Event Bar - Fixed at bottom */}
      {nextUpcoming && (
        <NextEventBar 
          item={nextUpcoming}
          onPress={handleNextEventPress}
        />
      )}



      {/* Month Picker Modal */}
      <MonthPickerModal
        visible={showMonthPicker}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        onClose={() => setShowMonthPicker(false)}
        todos={todos}
        scheduledTasks={scheduledTasks}
        calendarEvents={calendarEvents}
      />

      {/* Focus Mode Modal */}
      <FocusModeModal
        visible={showFocusMode}
        task={activeTask}
        onClose={() => setShowFocusMode(false)}
        onComplete={async () => {
          if (activeTask && user?.id) {
            await updateTodoStatus(activeTask.id, 'completed', user.id);
            await refresh();
          }
        }}
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
    try {
      if (!isValid(viewDate)) {
        return [];
      }
      const monthStart = startOfMonth(viewDate);
      const monthEnd = endOfMonth(viewDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);
      return eachDayOfInterval({start: calendarStart, end: calendarEnd});
    } catch {
      return [];
    }
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
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
              <Text key={day} style={monthPickerStyles.weekDayLabel}>
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