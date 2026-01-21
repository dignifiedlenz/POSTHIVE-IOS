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
  Dimensions,
  Alert,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {Film, MessageCircle, ChevronRight, CheckSquare, Check, Plus, Bell, CheckCheck, X, ChevronDown, Zap, Calendar, MapPin, Video, Edit2, Save, Clock, Camera, CheckCircle, Target} from 'lucide-react-native';
import {formatDistanceToNow, format, isToday, isTomorrow, parseISO} from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Platform, TextInput} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {useDeliverables} from '../../hooks/useDeliverables';
import {useTodos} from '../../hooks/useTodos';
import {useNotifications} from '../../hooks/useNotifications';
import {useCalendarDayData, ScheduledTask} from '../../hooks/useCalendarDayData';
import {useWidgetSync} from '../../hooks/useWidgetSync';
import {TodoItem} from '../../components/TodoItem';
import {NotificationItem} from '../../components/NotificationItem';
import {capitalizeFirst} from '../../lib/utils';
import {VoiceCommandModal} from '../../components/VoiceCommandModal';
import {FocusModeModal} from '../../components/FocusModeModal';
import {Deliverable, Todo, Notification, CalendarEvent, Workspace} from '../../lib/types';
import {DashboardStackParamList} from '../../app/App';
import {updateTodo, markDeliverableAsFinal} from '../../lib/api';
import {CongratulationsModal} from '../../components/CongratulationsModal';
import {WorkspaceDropdownModal} from '../../components/WorkspaceDropdownModal';

type NavigationProp = StackNavigationProp<DashboardStackParamList, 'DashboardMain'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_HEIGHT = 180;

interface DeliverableCardProps {
  deliverable: Deliverable;
  onPress: () => void;
  isFirst?: boolean;
}

