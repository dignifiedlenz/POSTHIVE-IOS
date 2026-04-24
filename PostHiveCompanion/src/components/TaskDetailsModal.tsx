// Shared task editing modal used by both the Dashboard and Tasks screens. We
// split this out so the dashboard's quick-edit flow and the tasks list share
// the exact same on-brand chrome (editorial serif title, glass row pickers,
// assignee + linked-deliverable rows). Previously two copies drifted apart and
// the dashboard ended up missing the assignee/deliverable functionality.

import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Edit2,
  Film,
  Flag,
  Save,
  User as UserIcon,
  X,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {format} from 'date-fns';

import {theme} from '../theme';
import {Input} from './ui';
import {capitalizeFirst} from '../lib/utils';
import {
  getRecentDeliverables,
  getWorkspaceMembers,
  updateTodo,
} from '../lib/api';
import type {
  Deliverable,
  Todo,
  TodoPriority,
  WorkspaceMember,
} from '../lib/types';

const PRIORITIES: {key: TodoPriority; label: string; color: string}[] = [
  {key: 'low', label: 'Low', color: theme.colors.priorityLow},
  {key: 'medium', label: 'Medium', color: theme.colors.priorityMedium},
  {key: 'high', label: 'High', color: theme.colors.priorityHigh},
  {key: 'urgent', label: 'Urgent', color: theme.colors.priorityUrgent},
];

export interface TaskDetailsModalProps {
  visible: boolean;
  todo: Todo | null;
  onClose: () => void;
  onToggleStatus: (todo: Todo) => void;
  onUpdate?: () => void;
}

