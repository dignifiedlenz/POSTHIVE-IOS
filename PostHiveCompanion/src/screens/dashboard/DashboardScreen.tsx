import React, {useCallback, useState, useMemo, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation, useFocusEffect, CompositeNavigationProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {ChevronRight, CheckSquare, Check, Plus, Bell, CheckCheck, X, Calendar, MapPin, Video as VideoIcon, Edit2, Save, Clock, Camera, CheckCircle} from 'lucide-react-native';
import {format, isToday, isTomorrow, parseISO} from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Platform, TextInput} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import Video from 'react-native-video';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {useDeliverables} from '../../hooks/useDeliverables';
import {useTodos} from '../../hooks/useTodos';
import {useNotifications} from '../../hooks/useNotifications';
import {useCalendarDayData} from '../../hooks/useCalendarDayData';
import {useWidgetSync} from '../../hooks/useWidgetSync';
import {TodoItem} from '../../components/TodoItem';
import {NotificationItem} from '../../components/NotificationItem';
import {capitalizeFirst, canAccessWorkspaceNotifications} from '../../lib/utils';
import {VoiceCommandModal} from '../../components/VoiceCommandModal';
import {Deliverable, Todo, Notification, CalendarEvent} from '../../lib/types';
import {DashboardStackParamList} from '../../app/App';
import {updateTodo, markDeliverableAsFinal, getDeliverable} from '../../lib/api';
import {CongratulationsModal} from '../../components/CongratulationsModal';
import {BrandedLoadingScreen} from '../../components/BrandedLoadingScreen';
import {useTabBar} from '../../contexts/TabBarContext';
import type {MainTabParamList} from '../../app/App';

type NavigationProp = CompositeNavigationProp<
  StackNavigationProp<DashboardStackParamList, 'Dashboard'>,
  BottomTabNavigationProp<MainTabParamList>
>;
const DEFAULT_THUMBNAIL = 'https://www.posthive.app/thumbnail/default.png';

