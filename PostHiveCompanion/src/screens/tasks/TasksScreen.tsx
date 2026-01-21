import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {
  Plus,
  CheckSquare,
  List,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Clock,
  Flag,
  Folder,
  Edit2,
  Save,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {useTodos} from '../../hooks/useTodos';
import {useLiveActivity} from '../../hooks/useLiveActivity';
import {TodoItem} from '../../components/TodoItem';
import {VoiceCommandModal} from '../../components/VoiceCommandModal';
import {Input, Button} from '../../components/ui';
import {updateTodo} from '../../lib/api';
import type {Todo, TodoPriority} from '../../lib/types';
import {DashboardStackParamList} from '../../app/App';
import {capitalizeFirst} from '../../lib/utils';

type NavigationProp = StackNavigationProp<DashboardStackParamList>;

type ViewTab = 'list' | 'calendar';

const TABS: {key: ViewTab; label: string; icon: typeof List}[] = [
  {key: 'list', label: 'List', icon: List},
  {key: 'calendar', label: 'Calendar', icon: Calendar},
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITIES: {key: TodoPriority; label: string; color: string}[] = [
  {key: 'low', label: 'Low', color: theme.colors.priorityLow},
  {key: 'medium', label: 'Medium', color: theme.colors.priorityMedium},
  {key: 'high', label: 'High', color: theme.colors.priorityHigh},
  {key: 'urgent', label: 'Urgent', color: theme.colors.priorityUrgent},
];

// Celebration Modal - matches WelcomeScreen style
interface CelebrationModalProps {
  visible: boolean;
  onDismiss: () => void;
}

function CelebrationModal({visible, onDismiss}: CelebrationModalProps) {
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      // Reset
      containerOpacity.setValue(0);
      checkScale.setValue(0);
      checkOpacity.setValue(0);
      textOpacity.setValue(0);
      textTranslate.setValue(30);
      subtitleOpacity.setValue(0);
      subtitleTranslate.setValue(20);

      // Run animations matching WelcomeScreen
      Animated.sequence([
        // Fade in container
        Animated.timing(containerOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Check icon appears
        Animated.parallel([
          Animated.spring(checkScale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(checkOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(200),
        // Text fades in
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(textTranslate, {
            toValue: 0,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(100),
        // Subtitle fades in
        Animated.parallel([
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(subtitleTranslate, {
            toValue: 0,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
          }),
        ]),
        // Hold
        Animated.delay(1000),
        // Fade out
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss();
      });
    }
  }, [visible, containerOpacity, checkScale, checkOpacity, textOpacity, textTranslate, subtitleOpacity, subtitleTranslate, onDismiss]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.celebrationContainer, {opacity: containerOpacity}]}>
        {/* Check circle */}
        <Animated.View
          style={[
            styles.celebrationCheckCircle,
            {
              transform: [{scale: checkScale}],
              opacity: checkOpacity,
            },
          ]}>
          <Check size={40} color={theme.colors.accentText} strokeWidth={3} />
        </Animated.View>

        {/* Task complete text */}
        <Animated.Text
          style={[
            styles.celebrationLabel,
            {
              opacity: textOpacity,
              transform: [{translateY: textTranslate}],
            },
          ]}>
          Task complete
        </Animated.Text>

        {/* Nice work */}
        <Animated.Text
          style={[
            styles.celebrationTitle,
            {
              opacity: textOpacity,
              transform: [{translateY: textTranslate}],
            },
          ]}>
          Nice work!
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text
          style={[
            styles.celebrationSubtitle,
            {
              opacity: subtitleOpacity,
              transform: [{translateY: subtitleTranslate}],
            },
          ]}>
          KEEP IT UP
        </Animated.Text>

        {/* Decorative lines */}
        <View style={styles.decorativeLines}>
          <View style={styles.line} />
          <View style={[styles.line, styles.lineShort]} />
        </View>
      </Animated.View>
    </Modal>
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Initialize form data when todo changes
  useEffect(() => {
    if (todo) {
      setTitle(capitalizeFirst(todo.title));
      setDescription(todo.description || '');
      setPriority(todo.priority);
      setDueDate(todo.due_date ? new Date(todo.due_date) : null);
      setDueTime(todo.due_time ? new Date(`2000-01-01T${todo.due_time}`) : null);
      setEstimatedMinutes(todo.estimated_minutes?.toString() || '');
      setIsEditing(false);
    }
  }, [todo]);

  const handleComplete = () => {
    if (todo) {
      onToggleStatus(todo);
      onClose();
    }
  };

  const handleSave = async () => {
    if (!todo || !title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    setIsSaving(true);
    try {
      await updateTodo(todo.id, {
        title: capitalizeFirst(title.trim()),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        due_time: dueTime ? format(dueTime, 'HH:mm:ss') : undefined,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
      });
      setIsEditing(false);
      onUpdate?.(); // Refresh the todo list
      Alert.alert('Success', 'Task updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to update task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      setDueTime(selectedTime);
    }
  };

  if (!todo) return null;

  const isCompleted = todo.status === 'completed';
  const priorityInfo = PRIORITIES.find(p => p.key === priority) || PRIORITIES[1];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.detailsContainer}>
        {/* Header */}
        <View style={styles.detailsHeader}>
          <TouchableOpacity onPress={onClose} style={styles.detailsCloseButton}>
            <X size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.detailsHeaderTitle}>Task Details</Text>
          {!isEditing ? (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.detailsEditButton}>
              <Edit2 size={20} color={theme.colors.accent} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleSave} style={styles.detailsEditButton} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Save size={20} color={theme.colors.accent} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.detailsContent} contentContainerStyle={styles.detailsContentContainer}>
          {/* Title */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>TITLE</Text>
            {isEditing ? (
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Task title"
                style={styles.editInput}
              />
            ) : (
              <Text style={styles.detailsValue}>{capitalizeFirst(todo.title)}</Text>
            )}
          </View>

          {/* Description */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>DESCRIPTION</Text>
            {isEditing ? (
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Add description..."
                multiline
                numberOfLines={3}
                style={styles.editInput}
              />
            ) : (
              <Text style={styles.detailsValue}>{todo.description || 'No description'}</Text>
            )}
          </View>

          {/* Priority */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>
              <Flag size={12} color={theme.colors.textMuted} /> PRIORITY
            </Text>
            {isEditing ? (
              <View style={styles.priorityContainer}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      styles.priorityButton,
                      priority === p.key && {
                        backgroundColor: p.color + '20',
                        borderColor: p.color,
                      },
                    ]}
                    onPress={() => setPriority(p.key)}>
                    <View style={[styles.priorityDot, {backgroundColor: p.color}]} />
                    <Text style={[
                      styles.priorityText,
                      priority === p.key && {color: p.color},
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.priorityDisplay}>
                <View style={[styles.priorityDot, {backgroundColor: priorityInfo.color}]} />
                <Text style={styles.detailsValue}>{priorityInfo.label}</Text>
              </View>
            )}
          </View>

          {/* Estimated Time */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>
              <Clock size={12} color={theme.colors.textMuted} /> ESTIMATED TIME
            </Text>
            {isEditing ? (
              <Input
                value={estimatedMinutes}
                onChangeText={text => setEstimatedMinutes(text.replace(/[^0-9]/g, ''))}
                placeholder="Minutes (optional)"
                keyboardType="numeric"
                style={styles.editInput}
              />
            ) : (
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setIsEditing(true)}>
                <Clock size={20} color={theme.colors.textMuted} />
                <Text style={styles.dateText}>
                  {todo.estimated_minutes ? `${todo.estimated_minutes} minutes` : 'Tap to set (optional)'}
                </Text>
                {estimatedMinutes && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setEstimatedMinutes('');
                    }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <X size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Due Date */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>
              <Clock size={12} color={theme.colors.textMuted} /> DUE DATE
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                setIsEditing(true);
                setShowDatePicker(true);
              }}>
              <Calendar size={20} color={theme.colors.textMuted} />
              <Text style={styles.dateText}>
                {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Select date (optional)'}
              </Text>
              {dueDate && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setDueDate(null);
                    setDueTime(null);
                  }}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <X size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {dueDate && (
              <TouchableOpacity
                style={[styles.dateButton, {marginTop: 8}]}
                onPress={() => {
                  setIsEditing(true);
                  setShowTimePicker(true);
                }}>
                <Clock size={20} color={theme.colors.textMuted} />
                <Text style={styles.dateText}>
                  {dueTime ? format(dueTime, 'h:mm a') : 'Select time (optional)'}
                </Text>
                {dueTime && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setDueTime(null);
                    }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <X size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Status */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>STATUS</Text>
            <View style={[styles.statusBadge, isCompleted && styles.statusBadgeCompleted]}>
              <Text style={[styles.statusText, isCompleted && styles.statusTextCompleted]}>
                {isCompleted ? 'Completed' : todo.status === 'in_progress' ? 'In Progress' : 'Pending'}
              </Text>
            </View>
          </View>

          {/* Project */}
          {todo.project_name && (
            <View style={styles.detailsField}>
              <Text style={styles.detailsLabel}>
                <Folder size={12} color={theme.colors.textMuted} /> PROJECT
              </Text>
              <Text style={styles.detailsValue}>{todo.project_name}</Text>
            </View>
          )}

          {/* Date/Time Pickers */}
          {showDatePicker && (
            <View style={styles.pickerContainer}>
              {Platform.OS === 'ios' && (
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Due Date</Text>
                  <TouchableOpacity 
                    style={styles.pickerDoneButton}
                    onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                themeVariant="dark"
                style={Platform.OS === 'ios' ? styles.picker : undefined}
              />
            </View>
          )}

          {showTimePicker && (
            <View style={styles.pickerContainer}>
              {Platform.OS === 'ios' && (
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Due Time</Text>
                  <TouchableOpacity 
                    style={styles.pickerDoneButton}
                    onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              <DateTimePicker
                value={dueTime || new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                themeVariant="dark"
                style={Platform.OS === 'ios' ? styles.picker : undefined}
              />
            </View>
          )}

          {/* Complete/Uncomplete button */}
          {!isEditing && (
            <TouchableOpacity
              style={[
                styles.completeButton,
                isCompleted && styles.uncompleteButton,
              ]}
              onPress={handleComplete}>
              <Check size={20} color={isCompleted ? theme.colors.textPrimary : theme.colors.accentText} />
              <Text style={[
                styles.completeButtonText,
                isCompleted && styles.uncompleteButtonText,
              ]}>
                {isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function TasksScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user, currentWorkspace} = useAuth();
  const {
    pendingTodos,
    inProgressTodos,
    completedTodos,
    isLoading,
    isRefreshing,
    refresh,
    toggleStatus,
  } = useTodos({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Animation states
  const [completingTodoId, setCompletingTodoId] = useState<string | null>(null);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(
    new Set(),
  );

  // Modal states
  const [showCelebration, setShowCelebration] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showVoiceCommand, setShowVoiceCommand] = useState(false);

  // Get the currently active task (first in-progress task)
  const activeTask = inProgressTodos[0] || null;

  // Manage Live Activity for active task
  useLiveActivity({
    task: activeTask,
    isActive: !!activeTask && activeTask.status === 'in_progress',
    onError: (error) => {
      console.error('Live Activity error:', error);
    },
  });

  // Combine all todos for list view (excluding completed)
  const allTodos = useMemo(() => {
    return [...pendingTodos, ...inProgressTodos].sort((a, b) => {
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  }, [pendingTodos, inProgressTodos]);

  // Group todos by date for calendar
  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    [...pendingTodos, ...inProgressTodos, ...completedTodos].forEach(todo => {
      if (todo.due_date) {
        const dateKey = format(new Date(todo.due_date), 'yyyy-MM-dd');
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, todo]);
      }
    });
    return map;
  }, [pendingTodos, inProgressTodos, completedTodos]);

  // Get calendar days for current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({start: calendarStart, end: calendarEnd});
  }, [currentMonth]);

  // Get todos for selected date
  const selectedDateTodos = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return todosByDate.get(dateKey) || [];
  }, [selectedDate, todosByDate]);

  const handleToggleStatus = useCallback(
    async (todo: Todo) => {
      const isCompleted = todo.status === 'completed';
      const newStatus = isCompleted ? 'pending' : 'completed';

      if (newStatus === 'completed') {
        setCompletingTodoId(todo.id);
      }

      try {
        await toggleStatus(todo);

        setTimeout(() => {
          setCompletingTodoId(null);

          if (newStatus === 'completed') {
            // Show celebration
            setShowCelebration(true);

            setRecentlyCompletedIds(prev => new Set([...prev, todo.id]));
            setTimeout(() => {
              setRecentlyCompletedIds(prev => {
                const next = new Set(prev);
                next.delete(todo.id);
                return next;
              });
            }, 1000);
          }
        }, 200);
      } catch {
        setCompletingTodoId(null);
        Alert.alert('Error', 'Failed to update task status');
      }
    },
    [toggleStatus],
  );

  const handleTodoPress = useCallback((todo: Todo) => {
    setSelectedTodo(todo);
    setShowDetails(true);
  }, []);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <CheckSquare size={48} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>No tasks</Text>
      <Text style={styles.emptySubtitle}>
        Tap the + button to create a new task
      </Text>
    </View>
  );

  const renderCalendarEmptyState = () => (
    <View style={styles.calendarEmptyState}>
      <Text style={styles.calendarEmptyText}>
        {selectedDate ? 'No tasks on this day' : 'Select a day to view tasks'}
      </Text>
    </View>
  );

  const renderCalendarView = () => (
    <ScrollView
      style={styles.calendarContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          tintColor={theme.colors.accent}
        />
      }>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.monthNavButton}
          onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {format(currentMonth, 'MMMM yyyy')}
        </Text>
        <TouchableOpacity
          style={styles.monthNavButton}
          onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekdayHeader}>
        {WEEKDAYS.map(day => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTodos = todosByDate.get(dateKey) || [];
          const hasTodos = dayTodos.length > 0;
          const hasUncompletedTodos = dayTodos.some(
            t => t.status !== 'completed',
          );
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.calendarDay,
                !isCurrentMonth && styles.calendarDayOtherMonth,
                isSelected && styles.calendarDaySelected,
                isTodayDate && styles.calendarDayToday,
              ]}
              onPress={() => setSelectedDate(day)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.calendarDayText,
                  !isCurrentMonth && styles.calendarDayTextOtherMonth,
                  isSelected && styles.calendarDayTextSelected,
                  isTodayDate && styles.calendarDayTextToday,
                ]}>
                {format(day, 'd')}
              </Text>
              {hasTodos && (
                <View style={styles.todoDots}>
                  <View
                    style={[
                      styles.todoDot,
                      hasUncompletedTodos
                        ? styles.todoDotActive
                        : styles.todoDotCompleted,
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Date Tasks */}
      <View style={styles.selectedDateSection}>
        {selectedDate && (
          <Text style={styles.selectedDateTitle}>
            {isToday(selectedDate)
              ? 'Today'
              : format(selectedDate, 'EEEE, MMM d')}
          </Text>
        )}
        {selectedDateTodos.length > 0 ? (
          <View style={styles.selectedDateTasks}>
            {selectedDateTodos.map(todo => (
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
          renderCalendarEmptyState()
        )}
      </View>
    </ScrollView>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateTodo')}>
          <Plus size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}>
              <Icon
                size={16}
                color={
                  activeTab === tab.key
                    ? theme.colors.textPrimary
                    : theme.colors.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}>
                {tab.label}
              </Text>
              {tab.key === 'list' && (
                <View
                  style={[
                    styles.tabCount,
                    activeTab === tab.key && styles.tabCountActive,
                  ]}>
                  <Text
                    style={[
                      styles.tabCountText,
                      activeTab === tab.key && styles.tabCountTextActive,
                    ]}>
                    {allTodos.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'list' ? (
        <FlatList
          data={allTodos}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <TodoItem
              todo={item}
              onToggleStatus={() => handleToggleStatus(item)}
              onPress={() => handleTodoPress(item)}
              isCompleting={completingTodoId === item.id}
              wasRecentlyCompleted={recentlyCompletedIds.has(item.id)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            allTodos.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={theme.colors.accent}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        renderCalendarView()
      )}

      {/* Voice Command Modal */}
      <VoiceCommandModal
        visible={showVoiceCommand}
        onClose={() => setShowVoiceCommand(false)}
        onSuccess={() => {
          refresh();
        }}
      />

      {/* Celebration Modal */}
      <CelebrationModal
        visible={showCelebration}
        onDismiss={() => setShowCelebration(false)}
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
        onUpdate={refresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Show wave background
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: theme.colors.borderHover,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  tabActive: {
    borderColor: theme.colors.borderSelected,
    backgroundColor: theme.colors.surfaceHover,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  tabTextActive: {
    color: theme.colors.textPrimary,
  },
  tabCount: {
    backgroundColor: theme.colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 0,
  },
  tabCountActive: {
    backgroundColor: theme.colors.accentBackground,
  },
  tabCountText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  tabCountTextActive: {
    color: theme.colors.accentText,
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderHover,
    margin: theme.spacing.md,
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
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: theme.colors.accentBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderHover,
  },
  // Calendar styles
  calendarContainer: {
    flex: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  monthTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  weekdayHeader: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  calendarDayOtherMonth: {
    opacity: 0.3,
  },
  calendarDaySelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.borderSelected,
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: theme.colors.borderActive,
  },
  calendarDayText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDayTextOtherMonth: {
    color: theme.colors.textMuted,
  },
  calendarDayTextSelected: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  calendarDayTextToday: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
  todoDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  todoDot: {
    width: 4,
    height: 4,
  },
  todoDotActive: {
    backgroundColor: theme.colors.accent,
  },
  todoDotCompleted: {
    backgroundColor: theme.colors.success,
  },
  selectedDateSection: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 100,
  },
  selectedDateTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectedDateTasks: {
    gap: 2,
  },
  calendarEmptyState: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  calendarEmptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
  },
  // Celebration modal styles (matching WelcomeScreen)
  celebrationContainer: {
    flex: 1,
    backgroundColor: 'transparent', // Show wave background
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  celebrationCheckCircle: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.accentBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    borderWidth: 2,
    borderColor: theme.colors.accentBackground,
  },
  celebrationLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  celebrationTitle: {
    color: theme.colors.textPrimary,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: theme.spacing.lg,
  },
  celebrationSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 3,
  },
  decorativeLines: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  line: {
    width: 40,
    height: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 8,
  },
  lineShort: {
    width: 20,
  },
  // Task details modal styles
  detailsContainer: {
    flex: 1,
    backgroundColor: 'transparent', // Show wave background
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailsCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsHeaderTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
  },
  detailsSaveButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.accentBackground,
  },
  detailsSaveText: {
    color: theme.colors.accentText,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  detailsContent: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  detailsField: {
    marginBottom: theme.spacing.xl,
  },
  detailsLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: theme.spacing.sm,
  },
  detailsInput: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  detailsTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  detailsMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
  },
  detailsHeaderSpacer: {
    width: 44,
  },
  detailsEditButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContentContainer: {
    paddingBottom: theme.spacing.xl,
  },
  editInput: {
    marginTop: theme.spacing.xs,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    gap: 6,
  },
  priorityText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  dateText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    marginTop: theme.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceBorder,
  },
  pickerTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  pickerDoneButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.accent,
    borderRadius: 6,
  },
  pickerDoneText: {
    color: theme.colors.accentText,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
  },
  picker: {
    height: 180,
  },
  detailsValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
  },
  priorityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusBadgeCompleted: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  statusText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusTextCompleted: {
    color: '#4ade80',
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  priorityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 6,
  },
  priorityOptionActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  priorityDot: {
    width: 8,
    height: 8,
  },
  priorityText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  priorityTextActive: {
    color: theme.colors.textPrimary,
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
});