function HorizontalDeliverableCard({deliverable, onPress, isFirst}: DeliverableCardProps) {
  const hasUnreadComments =
    deliverable.unread_comment_count != null && deliverable.unread_comment_count > 0;

  const timeAgo = deliverable.updated_at
    ? formatDistanceToNow(new Date(deliverable.updated_at), {addSuffix: true})
    : null;

  return (
    <TouchableOpacity
      style={[styles.card, isFirst && styles.cardFirst]}
      onPress={onPress}
      activeOpacity={0.9}>
      {/* Thumbnail */}
      {deliverable.thumbnail_url ? (
        <Image
          source={{uri: deliverable.thumbnail_url}}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Film size={40} color={theme.colors.textMuted} />
        </View>
      )}
      
      {/* Bottom gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.5, 1]}
        style={styles.bottomGradient}
      />
      
      {/* Version badge - top left */}
      {deliverable.current_version != null && (
        <Text style={styles.versionText}>
          {deliverable.current_version === 100 ? 'Final' : `V${deliverable.current_version}`}
        </Text>
      )}
      
      {/* Unread comments badge - top right */}
      {hasUnreadComments && (
        <View style={styles.unreadBadge}>
          <MessageCircle size={11} color={theme.colors.textInverse} />
          <Text style={styles.unreadCount}>{deliverable.unread_comment_count}</Text>
        </View>
      )}
      
      {/* Title and subtitle - bottom */}
      <View style={styles.cardContent}>
        <Text style={styles.deliverableName} numberOfLines={1}>
          {deliverable.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {deliverable.project_name || timeAgo}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  // Staggered entrance animations
  const sectionAnimations = useRef([
    new Animated.Value(0), // Hero
    new Animated.Value(0), // Deliverables
    new Animated.Value(0), // Upcoming Event
    new Animated.Value(0), // Target Deadlines
    new Animated.Value(0), // Tasks
  ]).current;
  
  const {user, currentWorkspace, workspaces, selectWorkspace} = useAuth();
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
  });

  // Get scheduled tasks to find the currently running task (same as Calendar)
  const {scheduledTasks, calendarEvents, refresh: refreshCalendar} = useCalendarDayData({
    date: new Date(),
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
        // Small delay to ensure screen is fully mounted
        setTimeout(() => {
          setShowNotifications(true);
          // Clear the param so it doesn't reopen on next focus
          navigation.setParams({openNotifications: undefined});
        }, 300);
      }
    });

    return unsubscribe;
  }, [navigation]);

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
    }, [refreshTodos, refreshDeliverables, refreshCalendar, todosLoading, deliverablesLoading])
  );

  // Animation states for tasks
  const [completingTodoId, setCompletingTodoId] = useState<string | null>(null);
  const [animatingTodo, setAnimatingTodo] = useState<Todo | null>(null);
  const [animatingTodoIndex, setAnimatingTodoIndex] = useState<number | null>(null);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(new Set());
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showVoiceCommand, setShowVoiceCommand] = useState(false);
  const [showCongratulations, setShowCongratulations] = useState(false);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
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

  // Deliverables with deadlines that are not finalized (for timeline section)
  const deadlineDeliverables = useMemo(() => {
    const now = new Date();
    return deliverables
      .filter(d => {
        // Must have a due date
        if (!d.due_date) return false;
        // Must not be finalized (version 100)
        if (d.current_version === 100) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by due date (soonest first)
        const dateA = new Date(a.due_date!).getTime();
        const dateB = new Date(b.due_date!).getTime();
        return dateA - dateB;
      })
      .slice(0, 5); // Show max 5 items in timeline
  }, [deliverables]);

  // Sync data to iOS Home Screen Widgets
  useWidgetSync({
    todos: allTodos,
    events: calendarEvents,
    deliverables,
    latestDeliverable: sortedDeliverables[0] || null,
    activities: widgetActivities,
  });

  // Find the currently running scheduled task (same logic as CalendarScreen)
  const activeScheduledTask = useMemo(() => {
    const now = new Date();
    
    // Priority 1: Find task where now is between scheduled_start and scheduled_end
    const currentlyRunning = scheduledTasks.find(task => {
      try {
        const start = new Date(task.scheduled_start);
        const end = new Date(task.scheduled_end);
        return now >= start && now <= end;
      } catch {
        return false;
      }
    });
    
    if (currentlyRunning) return currentlyRunning;
    
    // Priority 2: Task with status 'active' within 30 min grace period
    const activeStatus = scheduledTasks.find(task => {
      if (task.status !== 'active') return false;
      try {
        const end = new Date(task.scheduled_end);
        const gracePeriod = 30 * 60 * 1000;
        return now <= new Date(end.getTime() + gracePeriod);
      } catch {
        return false;
      }
    });
    
    return activeStatus || null;
  }, [scheduledTasks]);

  // Get the current active task - prioritize scheduled task, then in-progress todo
  const activeTask = useMemo((): Todo | null => {
    // First check for active scheduled task
    if (activeScheduledTask) {
      const allTodosArr = [...inProgressTodos, ...pendingTodos];
      const todo = activeScheduledTask.source_type === 'todo' 
        ? allTodosArr.find(t => t.id === activeScheduledTask.source_id)
        : null;

      return {
        id: activeScheduledTask.source_id || activeScheduledTask.id,
        title: activeScheduledTask.title,
        status: 'in_progress' as const,
        priority: todo?.priority || 'medium' as const,
        estimated_minutes: activeScheduledTask.estimated_minutes,
        project_name: todo?.project_name,
        due_date: todo?.due_date,
        due_time: todo?.due_time,
        workspace_id: currentWorkspace?.id || '',
        created_by: user?.id || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Todo;
    }
    
    // Fall back to first in-progress todo
    return inProgressTodos[0] || null;
  }, [activeScheduledTask, inProgressTodos, pendingTodos, currentWorkspace?.id, user?.id]);

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

  const refresh = useCallback(async () => {
    await Promise.all([refreshDeliverables(), refreshTodos()]);
  }, [refreshDeliverables, refreshTodos]);

  const handleDeliverablePress = useCallback(
    (deliverable: Deliverable) => {
      navigation.navigate('DeliverableReview', {
        deliverableId: deliverable.id,
      });
    },
    [navigation],
  );

  const handleSeeAll = useCallback(() => {
    navigation.getParent()?.navigate('ReviewTab');
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
        navigation.navigate('DeliverableReview', {
          deliverableId: deliverable_id,
          versionId: version_id,
          commentId: comment_id,
        });
        return;
      }
      
      // Project notifications - go to projects tab
      if (project_id) {
        navigation.getParent()?.navigate('ReviewTab', {
          screen: 'ProjectDeliverables',
          params: {
            projectId: project_id,
            projectName: (notification.data?.project_name as string) || 'Project',
          },
        });
      }
    },
    [navigation, markSeen],
  );

  const renderEmptyDeliverables = () => (
    <View style={styles.emptyState}>
      <Film size={40} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>NO DELIVERABLES</Text>
      <Text style={styles.emptySubtitle}>
        Recent deliverables will appear here
      </Text>
    </View>
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
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        {/* Hero section with workspace name and bell icon */}
        <Animated.View style={[styles.heroSection, {
          opacity: sectionAnimations[0],
          transform: [{translateY: sectionAnimations[0].interpolate({
            inputRange: [0, 1],
            outputRange: [15, 0],
          })}],
        }]}>
          <View style={styles.heroHeader}>
            <TouchableOpacity
              style={styles.workspaceButton}
              onPress={() => setShowWorkspaceDropdown(true)}
              activeOpacity={0.7}>
              <Text style={styles.workspaceName} numberOfLines={1}>
                {currentWorkspace?.name || 'Workspace'}
              </Text>
              <ChevronDown size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.headerIcons}>
              {/* Focus Mode button */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowFocusMode(true)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Zap size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
              
              {/* Notifications button */}
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => setShowNotifications(true)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Bell size={22} color={theme.colors.textPrimary} />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Deliverables section */}
        <Animated.View style={[styles.section, {
          opacity: sectionAnimations[1],
          transform: [{translateY: sectionAnimations[1].interpolate({
            inputRange: [0, 1],
            outputRange: [15, 0],
          })}],
        }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>RECENT DELIVERABLES</Text>
            {sortedDeliverables.length > 0 && (
              <TouchableOpacity 
                style={styles.seeAllButton}
                onPress={handleSeeAll}>
                <Text style={styles.seeAllText}>SEE ALL</Text>
                <ChevronRight size={12} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {sortedDeliverables.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              decelerationRate="fast"
              snapToInterval={CARD_WIDTH + theme.spacing.sm}
              snapToAlignment="start">
              {sortedDeliverables.map((item, index) => (
                <HorizontalDeliverableCard
                  key={item.id}
                  deliverable={item}
                  onPress={() => handleDeliverablePress(item)}
                  isFirst={index === 0}
                />
              ))}
            </ScrollView>
          ) : (
            renderEmptyDeliverables()
          )}
        </Animated.View>

        {/* Upcoming Event Section */}
        {nextEvent && (
          <Animated.View style={[styles.upcomingEventSection, {
            opacity: sectionAnimations[2],
            transform: [{translateY: sectionAnimations[2].interpolate({
              inputRange: [0, 1],
              outputRange: [15, 0],
            })}],
          }]}>
            <TouchableOpacity 
              style={styles.upcomingEventCard}
              onPress={() => {
                const eventStart = parseISO(nextEvent.start_time);
                const timeString = format(eventStart, 'HH:mm');
                navigation.getParent()?.navigate('CalendarTab', {
                  date: eventStart.toISOString(),
                  scrollToTime: timeString,
                });
              }}
              activeOpacity={0.8}>
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
                  <Text style={styles.upcomingEventTime}>
                    {formatEventTime(nextEvent)}
                  </Text>
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
          </Animated.View>
        )}

        {/* Target Deadlines Section */}
        {deadlineDeliverables.length > 0 && (
          <Animated.View style={[styles.deadlineSection, {
            opacity: sectionAnimations[3],
            transform: [{translateY: sectionAnimations[3].interpolate({
              inputRange: [0, 1],
              outputRange: [15, 0],
            })}],
          }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>TARGET DATES</Text>
              <Text style={styles.taskCount}>{deadlineDeliverables.length}</Text>
            </View>
            
            <View style={styles.deadlineList}>
              {deadlineDeliverables.map((deliverable, index) => {
                const dueDate = deliverable.due_date ? new Date(deliverable.due_date) : null;
                const now = new Date();
                const isOverdue = dueDate && dueDate < now;
                const isToday_ = dueDate && isToday(dueDate);
                const isTomorrow_ = dueDate && isTomorrow(dueDate);
                const isFinalizing = finalizingDeliverableId === deliverable.id;
                
                let dueDateText = '';
                if (dueDate) {
                  if (isToday_) {
                    dueDateText = 'Today';
                  } else if (isTomorrow_) {
                    dueDateText = 'Tomorrow';
                  } else {
                    dueDateText = format(dueDate, 'MMM d');
                  }
                }
                
                return (
                  <View key={deliverable.id} style={styles.deadlineItem}>
                    {/* Timeline marker */}
                    <View style={styles.deadlineMarker}>
                      <View style={[
                        styles.deadlineMarkerDot,
                        isOverdue && styles.deadlineMarkerDotOverdue,
                        isToday_ && styles.deadlineMarkerDotToday,
                      ]} />
                      {index < deadlineDeliverables.length - 1 && (
                        <View style={styles.deadlineMarkerLine} />
                      )}
                    </View>
                    
                    {/* Content */}
                    <TouchableOpacity
                      style={styles.deadlineContent}
                      onPress={() => handleDeliverablePress(deliverable)}
                      activeOpacity={0.7}>
                      <View style={styles.deadlineTextContainer}>
                        <Text style={styles.deadlineName} numberOfLines={1}>
                          {deliverable.name}
                        </Text>
                        <View style={styles.deadlineMeta}>
                          <Text style={[
                            styles.deadlineDate,
                            isOverdue && styles.deadlineDateOverdue,
                            isToday_ && styles.deadlineDateToday,
                          ]}>
                            {dueDateText}
                          </Text>
                          {deliverable.project_name && (
                            <>
                              <Text style={styles.deadlineSeparator}>•</Text>
                              <Text style={styles.deadlineProject} numberOfLines={1}>
                                {deliverable.project_name}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      
                      {/* Finalize button */}
                      <TouchableOpacity
                        style={[
                          styles.finalizeButton,
                          isFinalizing && styles.finalizeButtonDisabled,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleFinalizeDeliverable(deliverable);
                        }}
                        disabled={isFinalizing}
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        {isFinalizing ? (
                          <ActivityIndicator size="small" color={theme.colors.success} />
                        ) : (
                          <CheckCircle size={22} color={theme.colors.success} />
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Tasks section */}
        <Animated.View style={[styles.tasksSection, {
          opacity: sectionAnimations[4],
          transform: [{translateY: sectionAnimations[4].interpolate({
            inputRange: [0, 1],
            outputRange: [15, 0],
          })}],
        }]}>
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

      {/* Notifications Modal */}
      <NotificationsModal
        visible={showNotifications}
        notifications={notifications}
        unreadCount={unreadCount}
        onClose={() => setShowNotifications(false)}
        onNotificationPress={handleNotificationPress}
        onMarkAllSeen={markAllSeen}
      />

      {/* Focus Mode Modal */}
      <FocusModeModal
        visible={showFocusMode}
        task={activeTask}
        onClose={() => setShowFocusMode(false)}
        onComplete={() => {
          if (activeTask) {
            toggleStatus(activeTask);
          }
        }}
        scheduledEnd={activeScheduledTask?.scheduled_end}
      />

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

      {/* Workspace Dropdown Modal */}
      <WorkspaceDropdownModal
        visible={showWorkspaceDropdown}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={(workspace) => {
          selectWorkspace(workspace);
          setShowWorkspaceDropdown(false);
        }}
        onClose={() => setShowWorkspaceDropdown(false)}
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
  heroSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workspaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  workspaceName: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
    flexShrink: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconButton: {
    padding: theme.spacing.xs,
  },
  bellButton: {
    position: 'relative',
    padding: theme.spacing.xs,
  },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.colors.error,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: theme.colors.textPrimary,
    fontSize: 9,
    fontWeight: '700',
  },
  section: {
    marginBottom: theme.spacing.xl,
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
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  horizontalList: {
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: 'relative',
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  cardFirst: {
    // First card styling if needed
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surface,
  },
  thumbnailPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  versionText: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
  },
  unreadBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  unreadCount: {
    color: theme.colors.textInverse,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
  },
  cardContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  deliverableName: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    marginHorizontal: theme.spacing.md,
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
  upcomingEventSection: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
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
    paddingBottom: 100, // Extra padding for FAB
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
  },
  deadlineList: {
    paddingHorizontal: theme.spacing.md,
  },
  deadlineItem: {
    flexDirection: 'row',
    minHeight: 56,
  },
  deadlineMarker: {
    width: 20,
    alignItems: 'center',
    paddingTop: 6,
  },
  deadlineMarkerDot: {
    width: 8,
    height: 8,
    backgroundColor: theme.colors.border,
  },
  deadlineMarkerDotOverdue: {
    backgroundColor: theme.colors.error,
  },
  deadlineMarkerDotToday: {
    backgroundColor: theme.colors.warning,
  },
  deadlineMarkerLine: {
    position: 'absolute',
    top: 16,
    bottom: 0,
    width: 1,
    backgroundColor: theme.colors.border,
    left: 9.5,
  },
  deadlineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingLeft: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  deadlineTextContainer: {
    flex: 1,
    gap: 2,
  },
  deadlineName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
  },
  deadlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deadlineDate: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
  },
  deadlineDateOverdue: {
    color: theme.colors.error,
  },
  deadlineDateToday: {
    color: theme.colors.warning,
  },
  deadlineSeparator: {
    color: theme.colors.textDisabled,
    fontSize: 8,
  },
  deadlineProject: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    maxWidth: 120,
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