export function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const {pendingOpenCreateTodo, setPendingOpenCreateTodo} = useTabBar();
  const insets = useSafeAreaInsets();
  // The dashboard renders inside `mainPagerContent` which has `paddingTop = insets.top + 64`
  // (see AuthenticatedChrome / MAIN_FLOATING_TOP_BAR_EXTRA in App.tsx). To make the blurred
  // hero backdrop cover the WHOLE screen — including under the floating top bar and status
  // bar — we extend it upward by the same amount via a negative top offset.
  const heroBackdropTopOffset = -(insets.top + 64);

  useFocusEffect(
    useCallback(() => {
      if (pendingOpenCreateTodo) {
        setPendingOpenCreateTodo(false);
        navigation.navigate('CreateTodo');
      }
    }, [pendingOpenCreateTodo, setPendingOpenCreateTodo, navigation]),
  );

  const sectionAnimations = useRef([
    new Animated.Value(0), // Calendar / next up
    new Animated.Value(0), // Tasks
    new Animated.Value(0), // Deadlines
  ]).current;

  const {user, currentWorkspace} = useAuth();
  const workspaceNotificationsEnabled = canAccessWorkspaceNotifications(
    currentWorkspace?.role,
  );

  // Time-of-day greeting + best-effort first name pulled from Supabase auth metadata.
  // Falls back to the local-part of the email so we never render an empty name.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 22) return 'Good evening';
    return 'Good night';
  }, []);
  const firstName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const candidates: Array<unknown> = [
      meta.first_name,
      meta.given_name,
      typeof meta.full_name === 'string' ? meta.full_name.split(' ')[0] : undefined,
      typeof meta.name === 'string' ? meta.name.split(' ')[0] : undefined,
      typeof user?.email === 'string' ? user.email.split('@')[0] : undefined,
    ];
    const raw = candidates.find(v => typeof v === 'string' && v.trim().length > 0) as
      | string
      | undefined;
    if (!raw) return '';
    const cleaned = raw.replace(/[._-]+/g, ' ').trim();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }, [user]);
  const {deliverables, isLoading: deliverablesLoading, isRefreshing: deliverablesRefreshing, refresh: refreshDeliverables} = useDeliverables({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });
  
  const {
    pendingTodos,
    inProgressTodos,
    todos,
    isLoading: todosLoading,
    isRefreshing: todosRefreshing,
    refresh: refreshTodos,
    toggleStatus,
  } = useTodos({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  // Notifications
  const {
    notifications,
    unreadCount,
    markSeen,
    markAllSeen,
  } = useNotifications({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
    enabled: workspaceNotificationsEnabled,
  });

  const {calendarEvents, refresh: refreshCalendar} = useCalendarDayData({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  // Handle deep link to open notifications
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Check if we should open notifications (from deep link)
      const state = navigation.getState();
      const route = state?.routes[state.index];
      const params = route?.params as {openNotifications?: boolean} | undefined;
      
      if (params?.openNotifications) {
        if (!workspaceNotificationsEnabled) {
          navigation.setParams({openNotifications: undefined});
          return;
        }
        // Small delay to ensure screen is fully mounted
        setTimeout(() => {
          setShowNotifications(true);
          // Clear the param so it doesn't reopen on next focus
          navigation.setParams({openNotifications: undefined});
        }, 300);
      }
    });

    return unsubscribe;
  }, [navigation, workspaceNotificationsEnabled]);

  // Refresh data and scroll to top when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Scroll to top when navigating back to this tab
      scrollViewRef.current?.scrollTo({y: 0, animated: false});
      
      // Trigger staggered entrance animations
      sectionAnimations.forEach(anim => anim.setValue(0));
      const staggeredAnimations = sectionAnimations.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 350,
          delay: 50 + index * 80,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        })
      );
      Animated.parallel(staggeredAnimations).start();
      
      // Only refresh if we already have data loaded (skip initial load)
      if (!todosLoading && !deliverablesLoading) {
        refreshTodos();
        refreshDeliverables();
        refreshCalendar();
      }
    }, [
      refreshTodos,
      refreshDeliverables,
      refreshCalendar,
      todosLoading,
      deliverablesLoading,
    ])
  );

  // Animation states for tasks
  const [completingTodoId, setCompletingTodoId] = useState<string | null>(null);
  const [animatingTodo, setAnimatingTodo] = useState<Todo | null>(null);
  const [animatingTodoIndex, setAnimatingTodoIndex] = useState<number | null>(null);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(new Set());
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showVoiceCommand, setShowVoiceCommand] = useState(false);
  const [showCongratulations, setShowCongratulations] = useState(false);
  // Keep hook ordering stable during Fast Refresh after removing the
  // dashboard-level workspace picker UI.
  const workspaceDropdownRefreshState = useState(false);
  void workspaceDropdownRefreshState;
  const [completedTodoTitle, setCompletedTodoTitle] = useState<string | null>(null);
  const [finalizingDeliverableId, setFinalizingDeliverableId] = useState<string | null>(null);

  // Combine all active todos, including ones that are animating to completion
  const allTodos = useMemo(() => {
    const sortedActive = [...pendingTodos, ...inProgressTodos].sort((a, b) => {
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

    if (!animatingTodo) return sortedActive;

    // Keep a stable "slot" for the animating todo so other rows don't jump.
    const base = sortedActive.filter(t => t.id !== animatingTodo.id);
    const insertAt = Math.max(
      0,
      Math.min(
        animatingTodoIndex ?? sortedActive.findIndex(t => t.id === animatingTodo.id),
        base.length,
      ),
    );

    const animatingCompleted = {
      ...animatingTodo,
      status: 'completed' as const,
    };

    return [...base.slice(0, insertAt), animatingCompleted, ...base.slice(insertAt)];
  }, [pendingTodos, inProgressTodos, animatingTodo, animatingTodoIndex]);

  // Map notifications to widget activities
  const widgetActivities = useMemo(() => {
    return notifications.slice(0, 20).map(notification => {
      // Map notification type to activity type
      const typeMap: Record<string, 'upload' | 'comment' | 'approval' | 'revision' | 'share' | 'mention' | 'download'> = {
        'comment_added': 'comment',
        'comment_reply': 'comment',
        'comment_mention': 'mention',
        'comment_resolved': 'approval',
        'version_uploaded': 'upload',
        'version_signed_off': 'approval',
        'deliverable_created': 'upload',
        'deliverable_status_changed': 'revision',
        'deliverable_due_soon': 'revision',
        'deliverable_overdue': 'revision',
        'todo_assigned': 'share',
        'todo_due_soon': 'revision',
        'todo_overdue': 'revision',
        'todo_completed': 'approval',
        'project_created': 'upload',
        'project_deadline_approaching': 'revision',
        'project_assigned': 'share',
        'dropzone_file_uploaded': 'upload',
        'transfer_downloaded': 'download',
        'transcription_completed': 'approval',
        'upload_completed': 'upload',
      };

      return {
        id: notification.id,
        type: typeMap[notification.type] || 'upload',
        title: notification.title,
        subtitle: notification.message,
        timestamp: notification.created_at,
        userName: (notification.data?.actor_name as string) || undefined,
      };
    });
  }, [notifications]);

  // Sort deliverables by most recent first (before widget sync)
  const sortedDeliverables = [...deliverables].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at).getTime();
    const dateB = new Date(b.updated_at || b.created_at).getTime();
    return dateB - dateA;
  });

  // Sync data to iOS Home Screen Widgets
  useWidgetSync({
    todos: allTodos,
    events: calendarEvents,
    deliverables,
    latestDeliverable: sortedDeliverables[0] || null,
    activities: widgetActivities,
  });

  // Find the next upcoming event
  const nextEvent = useMemo((): CalendarEvent | null => {
    const now = new Date();
    const upcoming = calendarEvents
      .filter(event => {
        const eventStart = parseISO(event.start_time);
        return eventStart > now;
      })
      .sort((a, b) => {
        return parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime();
      });
    return upcoming[0] || null;
  }, [calendarEvents]);

  // Split deliverable deadlines into upcoming and past
  const {upcomingDeadlines, pastDeadlines} = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const all = deliverables
      .filter((d): d is Deliverable & {due_date: string} => Boolean(d.due_date))
      .map(d => {
        const due = new Date(d.due_date);
        due.setHours(0, 0, 0, 0);
        const isPast = due < now;
        const isToday = due.getTime() === now.getTime();
        return {deliverable: d, dueDate: due, isPast, isToday};
      });
    
    // Upcoming: today and future, sorted by date ascending
    const upcoming = all
      .filter(d => !d.isPast)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5);
    
    // Past: before today, sorted by date descending (most recent first)
    const past = all
      .filter(d => d.isPast)
      .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())
      .slice(0, 3);
    
    return {upcomingDeadlines: upcoming, pastDeadlines: past};
  }, [deliverables]);

  // Format event time nicely
  const formatEventTime = (event: CalendarEvent) => {
    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    
    if (event.is_all_day) {
      if (isToday(start)) return 'Today (All Day)';
      if (isTomorrow(start)) return 'Tomorrow (All Day)';
      return format(start, 'EEE, MMM d') + ' (All Day)';
    }
    
    const timeStr = format(start, 'h:mm a') + ' – ' + format(end, 'h:mm a');
    if (isToday(start)) return `Today, ${timeStr}`;
    if (isTomorrow(start)) return `Tomorrow, ${timeStr}`;
    return format(start, 'EEE, MMM d') + ', ' + format(start, 'h:mm a');
  };

  const isLoading = deliverablesLoading || todosLoading;
  const isRefreshing = deliverablesRefreshing || todosRefreshing;

  // If the most recent deliverable is a video, lazily resolve its HLS playback URL so we
  // can autoplay it (muted + looping) underneath the blur. Falls back to the still
  // thumbnail above whenever a stream isn't available or is still processing.
  // NOTE: These hooks must be declared BEFORE any conditional early return below
  // (e.g. the `if (isLoading)` guard) to keep hook ordering stable across renders.
  const latestVideoDeliverable = useMemo(
    () => sortedDeliverables.find(d => d.type === 'video'),
    [sortedDeliverables],
  );
  const [heroVideoUrl, setHeroVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHeroVideoUrl(null);
    if (!latestVideoDeliverable?.id) return;
    (async () => {
      try {
        const full = await getDeliverable(latestVideoDeliverable.id);
        if (cancelled) return;
        const url = full?.latest_version?.file_url;
        // Only autoplay HLS streams — direct mp4/r2 downloads can be huge and we don't want
        // to hammer the network on the dashboard.
        if (url && /\.m3u8($|\?)/i.test(url)) {
          setHeroVideoUrl(url);
        }
      } catch {
        // Stream lookup failed — silently fall back to the thumbnail.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latestVideoDeliverable?.id]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshDeliverables(), refreshTodos(), refreshCalendar()]);
  }, [refreshDeliverables, refreshTodos, refreshCalendar]);

  const handleDeliverablePress = useCallback(
    (deliverable: Deliverable) => {
      // DeliverableReview lives on the root stack now, so we cast to bypass the
      // narrower stack-typed signature; React Navigation bubbles the route up.
      (navigation as any).navigate('DeliverableReview', {
        deliverableId: deliverable.id,
      });
    },
    [navigation],
  );

  const openCalendarPager = useCallback(() => {
    navigation.navigate('Calendar', {screen: 'Calendar'});
  }, [navigation]);

  const handleFinalizeDeliverable = useCallback(
    async (deliverable: Deliverable) => {
      if (finalizingDeliverableId) return;

      Alert.alert(
        'Mark as Final',
        `Mark "${deliverable.name}" as final? This will finalize the current version.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Mark as Final',
            style: 'default',
            onPress: async () => {
              setFinalizingDeliverableId(deliverable.id);
              try {
                await markDeliverableAsFinal(deliverable.id);
                Alert.alert(
                  'Success',
                  `"${deliverable.name}" has been marked as final.`,
                  [{text: 'OK'}],
                );
                // Refresh deliverables to update the list
                await refreshDeliverables();
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to finalize deliverable';
                Alert.alert('Error', errorMessage);
              } finally {
                setFinalizingDeliverableId(null);
              }
            },
          },
        ],
      );
    },
    [finalizingDeliverableId, refreshDeliverables],
  );

  const handleToggleStatus = useCallback(
    async (todo: Todo) => {
      // Prevent double-trigger / re-entrancy while an animation is already running
      if (completingTodoId) return;
      if (showCongratulations) return;

      const isCompleted = todo.status === 'completed';
      const newStatus = isCompleted ? 'pending' : 'completed';

      if (newStatus === 'completed') {
        // Capture the todo BEFORE updating so we can keep it visible during animation
        setAnimatingTodo(todo);
        setCompletingTodoId(todo.id);
        // Capture the current visual index so we can keep the row "in place"
        const currentSorted = [...pendingTodos, ...inProgressTodos].sort((a, b) => {
          if (a.due_date && b.due_date) {
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          }
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return 0;
        });
        const idx = currentSorted.findIndex(t => t.id === todo.id);
        setAnimatingTodoIndex(idx >= 0 ? idx : null);
      }

      try {
        await toggleStatus(todo);

        if (newStatus === 'completed') {
          // Wait for animation to complete, then show congratulations
          setTimeout(() => {
            setCompletedTodoTitle(capitalizeFirst(todo.title));
            setShowCongratulations(true);

            setRecentlyCompletedIds(prev => new Set([...prev, todo.id]));
            setTimeout(() => {
              setRecentlyCompletedIds(prev => {
                const next = new Set(prev);
                next.delete(todo.id);
                return next;
              });
            }, 1000);
          }, 600); // Wait for checkbox collapse + strikethrough animation
        } else {
          setCompletingTodoId(null);
          setAnimatingTodo(null);
          setAnimatingTodoIndex(null);
        }
      } catch {
        setCompletingTodoId(null);
        setAnimatingTodo(null);
        setAnimatingTodoIndex(null);
        Alert.alert('Error', 'Failed to update task status');
      }
    },
    [toggleStatus, completingTodoId, showCongratulations, pendingTodos, inProgressTodos],
  );

  const handleTodoPress = useCallback((todo: Todo) => {
    setSelectedTodo(todo);
    setShowDetails(true);
  }, []);

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      // Mark as seen
      if (!notification.seen_at) {
        markSeen(notification.id);
      }

      // Close the notifications modal
      setShowNotifications(false);

      // Navigate based on notification type
      const {type, deliverable_id, version_id, comment_id, project_id} = notification;
      
      // Comment or version notifications - go to deliverable
      if (deliverable_id) {
        (navigation as any).navigate('DeliverableReview', {
          deliverableId: deliverable_id,
          versionId: version_id,
          commentId: comment_id,
        });
        return;
      }
      
      if (project_id) {
        navigation.navigate('ProjectDeliverables', {
          projectId: project_id,
          projectName: (notification.data?.project_name as string) || 'Project',
        });
      }
    },
    [navigation, markSeen],
  );

  const renderEmptyTasks = () => (
    <View style={styles.emptyTasksState}>
      <CheckSquare size={32} color={theme.colors.textMuted} />
      <Text style={styles.emptyTasksTitle}>NO TASKS</Text>
      <Text style={styles.emptyTasksSubtitle}>
        You're all caught up!
      </Text>
    </View>
  );

  if (isLoading) {
    return <BrandedLoadingScreen />;
  }

  // Most recent deliverable thumbnail drives the hero backdrop. Falls back to the default
  // PostHive thumbnail when nothing is available yet.
  const heroThumbnailUri =
    sortedDeliverables.find(d => d.thumbnail_url)?.thumbnail_url || DEFAULT_THUMBNAIL;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Blurred latest-deliverable backdrop with a dark overlay — covers the whole screen
          so the foreground content (Next Up / Tasks / Deadlines) sits cleanly on top. When
          the most recent deliverable is a video with a ready HLS stream, that's autoplayed
          (muted + looping) underneath the blur; otherwise the still thumbnail is used. */}
      <View
        style={[styles.heroBackdrop, {top: heroBackdropTopOffset}]}
        pointerEvents="none">
        <Image
          source={{uri: heroThumbnailUri}}
          style={styles.heroImage}
          resizeMode="cover"
          // Native blur on Android; iOS uses BlurView below for a higher-quality effect.
          blurRadius={Platform.OS === 'android' ? 12 : 0}
        />
        {/* Video (iOS only — Android lacks the BlurView path that gives us the nice frosted
            look on top of moving footage; we keep the still thumbnail there instead). */}
        {Platform.OS === 'ios' && heroVideoUrl ? (
          <Video
            source={{uri: heroVideoUrl, type: 'm3u8'}}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            muted
            repeat
            paused={false}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            controls={false}
            disableFocus
          />
        ) : null}
        {Platform.OS === 'ios' && (
          <BlurView
            style={StyleSheet.absoluteFillObject}
            blurType="dark"
            blurAmount={14}
            reducedTransparencyFallbackColor="#0A0A0A"
          />
        )}
        <View style={styles.heroDarkOverlay} />
        {/* Soft fade at the very top so the status bar / top-bar icons remain readable
            against the blurred image without painting a hard black band. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0)']}
          locations={[0, 0.6, 1]}
          style={[
            styles.heroTopFade,
            {height: insets.top + 64 + 32},
          ]}
          pointerEvents="none"
        />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={theme.colors.textPrimary}
          />
        }>
        {/* Editorial greeting — Miller Banner Light Italic, centered above NEXT UP. */}
        <View style={styles.greetingSection} pointerEvents="none">
          <Text style={styles.greetingText} numberOfLines={1} adjustsFontSizeToFit>
            {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
          </Text>
        </View>
        {/* Calendar — next up */}
        <Animated.View
          style={[
            styles.calendarSection,
            styles.calendarSectionFirst,
            {
              opacity: sectionAnimations[0],
              transform: [
                {
                  translateY: sectionAnimations[0].interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 0],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>NEXT UP</Text>
          </View>
          {nextEvent ? (
            <TouchableOpacity
              style={styles.upcomingEventCard}
              onPress={() => {
                const eventStart = parseISO(nextEvent.start_time);
                const timeString = format(eventStart, 'HH:mm');
                navigation.navigate('Calendar', {
                  screen: 'Calendar',
                  params: {
                    date: eventStart.toISOString(),
                    scrollToTime: timeString,
                  },
                });
              }}
              activeOpacity={0.8}>
              <View style={styles.calendarIconBadge}>
                <Calendar size={18} color={theme.colors.textPrimary} />
              </View>
              <View style={styles.upcomingEventContent}>
                <View style={styles.upcomingEventTitleRow}>
                  <Text style={styles.upcomingEventTitle} numberOfLines={1}>
                    {nextEvent.title}
                  </Text>
                  {nextEvent.meeting_link && (
                    <Camera size={14} color={theme.colors.textMuted} style={styles.upcomingEventCameraIcon} />
                  )}
                </View>
                <View style={styles.upcomingEventMeta}>
                  <Text style={styles.upcomingEventTime}>{formatEventTime(nextEvent)}</Text>
                  {nextEvent.location && (
                    <View style={styles.upcomingEventLocation}>
                      <MapPin size={10} color={theme.colors.textMuted} />
                      <Text style={styles.upcomingEventLocationText} numberOfLines={1}>
                        {nextEvent.location}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.upcomingEventCard}
              onPress={openCalendarPager}
              activeOpacity={0.8}>
              <View style={styles.calendarIconBadge}>
                <Calendar size={18} color={theme.colors.textMuted} />
              </View>
              <View style={styles.upcomingEventContent}>
                <Text style={styles.upcomingEventTitle}>Calendar</Text>
                <Text style={styles.upcomingEventTime}>No upcoming events — open schedule</Text>
              </View>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Tasks section */}
        <Animated.View style={[
          styles.tasksSection,
          (upcomingDeadlines.length === 0 && pastDeadlines.length === 0) && styles.tasksSectionLast,
          {
            opacity: sectionAnimations[1],
            transform: [{translateY: sectionAnimations[1].interpolate({
              inputRange: [0, 1],
              outputRange: [15, 0],
            })}],
          },
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>TASKS</Text>
            <Text style={styles.taskCount}>{allTodos.length}</Text>
          </View>

          {allTodos.length > 0 ? (
            <View style={styles.tasksList}>
              {allTodos.map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggleStatus={() => handleToggleStatus(todo)}
                  onPress={() => handleTodoPress(todo)}
                  isCompleting={completingTodoId === todo.id}
                  wasRecentlyCompleted={recentlyCompletedIds.has(todo.id)}
                />
              ))}
            </View>
          ) : (
            renderEmptyTasks()
          )}
        </Animated.View>

        {/* Deliverable Deadlines - Upcoming and Past */}
        {(upcomingDeadlines.length > 0 || pastDeadlines.length > 0) && (
          <Animated.View style={[styles.deadlineSection, {
            opacity: sectionAnimations[2],
            transform: [{translateY: sectionAnimations[2].interpolate({
              inputRange: [0, 1],
              outputRange: [15, 0],
            })}],
          }]}>
            {/* Upcoming Deadlines */}
            {upcomingDeadlines.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>UPCOMING DEADLINES</Text>
                </View>
                <View style={styles.timelineContainer}>
                  {upcomingDeadlines.map(({deliverable, dueDate, isToday}, index) => {
                    const isFirst = index === 0;
                    const isLast = index === upcomingDeadlines.length - 1;
                    const isFinal = deliverable.status === 'final';
                    const dotColor = isFinal 
                      ? theme.colors.success 
                      : isToday 
                        ? theme.colors.warning 
                        : theme.colors.textPrimary;
                    return (
                      <View key={deliverable.id} style={styles.timelineItem}>
                        {/* Date Column */}
                        <View style={styles.timelineDateColumn}>
                          <Text style={[
                            styles.timelineDateDay,
                            isFinal && {color: theme.colors.success},
                            !isFinal && isToday && {color: theme.colors.warning},
                          ]}>
                            {isToday ? 'Today' : format(dueDate, 'd')}
                          </Text>
                          {!isToday && (
                            <Text style={[
                              styles.timelineDateMonth,
                              isFinal && {color: theme.colors.success},
                            ]}>
                              {format(dueDate, 'MMM')}
                            </Text>
                          )}
                        </View>
                        
                        {/* Timeline Track */}
                        <View style={styles.timelineTrack}>
                          {!isFirst && <View style={[
                            styles.timelineLineTop,
                            isFinal && {backgroundColor: theme.colors.success},
                          ]} />}
                          <View style={[
                            styles.timelineDot,
                            {backgroundColor: dotColor},
                            isFinal && styles.timelineDotFinal,
                            !isFinal && isToday && styles.timelineDotToday,
                          ]} />
                          {!isLast && <View style={[
                            styles.timelineLineBottom,
                            isFinal && {backgroundColor: theme.colors.success},
                          ]} />}
                        </View>
                        
                        {/* Content Card */}
                        <TouchableOpacity
                          style={[
                            styles.timelineCard,
                            isFinal && styles.timelineCardFinal,
                          ]}
                          onPress={() => handleDeliverablePress(deliverable)}
                          activeOpacity={0.8}>
                          <View style={styles.timelineCardContent}>
                            <Text style={[
                              styles.timelineCardTitle,
                              isFinal && {color: theme.colors.success},
                            ]} numberOfLines={1}>
                              {deliverable.name}
                            </Text>
                            {deliverable.project_name && (
                              <Text style={styles.timelineCardSubtitle} numberOfLines={1}>
                                {deliverable.project_name}
                              </Text>
                            )}
                          </View>
                          {isFinal && (
                            <CheckCircle size={16} color={theme.colors.success} style={{marginRight: 4}} />
                          )}
                          <ChevronRight size={14} color={isFinal ? theme.colors.success : theme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Past Deadlines */}
            {pastDeadlines.length > 0 && (
              <>
                <View style={[styles.sectionHeader, upcomingDeadlines.length > 0 && {marginTop: 24}]}>
                  <Text style={styles.sectionLabel}>PAST</Text>
                </View>
                <View style={[styles.timelineContainer, {opacity: 0.5}]}>
                  {pastDeadlines.map(({deliverable, dueDate}, index) => {
                    const isFirst = index === 0;
                    const isLast = index === pastDeadlines.length - 1;
                    return (
                      <View key={deliverable.id} style={styles.timelineItem}>
                        {/* Date Column */}
                        <View style={styles.timelineDateColumn}>
                          <Text style={[styles.timelineDateDay, {color: theme.colors.textMuted}]}>
                            {format(dueDate, 'd')}
                          </Text>
                          <Text style={[styles.timelineDateMonth, {color: theme.colors.textMuted}]}>
                            {format(dueDate, 'MMM')}
                          </Text>
                        </View>
                        
                        {/* Timeline Track */}
                        <View style={styles.timelineTrack}>
                          {!isFirst && <View style={[styles.timelineLineTop, {backgroundColor: theme.colors.border}]} />}
                          <View style={[styles.timelineDot, {backgroundColor: theme.colors.textMuted}]} />
                          {!isLast && <View style={[styles.timelineLineBottom, {backgroundColor: theme.colors.border}]} />}
                        </View>
                        
                        {/* Content Card */}
                        <TouchableOpacity
                          style={[styles.timelineCard, {backgroundColor: theme.colors.surface}]}
                          onPress={() => handleDeliverablePress(deliverable)}
                          activeOpacity={0.8}>
                          <View style={styles.timelineCardContent}>
                            <Text style={[styles.timelineCardTitle, {color: theme.colors.textMuted}]} numberOfLines={1}>
                              {deliverable.name}
                            </Text>
                            {deliverable.project_name && (
                              <Text style={[styles.timelineCardSubtitle, {color: theme.colors.textMuted}]} numberOfLines={1}>
                                {deliverable.project_name}
                              </Text>
                            )}
                          </View>
                          <ChevronRight size={14} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Voice Command Modal */}
      <VoiceCommandModal
        visible={showVoiceCommand}
        onClose={() => setShowVoiceCommand(false)}
        onSuccess={() => {
          refreshTodos();
          refreshDeliverables();
        }}
      />

      {/* Task Details Modal */}
      <TaskDetailsModal
        visible={showDetails}
        todo={selectedTodo}
        onClose={() => {
          setShowDetails(false);
          setSelectedTodo(null);
        }}
        onToggleStatus={handleToggleStatus}
        onUpdate={() => {
          refreshTodos();
        }}
      />

      {/* Notifications Modal — hidden for workspace editors */}
      {workspaceNotificationsEnabled && (
        <NotificationsModal
          visible={showNotifications}
          notifications={notifications}
          unreadCount={unreadCount}
          onClose={() => setShowNotifications(false)}
          onNotificationPress={handleNotificationPress}
          onMarkAllSeen={markAllSeen}
        />
      )}

      {/* Congratulations Modal */}
      <CongratulationsModal
        visible={showCongratulations}
        todoTitle={completedTodoTitle}
        onClose={() => {
          setShowCongratulations(false);
          setCompletedTodoTitle(null);
          setCompletingTodoId(null);
          setAnimatingTodo(null);
          setAnimatingTodoIndex(null);
        }}
      />

    </SafeAreaView>
  );
}

// Task Details Modal
interface TaskDetailsModalProps {
  visible: boolean;
  todo: Todo | null;
  onClose: () => void;
  onToggleStatus: (todo: Todo) => void;
  onUpdate?: () => void;
}

function TaskDetailsModal({visible, todo, onClose, onToggleStatus, onUpdate}: TaskDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEstimatedTimePicker, setShowEstimatedTimePicker] = useState(false);

  useEffect(() => {
    if (todo) {
      setEstimatedMinutes(todo.estimated_minutes?.toString() || '');
      setDueDate(todo.due_date ? new Date(todo.due_date) : null);
      setDueTime(todo.due_time ? new Date(`2000-01-01T${todo.due_time}`) : null);
      setIsEditing(false);
    }
  }, [todo]);

  const handleComplete = () => {
    if (todo) {
      onToggleStatus(todo);
      onClose();
    }
  };

  const handleDateChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate && todo) {
      setDueDate(selectedDate);
      setIsSaving(true);
      try {
        await updateTodo(todo.id, {
          due_date: format(selectedDate, 'yyyy-MM-dd'),
          due_time: dueTime ? format(dueTime, 'HH:mm:ss') : undefined,
        });
        onUpdate?.();
      } catch (err) {
        Alert.alert('Error', 'Failed to update due date. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTimeChange = async (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime && todo) {
      setDueTime(selectedTime);
      setIsSaving(true);
      try {
        await updateTodo(todo.id, {
          due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
          due_time: format(selectedTime, 'HH:mm:ss'),
        });
        onUpdate?.();
      } catch (err) {
        Alert.alert('Error', 'Failed to update due time. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!todo) return;

    setIsSaving(true);
    try {
      await updateTodo(todo.id, {
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        due_time: dueTime ? format(dueTime, 'HH:mm:ss') : undefined,
      });
      setIsEditing(false);
      Alert.alert('Success', 'Task updated');
      onUpdate?.();
    } catch (err) {
      Alert.alert('Error', 'Failed to update task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!todo) return null;

  const isCompleted = todo.status === 'completed';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
            <Text style={modalStyles.closeText}>Close</Text>
          </TouchableOpacity>
          <Text style={modalStyles.headerTitle}>Task Details</Text>
          <View style={modalStyles.spacer} />
        </View>

        <ScrollView style={modalStyles.content}>
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>TITLE</Text>
            <Text style={modalStyles.value}>{capitalizeFirst(todo.title)}</Text>
          </View>

          {todo.description && (
            <View style={modalStyles.field}>
              <Text style={modalStyles.label}>DESCRIPTION</Text>
              <Text style={modalStyles.value}>{todo.description}</Text>
            </View>
          )}

          {/* Estimated Time */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>ESTIMATED TIME</Text>
            <TouchableOpacity
              style={modalStyles.dateButton}
              onPress={() => {
                setIsEditing(true);
                setShowEstimatedTimePicker(true);
              }}>
              <Text style={modalStyles.dateText}>
                {estimatedMinutes ? `${estimatedMinutes} minutes` : 'Tap to set (optional)'}
              </Text>
              {estimatedMinutes && (
                <TouchableOpacity
                  onPress={async (e) => {
                    e.stopPropagation();
                    if (!todo) return;
                    setEstimatedMinutes('');
                    setIsSaving(true);
                    try {
                      await updateTodo(todo.id, {
                        estimated_minutes: undefined,
                      });
                      onUpdate?.();
                    } catch (err) {
                      Alert.alert('Error', 'Failed to clear estimated time. Please try again.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <X size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          {/* Due Date */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>DUE DATE</Text>
            <TouchableOpacity
              style={modalStyles.dateButton}
              onPress={() => {
                setIsEditing(true);
                setShowDatePicker(true);
              }}>
              <Text style={modalStyles.dateText}>
                {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Select date (optional)'}
              </Text>
              {dueDate && (
                <TouchableOpacity
                  onPress={async (e) => {
                    e.stopPropagation();
                    if (!todo) return;
                    setDueDate(null);
                    setDueTime(null);
                    setIsSaving(true);
                    try {
                      await updateTodo(todo.id, {
                        due_date: undefined,
                        due_time: undefined,
                      });
                      onUpdate?.();
                    } catch (err) {
                      Alert.alert('Error', 'Failed to clear due date. Please try again.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <X size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {dueDate && (
              <TouchableOpacity
                style={[modalStyles.dateButton, {marginTop: 8}]}
                onPress={() => {
                  setIsEditing(true);
                  setShowTimePicker(true);
                }}>
                <Text style={modalStyles.dateText}>
                  {dueTime ? format(dueTime, 'h:mm a') : 'Select time (optional)'}
                </Text>
                {dueTime && (
                  <TouchableOpacity
                    onPress={async (e) => {
                      e.stopPropagation();
                      if (!todo) return;
                      setDueTime(null);
                      setIsSaving(true);
                      try {
                        await updateTodo(todo.id, {
                          due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
                          due_time: undefined,
                        });
                        onUpdate?.();
                      } catch (err) {
                        Alert.alert('Error', 'Failed to clear due time. Please try again.');
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <X size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          </View>

          {todo.project_name && (
            <View style={modalStyles.field}>
              <Text style={modalStyles.label}>PROJECT</Text>
              <Text style={modalStyles.value}>{todo.project_name}</Text>
            </View>
          )}

          {/* Date/Time Pickers */}
          {showDatePicker && (
            <View style={modalStyles.pickerContainer}>
              {Platform.OS === 'ios' && (
                <View style={modalStyles.pickerHeader}>
                  <Text style={modalStyles.pickerTitle}>Due Date</Text>
                  <TouchableOpacity 
                    style={modalStyles.pickerDoneButton}
                    onPress={() => setShowDatePicker(false)}>
                    <Text style={modalStyles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                themeVariant="dark"
                style={Platform.OS === 'ios' ? modalStyles.picker : undefined}
              />
            </View>
          )}

          {showTimePicker && (
            <View style={modalStyles.pickerContainer}>
              {Platform.OS === 'ios' && (
                <View style={modalStyles.pickerHeader}>
                  <Text style={modalStyles.pickerTitle}>Due Time</Text>
                  <TouchableOpacity 
                    style={modalStyles.pickerDoneButton}
                    onPress={() => setShowTimePicker(false)}>
                    <Text style={modalStyles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              <DateTimePicker
                value={dueTime || new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                themeVariant="dark"
                style={Platform.OS === 'ios' ? modalStyles.picker : undefined}
              />
            </View>
          )}

          {!isEditing && (
            <>
              <TouchableOpacity
                style={[modalStyles.completeButton, isCompleted && modalStyles.uncompleteButton]}
                onPress={handleComplete}>
                <Check size={20} color={isCompleted ? theme.colors.textPrimary : theme.colors.accentText} />
                <Text style={[modalStyles.completeButtonText, isCompleted && modalStyles.uncompleteButtonText]}>
                  {isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={modalStyles.saveButton}
                onPress={async () => {
                  if (!todo) return;
                  setIsSaving(true);
                  try {
                    await updateTodo(todo.id, {
                      estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
                      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
                      due_time: dueTime ? format(dueTime, 'HH:mm:ss') : undefined,
                    });
                    onUpdate?.();
                    onClose();
                  } catch (err) {
                    Alert.alert('Error', 'Failed to save changes. Please try again.');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                ) : (
                  <>
                    <Save size={20} color={theme.colors.textPrimary} />
                    <Text style={modalStyles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* Estimated Time Picker Modal */}
      <Modal
        visible={showEstimatedTimePicker}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowEstimatedTimePicker(false)}>
        <SafeAreaView style={modalStyles.timePickerContainer} edges={['top']}>
          <View style={modalStyles.timePickerHeader}>
            <Text style={modalStyles.timePickerTitle}>Select Estimated Time</Text>
            <TouchableOpacity
              onPress={() => setShowEstimatedTimePicker(false)}
              style={modalStyles.timePickerCloseButton}>
              <X size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={modalStyles.timePickerContent}>
            {[
              {label: '5 min', minutes: 5},
              {label: '15 min', minutes: 15},
              {label: '25 min', minutes: 25},
              {label: '30 min', minutes: 30},
              {label: '45 min', minutes: 45},
              {label: '1 hour', minutes: 60},
              {label: '1.5 hours', minutes: 90},
              {label: '2 hours', minutes: 120},
              {label: '3 hours', minutes: 180},
              {label: '4 hours', minutes: 240},
              {label: '6 hours', minutes: 360},
              {label: '8 hours', minutes: 480},
            ].map((option) => {
              const isSelected = estimatedMinutes === option.minutes.toString() || todo?.estimated_minutes === option.minutes;
              return (
                <TouchableOpacity
                  key={option.minutes}
                  style={[
                    modalStyles.timeOptionButton,
                    isSelected && modalStyles.timeOptionButtonSelected,
                  ]}
                  onPress={async () => {
                    if (!todo) return;
                    const minutesStr = option.minutes.toString();
                    setEstimatedMinutes(minutesStr);
                    setShowEstimatedTimePicker(false);
                    setIsSaving(true);
                    try {
                      await updateTodo(todo.id, {
                        estimated_minutes: option.minutes,
                      });
                      onUpdate?.();
                    } catch (err) {
                      Alert.alert('Error', 'Failed to update estimated time. Please try again.');
                      setEstimatedMinutes(todo.estimated_minutes?.toString() || '');
                    } finally {
                      setIsSaving(false);
                    }
                  }}>
                  <Text
                    style={[
                      modalStyles.timeOptionText,
                      isSelected && modalStyles.timeOptionTextSelected,
                    ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

// Notifications Modal
interface NotificationsModalProps {
  visible: boolean;
  notifications: Notification[];
  unreadCount: number;
  onClose: () => void;
  onNotificationPress: (notification: Notification) => void;
  onMarkAllSeen: () => void;
}

function NotificationsModal({
  visible,
  notifications,
  unreadCount,
  onClose,
  onNotificationPress,
  onMarkAllSeen,
}: NotificationsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={notificationModalStyles.container}>
        <View style={notificationModalStyles.header}>
          <View style={notificationModalStyles.headerLeft}>
            <Text style={notificationModalStyles.headerTitle}>NOTIFICATIONS</Text>
            {unreadCount > 0 && (
              <View style={notificationModalStyles.unreadBadge}>
                <Text style={notificationModalStyles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={notificationModalStyles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={notificationModalStyles.markAllButton}
                onPress={onMarkAllSeen}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <CheckCheck size={14} color={theme.colors.textMuted} />
                <Text style={notificationModalStyles.markAllText}>MARK ALL</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              style={notificationModalStyles.closeButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {notifications.length > 0 ? (
          <ScrollView
            style={notificationModalStyles.list}
            showsVerticalScrollIndicator={false}>
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onPress={() => onNotificationPress(notification)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={notificationModalStyles.emptyState}>
            <Bell size={40} color={theme.colors.textMuted} />
            <Text style={notificationModalStyles.emptyTitle}>NO NOTIFICATIONS</Text>
            <Text style={notificationModalStyles.emptySubtitle}>
              You're all caught up! New notifications will appear here
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const notificationModalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerTitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  unreadBadge: {
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: theme.colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  closeButton: {
    padding: 4,
  },
  list: {
    flex: 1,
    padding: theme.spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});


const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  closeButton: {
    paddingVertical: theme.spacing.sm,
  },
  closeText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
  },
  spacer: {
    width: 44,
  },
  editButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  field: {
    marginBottom: theme.spacing.xl,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: theme.spacing.sm,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
  },
  editInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
  },
  pickerContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  pickerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
  pickerDoneButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pickerDoneText: {
    color: theme.colors.accent,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
  picker: {
    height: 200,
  },
  timePickerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  timePickerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
  },
  timePickerCloseButton: {
    padding: 4,
  },
  timePickerContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  timeOptionButton: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  timeOptionButtonSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  timeOptionText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
  },
  timeOptionTextSelected: {
    color: theme.colors.accentText,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.success,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  uncompleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  completeButtonText: {
    color: theme.colors.accentText,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
  uncompleteButtonText: {
    color: theme.colors.textPrimary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  saveButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent to show wave background
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1.5,
  },
  heroBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // `top` is set dynamically (see DashboardScreen) so the backdrop extends
    // above the parent's safe-area + top-bar padding, covering the full screen.
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    transform: [{scale: 1.05}],
  },
  heroDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.55)',
  },
  heroTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  calendarSection: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  calendarSectionFirst: {
    marginTop: theme.spacing.xs,
  },
  greetingSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingText: {
    fontFamily: theme.typography.fontFamily.serifItalic,
    // The OTF is already italic; setting fontStyle here on iOS would request a synthetic
    // slant on top of the cut and trigger glyph fallback. Leave it off.
    color: theme.colors.textPrimary,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: 0.2,
    textAlign: 'center',
    opacity: 0.95,
  },
  calendarIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    gap: theme.spacing.md,
  },
  upcomingEventContent: {
    flex: 1,
    gap: 2,
  },
  upcomingEventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  upcomingEventTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.medium,
  },
  upcomingEventCameraIcon: {
    marginLeft: theme.spacing.xs,
  },
  upcomingEventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  upcomingEventTime: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
  },
  upcomingEventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  upcomingEventLocationText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    maxWidth: 120,
  },
  tasksSection: {
    marginBottom: theme.spacing.sm,
  },
  tasksSectionLast: {
    paddingBottom: 140, // Extra padding for bottom nav when no deadlines
  },
  taskCount: {
    color: theme.colors.textDisabled,
    fontSize: 11,
  },
  tasksList: {
    paddingHorizontal: theme.spacing.md,
  },
  emptyTasksState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    marginHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderHover,
  },
  emptyTasksTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginTop: theme.spacing.md,
  },
  emptyTasksSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: theme.colors.accentBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderHover,
  },
  // Deadline Timeline styles
  deadlineSection: {
    marginBottom: theme.spacing.lg,
    paddingBottom: 140, // Extra padding for bottom nav
  },
  // New Timeline styles
  timelineContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  timelineDateColumn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  timelineDateDay: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semibold,
    lineHeight: 20,
  },
  timelineDateMonth: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  timelineTrack: {
    width: 24,
    alignItems: 'center',
    position: 'relative',
  },
  timelineLineTop: {
    position: 'absolute',
    top: 0,
    height: 18,
    width: 2,
    backgroundColor: theme.colors.borderActive,
    borderRadius: 1,
  },
  timelineLineBottom: {
    position: 'absolute',
    top: 30,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.borderActive,
    borderRadius: 1,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.textPrimary,
    marginTop: 12,
    zIndex: 1,
  },
  timelineDotToday: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  timelineDotFinal: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 11,
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  timelineCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 8,
    marginBottom: 8,
  },
  timelineCardFinal: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  timelineCardContent: {
    flex: 1,
    gap: 2,
  },
  timelineCardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
  },
  timelineCardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
  },
  finalizeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalizeButtonDisabled: {
    opacity: 0.5,
  },
});