export function TaskDetailsModal({
  visible,
  todo,
  onClose,
  onToggleStatus,
  onUpdate,
}: TaskDetailsModalProps) {
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

  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined);
  const [assignedName, setAssignedName] = useState<string | undefined>(undefined);
  const [deliverableId, setDeliverableId] = useState<string | undefined>(undefined);
  const [deliverableName, setDeliverableName] = useState<string | undefined>(undefined);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showDeliverablePicker, setShowDeliverablePicker] = useState(false);

  useEffect(() => {
    if (todo) {
      setTitle(capitalizeFirst(todo.title));
      setDescription(todo.description || '');
      setPriority(todo.priority);
      setDueDate(todo.due_date ? new Date(todo.due_date) : null);
      setDueTime(todo.due_time ? new Date(`2000-01-01T${todo.due_time}`) : null);
      setEstimatedMinutes(todo.estimated_minutes?.toString() || '');
      setAssignedTo(todo.assigned_to);
      setAssignedName(todo.assigned_name);
      setDeliverableId(todo.deliverable_id);
      setDeliverableName(todo.deliverable_name);
      setIsEditing(false);
    }
  }, [todo]);

  // Lazily fetch workspace members + deliverables once the modal opens. Both
  // are scoped to the todo's workspace, so we derive the workspaceId from the
  // todo itself instead of threading it through props.
  useEffect(() => {
    if (!visible || !todo?.workspace_id) return;
    let cancelled = false;
    (async () => {
      try {
        const [mem, del] = await Promise.all([
          getWorkspaceMembers(todo.workspace_id).catch(
            () => [] as WorkspaceMember[],
          ),
          getRecentDeliverables(todo.workspace_id, todo.created_by || '').catch(
            () => [] as Deliverable[],
          ),
        ]);
        if (cancelled) return;
        setMembers(mem);
        setDeliverables(del);
      } catch {
        // picker rows degrade gracefully if the lookup fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, todo?.workspace_id, todo?.created_by]);

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
        assigned_to: assignedTo ?? undefined,
        deliverable_id: deliverableId ?? undefined,
      });
      setIsEditing(false);
      onUpdate?.();
      Alert.alert('Success', 'Task updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to update task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const handleTimeChange = (_: any, selectedTime?: Date) => {
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

  const selectedMember = members.find(m => m.user_id === assignedTo);
  const selectedDeliverable = deliverables.find(d => d.id === deliverableId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.detailsContainer}>
        {/* Header — editorial serif title, minimal chrome */}
        <View style={styles.detailsHeader}>
          <TouchableOpacity onPress={onClose} style={styles.detailsCloseButton}>
            <X size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.detailsHeaderTitleWrap} pointerEvents="none">
            <Text style={styles.detailsHeaderEyebrow}>{isEditing ? 'editing' : 'task'}</Text>
            <Text style={styles.detailsHeaderTitle} numberOfLines={1}>
              {capitalizeFirst(title || todo.title || 'Untitled')}
            </Text>
          </View>
          {!isEditing ? (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.detailsEditButton}>
              <Edit2 size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSave}
              style={styles.detailsEditButton}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.textPrimary} />
              ) : (
                <Save size={18} color={theme.colors.textPrimary} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.detailsContent}
          contentContainerStyle={styles.detailsContentContainer}>
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
                  {todo.estimated_minutes
                    ? `${todo.estimated_minutes} minutes`
                    : 'Tap to set (optional)'}
                </Text>
                {estimatedMinutes ? (
                  <TouchableOpacity
                    onPress={e => {
                      e.stopPropagation();
                      setEstimatedMinutes('');
                    }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <X size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
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
              {dueDate ? (
                <TouchableOpacity
                  onPress={e => {
                    e.stopPropagation();
                    setDueDate(null);
                    setDueTime(null);
                  }}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <X size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
            {dueDate ? (
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
                {dueTime ? (
                  <TouchableOpacity
                    onPress={e => {
                      e.stopPropagation();
                      setDueTime(null);
                    }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <X size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Status */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>STATUS</Text>
            <View style={[styles.statusBadge, isCompleted && styles.statusBadgeCompleted]}>
              <Text style={[styles.statusText, isCompleted && styles.statusTextCompleted]}>
                {isCompleted
                  ? 'Completed'
                  : todo.status === 'in_progress'
                  ? 'In Progress'
                  : 'Pending'}
              </Text>
            </View>
          </View>

          {/* Assignee — tap to choose any workspace member, or unassign */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>
              <UserIcon size={12} color={theme.colors.textMuted} /> ASSIGNEE
            </Text>
            <TouchableOpacity
              style={styles.linkedRow}
              activeOpacity={0.7}
              onPress={() => {
                setIsEditing(true);
                setShowAssigneePicker(true);
              }}>
              {selectedMember || assignedName ? (
                <>
                  <View style={styles.linkedAvatar}>
                    <Text style={styles.linkedAvatarText}>
                      {getInitials(selectedMember?.name || assignedName)}
                    </Text>
                  </View>
                  <View style={styles.linkedTextWrap}>
                    <Text style={styles.linkedTitle} numberOfLines={1}>
                      {selectedMember?.name || assignedName}
                    </Text>
                    {selectedMember?.email ? (
                      <Text style={styles.linkedSubtitle} numberOfLines={1}>
                        {selectedMember.email}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.linkedAvatar, styles.linkedAvatarEmpty]}>
                    <UserIcon size={14} color={theme.colors.textMuted} />
                  </View>
                  <Text style={[styles.linkedTitle, {color: theme.colors.textMuted, flex: 1}]}>
                    Unassigned
                  </Text>
                </>
              )}
              <ChevronDown size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Linked deliverable — pin the task to a project's review timeline */}
          <View style={styles.detailsField}>
            <Text style={styles.detailsLabel}>
              <Film size={12} color={theme.colors.textMuted} /> LINKED DELIVERABLE
            </Text>
            <TouchableOpacity
              style={styles.linkedRow}
              activeOpacity={0.7}
              onPress={() => {
                setIsEditing(true);
                setShowDeliverablePicker(true);
              }}>
              {selectedDeliverable || deliverableName ? (
                <>
                  <View style={styles.linkedThumb}>
                    {selectedDeliverable?.thumbnail_url ? (
                      <Image
                        source={{uri: selectedDeliverable.thumbnail_url}}
                        style={styles.linkedThumbImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Film size={16} color={theme.colors.textMuted} />
                    )}
                  </View>
                  <View style={styles.linkedTextWrap}>
                    <Text style={styles.linkedTitle} numberOfLines={1}>
                      {selectedDeliverable?.name || deliverableName}
                    </Text>
                    {selectedDeliverable?.project_name || todo.project_name ? (
                      <Text style={styles.linkedSubtitle} numberOfLines={1}>
                        {selectedDeliverable?.project_name || todo.project_name}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.linkedThumb, styles.linkedAvatarEmpty]}>
                    <Film size={14} color={theme.colors.textMuted} />
                  </View>
                  <Text style={[styles.linkedTitle, {color: theme.colors.textMuted, flex: 1}]}>
                    {todo.project_name ? `${todo.project_name} • not linked` : 'Not linked'}
                  </Text>
                </>
              )}
              <ChevronDown size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

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
              style={[styles.completeButton, isCompleted && styles.uncompleteButton]}
              onPress={handleComplete}>
              <Check
                size={20}
                color={isCompleted ? theme.colors.textPrimary : theme.colors.accentText}
              />
              <Text
                style={[
                  styles.completeButtonText,
                  isCompleted && styles.uncompleteButtonText,
                ]}>
                {isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Assignee picker — stacked sheet so the parent edit context is preserved */}
        <PickerSheet
          visible={showAssigneePicker}
          title="Assign task"
          onClose={() => setShowAssigneePicker(false)}>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => {
              setAssignedTo(undefined);
              setAssignedName(undefined);
              setShowAssigneePicker(false);
            }}>
            <View style={[styles.linkedAvatar, styles.linkedAvatarEmpty]}>
              <X size={14} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.pickerRowTitle}>Unassigned</Text>
            {!assignedTo && <Check size={18} color={theme.colors.textPrimary} />}
          </TouchableOpacity>
          {members.map(m => {
            const isSelected = m.user_id === assignedTo;
            return (
              <TouchableOpacity
                key={m.user_id}
                style={styles.pickerRow}
                onPress={() => {
                  setAssignedTo(m.user_id);
                  setAssignedName(m.name);
                  setShowAssigneePicker(false);
                }}>
                <View style={styles.linkedAvatar}>
                  <Text style={styles.linkedAvatarText}>{getInitials(m.name)}</Text>
                </View>
                <View style={styles.linkedTextWrap}>
                  <Text style={styles.pickerRowTitle} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={styles.pickerRowSubtitle} numberOfLines={1}>
                    {m.email}
                  </Text>
                </View>
                {isSelected && <Check size={18} color={theme.colors.textPrimary} />}
              </TouchableOpacity>
            );
          })}
          {members.length === 0 && (
            <Text style={styles.pickerEmpty}>No workspace members loaded.</Text>
          )}
        </PickerSheet>

        {/* Deliverable picker — link the task into a project's review timeline */}
        <PickerSheet
          visible={showDeliverablePicker}
          title="Link to deliverable"
          onClose={() => setShowDeliverablePicker(false)}>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => {
              setDeliverableId(undefined);
              setDeliverableName(undefined);
              setShowDeliverablePicker(false);
            }}>
            <View style={[styles.linkedThumb, styles.linkedAvatarEmpty]}>
              <X size={14} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.pickerRowTitle}>Not linked</Text>
            {!deliverableId && <Check size={18} color={theme.colors.textPrimary} />}
          </TouchableOpacity>
          {deliverables.map(d => {
            const isSelected = d.id === deliverableId;
            return (
              <TouchableOpacity
                key={d.id}
                style={styles.pickerRow}
                onPress={() => {
                  setDeliverableId(d.id);
                  setDeliverableName(d.name);
                  setShowDeliverablePicker(false);
                }}>
                <View style={styles.linkedThumb}>
                  {d.thumbnail_url ? (
                    <Image
                      source={{uri: d.thumbnail_url}}
                      style={styles.linkedThumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Film size={14} color={theme.colors.textMuted} />
                  )}
                </View>
                <View style={styles.linkedTextWrap}>
                  <Text style={styles.pickerRowTitle} numberOfLines={1}>
                    {d.name}
                  </Text>
                  {d.project_name ? (
                    <Text style={styles.pickerRowSubtitle} numberOfLines={1}>
                      {d.project_name}
                    </Text>
                  ) : null}
                </View>
                {isSelected && <Check size={18} color={theme.colors.textPrimary} />}
              </TouchableOpacity>
            );
          })}
          {deliverables.length === 0 && (
            <Text style={styles.pickerEmpty}>No deliverables in this workspace yet.</Text>
          )}
        </PickerSheet>
      </View>
    </Modal>
  );
}

// Stacked sheet used for assignee + deliverable selection inside
// TaskDetailsModal. Lives at the bottom of the screen so the underlying edit
// form stays visible behind it.
interface PickerSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function PickerSheet({visible, title, onClose, children}: PickerSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.pickerSheetBackdrop}>
        <TouchableOpacity
          style={styles.pickerSheetDismissArea}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.pickerSheetCard}>
          <View style={styles.pickerSheetHandle} />
          <View style={styles.pickerSheetHeader}>
            <Text style={styles.pickerSheetEyebrow}>select</Text>
            <Text style={styles.pickerSheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.pickerSheetClose}>
              <X size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.pickerSheetScroll}
            contentContainerStyle={{paddingBottom: 24}}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  detailsContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  detailsHeaderTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  detailsHeaderEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontFamily: theme.typography.fontFamily.semibold,
    marginBottom: 2,
  },
  detailsHeaderTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    lineHeight: 24,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: '100%',
  },
  detailsEditButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContent: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  detailsContentContainer: {
    paddingBottom: theme.spacing.xl,
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
  detailsValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
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
  priorityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.success,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
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
  // Linked rows (assignee + deliverable)
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    marginTop: theme.spacing.xs,
  },
  linkedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(96, 165, 250, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(147, 197, 253, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedAvatarEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  linkedAvatarText: {
    color: '#dbeafe',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 0.4,
  },
  linkedThumb: {
    width: 44,
    height: 28,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  linkedThumbImage: {
    width: '100%',
    height: '100%',
  },
  linkedTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  linkedTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  linkedSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  // Stacked picker sheet
  pickerSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  pickerSheetDismissArea: {
    flex: 1,
  },
  pickerSheetCard: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '70%',
    paddingTop: 8,
  },
  pickerSheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 8,
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  pickerSheetEyebrow: {
    color: theme.colors.textMuted,
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontFamily: theme.typography.fontFamily.semibold,
    marginRight: 8,
  },
  pickerSheetTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.serifItalic,
    fontStyle: 'italic',
  },
  pickerSheetClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSheetScroll: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pickerRowTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.semibold,
    flex: 1,
  },
  pickerRowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.xs,
    marginTop: 2,
  },
  pickerEmpty: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
