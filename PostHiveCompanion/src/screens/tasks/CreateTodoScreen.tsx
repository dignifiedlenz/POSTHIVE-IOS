import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {X, Calendar, Clock} from 'lucide-react-native';
import {format} from 'date-fns';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {useTodos} from '../../hooks/useTodos';
import {Button, Input} from '../../components/ui';
import {TodoPriority} from '../../lib/types';
import {capitalizeFirst} from '../../lib/utils';

const PRIORITIES: {key: TodoPriority; label: string; color: string}[] = [
  {key: 'low', label: 'Low', color: theme.colors.priorityLow},
  {key: 'medium', label: 'Medium', color: theme.colors.priorityMedium},
  {key: 'high', label: 'High', color: theme.colors.priorityHigh},
  {key: 'urgent', label: 'Urgent', color: theme.colors.priorityUrgent},
];

export function CreateTodoScreen() {
  const navigation = useNavigation();
  const {user, currentWorkspace} = useAuth();
  const {addTodo} = useTodos({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    setIsSubmitting(true);

    try {
      await addTodo({
        title: capitalizeFirst(title.trim()),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        due_time: dueTime ? format(dueTime, 'HH:mm:ss') : undefined,
        estimated_minutes: estimatedMinutes
          ? parseInt(estimatedMinutes, 10)
          : undefined,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to create task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    title,
    description,
    priority,
    dueDate,
    dueTime,
    estimatedMinutes,
    addTodo,
    navigation,
  ]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // On Android, dismiss on set/cancel. On iOS, keep open until Done is pressed.
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    // On Android, dismiss on set/cancel. On iOS, keep open until Done is pressed.
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      setDueTime(selectedTime);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}>
          <X size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>New Task</Text>
        <Button
          title="Save"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!title.trim()}
          size="sm"
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled">
        <Input
          label="Title"
          placeholder="What needs to be done?"
          value={title}
          onChangeText={setTitle}
          autoFocus
        />

        <Input
          label="Description (optional)"
          placeholder="Add more details..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={styles.descriptionInput}
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Priority</Text>
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
                <View
                  style={[styles.priorityDot, {backgroundColor: p.color}]}
                />
                <Text
                  style={[
                    styles.priorityText,
                    priority === p.key && {color: p.color},
                  ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Due Date (optional)</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}>
            <Calendar size={20} color={theme.colors.textMuted} />
            <Text style={styles.dateText}>
              {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Select date'}
            </Text>
            {dueDate && (
              <TouchableOpacity
                onPress={() => setDueDate(null)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <X size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {dueDate && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Due Time (optional)</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowTimePicker(true)}>
              <Clock size={20} color={theme.colors.textMuted} />
              <Text style={styles.dateText}>
                {dueTime ? format(dueTime, 'h:mm a') : 'Select time'}
              </Text>
              {dueTime && (
                <TouchableOpacity
                  onPress={() => setDueTime(null)}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <X size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Input
          label="Estimated Time (minutes, optional)"
          placeholder="e.g., 30"
          value={estimatedMinutes}
          onChangeText={text => setEstimatedMinutes(text.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
        />

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
              minimumDate={new Date()}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceBorder,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  },
  dateText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
  },
  // Picker container styles
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
});









