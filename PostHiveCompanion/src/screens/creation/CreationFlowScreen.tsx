import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {X, ArrowRight, ChevronDown, Sparkles, Send} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import {theme} from '../../theme';
import {executeAICommand, AICommandResult} from '../../lib/api';
import {useAuth} from '../../hooks/useAuth';
import {useTodos} from '../../hooks/useTodos';
import {capitalizeFirst} from '../../lib/utils';
import {
  getClients,
  getProjects,
  createProject,
  createDeliverable,
  createEvent,
} from '../../lib/api';
import type {
  TodoPriority,
  Client,
  Project,
  DeliverableType,
  ProjectType,
} from '../../lib/types';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

type CreationType = 'project' | 'deliverable' | 'task' | 'event';

// Step types for each creation flow
type ProjectStep = 'name' | 'deadline' | 'client' | 'type' | 'confirm';
type DeliverableStep = 'project' | 'name' | 'type' | 'due_date' | 'confirm';
type TaskStep = 'title' | 'description' | 'priority' | 'confirm';
type EventStep = 'title' | 'datetime' | 'location' | 'confirm';

interface CreationOption {
  type: CreationType;
  label: string;
  description: string;
}

const CREATION_OPTIONS: CreationOption[] = [
  {
    type: 'project',
    label: 'PROJECT',
    description: 'Start a new creative project',
  },
  {
    type: 'deliverable',
    label: 'DELIVERABLE',
    description: 'Add content for review',
  },
  {
    type: 'task',
    label: 'TASK',
    description: 'Create a to-do item',
  },
  {
    type: 'event',
    label: 'EVENT',
    description: 'Schedule a milestone',
  },
];

const PRIORITIES: {key: TodoPriority; label: string}[] = [
  {key: 'low', label: 'Low'},
  {key: 'medium', label: 'Medium'},
  {key: 'high', label: 'High'},
  {key: 'urgent', label: 'Urgent'},
];

const DELIVERABLE_TYPES: {key: DeliverableType; label: string}[] = [
  {key: 'video', label: 'Video'},
  {key: 'image', label: 'Image'},
  {key: 'image_gallery', label: 'Gallery'},
  {key: 'pdf', label: 'PDF'},
  {key: 'audio', label: 'Audio'},
  {key: 'document', label: 'Document'},
];

const PROJECT_TYPES: {key: ProjectType; label: string}[] = [
  {key: 'video', label: 'Video'},
  {key: 'photo', label: 'Photo'},
  {key: 'mixed', label: 'Mixed'},
];

export function CreationFlowScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialCreationType = (route.params as {initialCreationType?: CreationType} | undefined)
    ?.initialCreationType;
  const {user, currentWorkspace} = useAuth();
  const {addTodo} = useTodos({
    workspaceId: currentWorkspace?.id || '',
    userId: user?.id || '',
  });

  // Global state
  const [phase, setPhase] = useState<'selection' | 'input' | 'success'>(() =>
    initialCreationType ? 'input' : 'selection',
  );
  const [selectedType, setSelectedType] = useState<CreationType | null>(() => initialCreationType ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Data for pickers
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Current step per flow
  const [projectStep, setProjectStep] = useState<ProjectStep>('name');
  const [deliverableStep, setDeliverableStep] = useState<DeliverableStep>('project');
  const [taskStep, setTaskStep] = useState<TaskStep>('title');
  const [eventStep, setEventStep] = useState<EventStep>('title');

  // Project form state
  const [projectName, setProjectName] = useState('');
  const [projectDeadline, setProjectDeadline] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [projectType, setProjectType] = useState<ProjectType>('video');
  const [showClientPicker, setShowClientPicker] = useState(false);

  // Deliverable form state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deliverableName, setDeliverableName] = useState('');
  const [deliverableType, setDeliverableType] = useState<DeliverableType>('video');
  const [deliverableDueDate, setDeliverableDueDate] = useState<Date>(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const [deliverableDueTime, setDeliverableDueTime] = useState<Date>(new Date());

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TodoPriority>('medium');

  // Event form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartTime, setEventStartTime] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));
  const [eventEndTime, setEventEndTime] = useState<Date>(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [eventIsAllDay, setEventIsAllDay] = useState(false);
  const [eventLocation, setEventLocation] = useState('');
  const [eventMeetingLink, setEventMeetingLink] = useState('');
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | 'deadline' | 'deliverable' | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | 'deliverable' | null>(null);

  // AI Command state
  const [aiCommandText, setAiCommandText] = useState('');
  const [aiCommandProcessing, setAiCommandProcessing] = useState(false);
  const aiInputRef = useRef<TextInput>(null);

  // Refs for inputs
  const inputRef = useRef<TextInput>(null);

  // Animation values - Selection phase
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  // One extra animation for AI input + all creation options
  const optionAnimations = useRef(
    [{opacity: new Animated.Value(0), translateY: new Animated.Value(50)}, // AI input
    ...CREATION_OPTIONS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(50),
    }))]
  ).current;

  // Animation values - Step-by-step input
  const stepOpacity = useRef(new Animated.Value(0)).current;
  const stepTranslateY = useRef(new Animated.Value(40)).current;

  // Success animations
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!currentWorkspace?.id) return;
      setIsLoadingData(true);
      try {
        const [clientsData, projectsData] = await Promise.all([
          getClients(currentWorkspace.id),
          getProjects(currentWorkspace.id),
        ]);
        setClients(clientsData);
        setProjects(projectsData.filter(p => p.status === 'active'));
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, [currentWorkspace?.id]);

  const animateStepIn = useCallback(() => {
    stepOpacity.setValue(0);
    stepTranslateY.setValue(40);

    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(stepTranslateY, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stepOpacity, stepTranslateY]);

  // Initial animation (skip selection UI when opened with initialCreationType from FAB)
  useEffect(() => {
    const instantType = (route.params as {initialCreationType?: CreationType} | undefined)?.initialCreationType;

    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (instantType) {
      const t = setTimeout(() => {
        animateStepIn();
        setTimeout(() => inputRef.current?.focus(), 300);
      }, 80);
      return () => clearTimeout(t);
    }

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslateY, {
          toValue: 0,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    }, 200);

    optionAnimations.forEach((anim, index) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(anim.translateY, {
            toValue: 0,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }),
        ]).start();
      }, 500 + index * 100);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; match prior behavior
  }, []);

  const animateStepOut = useCallback(() => {
    return new Promise<void>(resolve => {
      Animated.parallel([
        Animated.timing(stepOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(stepTranslateY, {
          toValue: -30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });
  }, [stepOpacity, stepTranslateY]);

  const handleClose = useCallback(() => {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      navigation.goBack();
    });
  }, [navigation, overlayOpacity]);

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setPhase('success');

    setTimeout(() => {
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Auto close after success
      setTimeout(() => {
        handleClose();
      }, 1500);
    }, 100);
  }, [successOpacity, handleClose]);

  const handleAiCommandSubmit = useCallback(async () => {
    if (!aiCommandText.trim() || !currentWorkspace || aiCommandProcessing) return;

    setAiCommandProcessing(true);
    try {
      const result = await executeAICommand(aiCommandText, currentWorkspace.slug || '');

      if (result.success) {
        showSuccess('CREATED');
        setAiCommandText('');
      }
    } catch (error) {
      console.error('AI command error:', error);
    } finally {
      setAiCommandProcessing(false);
    }
  }, [aiCommandText, currentWorkspace, aiCommandProcessing, showSuccess]);

  const handleSelectType = useCallback((type: CreationType) => {
    setSelectedType(type);

    // Animate out selection phase
    Animated.parallel([
      Animated.timing(titleOpacity, {toValue: 0, duration: 200, useNativeDriver: true}),
      ...optionAnimations.map(anim =>
        Animated.parallel([
          Animated.timing(anim.opacity, {toValue: 0, duration: 200, useNativeDriver: true}),
          Animated.timing(anim.translateY, {toValue: -30, duration: 200, useNativeDriver: true}),
        ])
      ),
    ]).start(() => {
      setPhase('input');
      
      // Reset to first step of the selected type
      if (type === 'project') setProjectStep('name');
      else if (type === 'deliverable') setDeliverableStep('project');
      else if (type === 'task') setTaskStep('title');
      else if (type === 'event') setEventStep('title');
      
      animateStepIn();
      
      // Focus input after animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    });
  }, [optionAnimations, titleOpacity, animateStepIn]);

  // ==================== PROJECT FLOW ====================
  const handleProjectNameSubmit = useCallback(async () => {
    if (!projectName.trim()) return;
    await animateStepOut();
    setProjectStep('deadline');
    animateStepIn();
  }, [projectName, animateStepOut, animateStepIn]);

  const handleProjectDeadlineSubmit = useCallback(async () => {
    await animateStepOut();
    setProjectStep('client');
    animateStepIn();
  }, [animateStepOut, animateStepIn]);

  const handleProjectClientSubmit = useCallback(async () => {
    await animateStepOut();
    setProjectStep('type');
    animateStepIn();
  }, [animateStepOut, animateStepIn]);

  const handleProjectTypeSelect = useCallback(async (type: ProjectType) => {
    setProjectType(type);
    setTimeout(async () => {
      await animateStepOut();
      setProjectStep('confirm');
      animateStepIn();
    }, 150);
  }, [animateStepOut, animateStepIn]);

  const handleCreateProject = useCallback(async () => {
    if (!projectName.trim() || isSubmitting || !currentWorkspace?.id || !user?.id) return;
    setIsSubmitting(true);

    try {
      await createProject(currentWorkspace.id, user.id, {
        name: projectName.trim(),
        deadline: projectDeadline.toISOString().split('T')[0],
        client_id: selectedClient?.id,
        project_type: projectType,
      });
      await animateStepOut();
      showSuccess('PROJECT CREATED');
    } catch (error) {
      console.error('Failed to create project:', error);
      setIsSubmitting(false);
    }
  }, [projectName, projectDeadline, selectedClient, projectType, isSubmitting, currentWorkspace?.id, user?.id, animateStepOut, showSuccess]);

  // ==================== DELIVERABLE FLOW ====================
  const handleDeliverableProjectSelect = useCallback(async (project: Project) => {
    setSelectedProject(project);
    setTimeout(async () => {
      await animateStepOut();
      setDeliverableStep('name');
      animateStepIn();
      setTimeout(() => inputRef.current?.focus(), 300);
    }, 150);
  }, [animateStepOut, animateStepIn]);

  const handleDeliverableNameSubmit = useCallback(async () => {
    if (!deliverableName.trim()) return;
    await animateStepOut();
    setDeliverableStep('type');
    animateStepIn();
  }, [deliverableName, animateStepOut, animateStepIn]);

  const handleDeliverableTypeSelect = useCallback(async (type: DeliverableType) => {
    setDeliverableType(type);
    setTimeout(async () => {
      await animateStepOut();
      // Skip due date for image_gallery
      if (type === 'image_gallery') {
        setDeliverableStep('confirm');
      } else {
        setDeliverableStep('due_date');
      }
      animateStepIn();
    }, 150);
  }, [animateStepOut, animateStepIn]);

  const handleDeliverableDueDateSubmit = useCallback(async () => {
    await animateStepOut();
    setDeliverableStep('confirm');
    animateStepIn();
  }, [animateStepOut, animateStepIn]);

  const handleCreateDeliverable = useCallback(async () => {
    if (!deliverableName.trim() || !selectedProject || isSubmitting || !user?.id) return;
    setIsSubmitting(true);

    try {
      const isGallery = deliverableType === 'image_gallery';
      await createDeliverable(selectedProject.id, user.id, {
        name: deliverableName.trim(),
        type: deliverableType,
        due_date: isGallery ? undefined : deliverableDueDate.toISOString().split('T')[0],
        due_time: isGallery ? undefined : `${String(deliverableDueTime.getHours()).padStart(2, '0')}:${String(deliverableDueTime.getMinutes()).padStart(2, '0')}`,
      });
      await animateStepOut();
      showSuccess('DELIVERABLE CREATED');
    } catch (error) {
      console.error('Failed to create deliverable:', error);
      setIsSubmitting(false);
    }
  }, [deliverableName, selectedProject, deliverableType, deliverableDueDate, deliverableDueTime, isSubmitting, user?.id, animateStepOut, showSuccess]);

  // ==================== TASK FLOW ====================
  const handleTitleSubmit = useCallback(async () => {
    if (!taskTitle.trim()) return;
    await animateStepOut();
    setTaskStep('description');
    animateStepIn();
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [taskTitle, animateStepOut, animateStepIn]);

  const handleDescriptionSubmit = useCallback(async () => {
    await animateStepOut();
    setTaskStep('priority');
    animateStepIn();
  }, [animateStepOut, animateStepIn]);

  const handleSkipDescription = useCallback(async () => {
    setTaskDescription('');
    await animateStepOut();
    setTaskStep('priority');
    animateStepIn();
  }, [animateStepOut, animateStepIn]);

  const handlePrioritySelect = useCallback(async (priority: TodoPriority) => {
    setTaskPriority(priority);
    setTimeout(async () => {
      await animateStepOut();
      setTaskStep('confirm');
      animateStepIn();
    }, 150);
  }, [animateStepOut, animateStepIn]);

  const handleCreateTask = useCallback(async () => {
    if (!taskTitle.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await addTodo({
        title: capitalizeFirst(taskTitle.trim()),
        description: taskDescription.trim() || undefined,
        priority: taskPriority,
      });
      await animateStepOut();
      showSuccess('TASK CREATED');
    } catch (error) {
      console.error('Failed to create task:', error);
      setIsSubmitting(false);
    }
  }, [taskTitle, taskDescription, taskPriority, isSubmitting, addTodo, animateStepOut, showSuccess]);

  // ==================== EVENT FLOW ====================
  const handleEventTitleSubmit = useCallback(async () => {
    if (!eventTitle.trim()) return;
    await animateStepOut();
    setEventStep('datetime');
    animateStepIn();
  }, [eventTitle, animateStepOut, animateStepIn]);

  const handleEventDateTimeSubmit = useCallback(async () => {
    await animateStepOut();
    setEventStep('location');
    animateStepIn();
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [animateStepOut, animateStepIn]);

  const handleEventLocationSubmit = useCallback(async () => {
    await animateStepOut();
    setEventStep('confirm');
    animateStepIn();
  }, [animateStepOut, animateStepIn]);

  const handleCreateEvent = useCallback(async () => {
    if (!eventTitle.trim() || isSubmitting || !currentWorkspace?.id) return;
    setIsSubmitting(true);

    try {
      await createEvent(currentWorkspace.id, {
        title: eventTitle.trim(),
        start_time: eventStartTime.toISOString(),
        end_time: eventEndTime.toISOString(),
        is_all_day: eventIsAllDay,
        location: eventLocation.trim() || undefined,
        meeting_link: eventMeetingLink.trim() || undefined,
      });
      await animateStepOut();
      showSuccess('EVENT CREATED');
    } catch (error) {
      console.error('Failed to create event:', error);
      setIsSubmitting(false);
    }
  }, [eventTitle, eventStartTime, eventEndTime, eventIsAllDay, eventLocation, eventMeetingLink, isSubmitting, currentWorkspace?.id, animateStepOut, showSuccess]);

  // ==================== RENDER HELPERS ====================
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = () => {
    switch (selectedType) {
      case 'project': return 'PROJECT';
      case 'deliverable': return 'DELIVERABLE';
      case 'task': return 'TASK';
      case 'event': return 'EVENT';
      default: return '';
    }
  };

  // ==================== SELECTION PHASE ====================
  const renderSelectionPhase = () => (
    <View style={styles.selectionContainer}>
      <Animated.View
        style={[
          styles.titleContainer,
          {
            opacity: titleOpacity,
            transform: [{translateY: titleTranslateY}],
          },
        ]}>
        <Text style={styles.title}>What would you{'\n'}like to make?</Text>
      </Animated.View>

      {/* AI Command Input with Gradient Border */}
      <Animated.View
        style={[
          styles.aiInputWrapper,
          {
            opacity: optionAnimations[0].opacity,
            transform: [{translateY: optionAnimations[0].translateY}],
          },
        ]}>
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#a855f7', '#ec4899']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.aiGradientBorder}>
          <View style={styles.aiInputInner}>
            <Sparkles size={16} color="#a855f7" style={styles.aiIcon} />
            <TextInput
              ref={aiInputRef}
              style={styles.aiTextInput}
              placeholder="Ask AI to create anything..."
              placeholderTextColor={theme.colors.textMuted}
              value={aiCommandText}
              onChangeText={setAiCommandText}
              onSubmitEditing={handleAiCommandSubmit}
              returnKeyType="send"
              editable={!aiCommandProcessing}
            />
            {aiCommandText.trim() && !aiCommandProcessing && (
              <TouchableOpacity 
                style={styles.aiSendButton}
                onPress={handleAiCommandSubmit}>
                <Send size={16} color="#a855f7" />
              </TouchableOpacity>
            )}
            {aiCommandProcessing && (
              <ActivityIndicator size="small" color="#a855f7" />
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.Text 
        style={[
          styles.orDivider, 
          {opacity: optionAnimations[0].opacity}
        ]}>
        OR
      </Animated.Text>

      <View style={styles.optionsList}>
        {CREATION_OPTIONS.map((option, index) => {
          // Index + 1 since index 0 is used for AI input
          const anim = optionAnimations[index + 1];
          
          return (
            <Animated.View
              key={option.type}
              style={[
                {
                  opacity: anim.opacity,
                  transform: [{translateY: anim.translateY}],
                },
              ]}>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => handleSelectType(option.type)}
                activeOpacity={0.7}>
                <View style={styles.optionContent}>
                  <Text style={styles.optionLabel}>
                    {option.label}
                  </Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <ArrowRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );

  // ==================== PROJECT STEPS ====================
  const renderProjectNameStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepLabel}>NEW PROJECT</Text>
      <Text style={styles.stepQuestion}>What's the{'\n'}project name?</Text>
      
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.stepInput}
          placeholder="Enter project name..."
          placeholderTextColor={theme.colors.textMuted}
          value={projectName}
          onChangeText={setProjectName}
          onSubmitEditing={handleProjectNameSubmit}
          returnKeyType="next"
          autoCapitalize="words"
          autoCorrect
        />
      </View>
      
      <TouchableOpacity
        style={[styles.nextButton, !projectName.trim() && styles.nextButtonDisabled]}
        onPress={handleProjectNameSubmit}
        disabled={!projectName.trim()}>
        <Text style={[styles.nextButtonText, !projectName.trim() && styles.nextButtonTextDisabled]}>
          CONTINUE
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderProjectDeadlineStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>1 / 3</Text>
      <Text style={styles.stepLabel}>DEADLINE</Text>
      <Text style={styles.stepQuestion}>When is it{'\n'}due?</Text>
      
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={() => setShowDatePicker('deadline')}>
        <Text style={styles.datePickerText}>{formatDate(projectDeadline)}</Text>
        <ChevronDown size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {showDatePicker === 'deadline' && (
        <DateTimePicker
          value={projectDeadline}
          mode="date"
          display="spinner"
          onChange={(event, date) => {
            setShowDatePicker(null);
            if (date) setProjectDeadline(date);
          }}
          minimumDate={new Date()}
          themeVariant="dark"
        />
      )}
      
      <TouchableOpacity style={styles.nextButton} onPress={handleProjectDeadlineSubmit}>
        <Text style={styles.nextButtonText}>CONTINUE</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderProjectClientStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>2 / 3</Text>
      <Text style={styles.stepLabel}>CLIENT</Text>
      <Text style={styles.stepQuestion}>Who is the{'\n'}client?</Text>
      
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={() => setShowClientPicker(true)}>
        <Text style={styles.datePickerText}>
          {selectedClient?.name || 'Select client (optional)'}
        </Text>
        <ChevronDown size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {showClientPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>SELECT CLIENT</Text>
              <TouchableOpacity onPress={() => setShowClientPicker(false)}>
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => {
                  setSelectedClient(null);
                  setShowClientPicker(false);
                }}>
                <Text style={styles.pickerItemText}>No client</Text>
              </TouchableOpacity>
              {clients.map(client => (
                <TouchableOpacity
                  key={client.id}
                  style={[
                    styles.pickerItem,
                    selectedClient?.id === client.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedClient(client);
                    setShowClientPicker(false);
                  }}>
                  <Text style={[
                    styles.pickerItemText,
                    selectedClient?.id === client.id && styles.pickerItemTextSelected,
                  ]}>{client.name}</Text>
                  {client.company && (
                    <Text style={styles.pickerItemSubtext}>{client.company}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
      
      <TouchableOpacity style={styles.nextButton} onPress={handleProjectClientSubmit}>
        <Text style={styles.nextButtonText}>CONTINUE</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderProjectTypeStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>3 / 3</Text>
      <Text style={styles.stepLabel}>PROJECT TYPE</Text>
      <Text style={styles.stepQuestion}>What type of{'\n'}content?</Text>
      
      <View style={styles.typeGrid}>
        {PROJECT_TYPES.map(type => (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.typeCard,
              projectType === type.key && styles.typeCardActive,
            ]}
            onPress={() => handleProjectTypeSelect(type.key)}
            activeOpacity={0.7}>
            <Text style={[
              styles.typeLabel,
              projectType === type.key && styles.typeLabelActive,
            ]}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderProjectConfirmStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepLabel}>READY TO CREATE</Text>
      <Text style={styles.stepQuestion}>Does this{'\n'}look right?</Text>
      
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>NAME</Text>
          <Text style={styles.summaryValue} numberOfLines={2}>{projectName}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>DEADLINE</Text>
          <Text style={styles.summaryValue}>{formatDate(projectDeadline)}</Text>
        </View>
        {selectedClient && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>CLIENT</Text>
              <Text style={styles.summaryValue}>{selectedClient.name}</Text>
            </View>
          </>
        )}
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>TYPE</Text>
          <Text style={styles.summaryValue}>{projectType.charAt(0).toUpperCase() + projectType.slice(1)}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.createButton, isSubmitting && styles.createButtonDisabled]}
        onPress={handleCreateProject}
        disabled={isSubmitting}>
        <Text style={styles.createButtonText}>
          {isSubmitting ? 'CREATING...' : 'CREATE PROJECT'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ==================== DELIVERABLE STEPS ====================
  const renderDeliverableProjectStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepLabel}>NEW DELIVERABLE</Text>
      <Text style={styles.stepQuestion}>Which project{'\n'}is this for?</Text>
      
      {isLoadingData ? (
        <ActivityIndicator color={theme.colors.textPrimary} style={{marginTop: 20}} />
      ) : projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No projects found</Text>
          <Text style={styles.emptyStateSubtext}>Create a project first</Text>
        </View>
      ) : (
        <ScrollView style={styles.projectList} showsVerticalScrollIndicator={false}>
          {projects.map(project => (
            <TouchableOpacity
              key={project.id}
              style={[
                styles.projectItem,
                selectedProject?.id === project.id && styles.projectItemSelected,
              ]}
              onPress={() => handleDeliverableProjectSelect(project)}>
              <Text style={styles.projectItemName}>{project.name}</Text>
              {project.client_name && (
                <Text style={styles.projectItemClient}>{project.client_name}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );

  const renderDeliverableNameStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>1 / 3</Text>
      <Text style={styles.stepLabel}>DELIVERABLE NAME</Text>
      <Text style={styles.stepQuestion}>What are you{'\n'}delivering?</Text>
      
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.stepInput}
          placeholder="Enter deliverable name..."
          placeholderTextColor={theme.colors.textMuted}
          value={deliverableName}
          onChangeText={setDeliverableName}
          onSubmitEditing={handleDeliverableNameSubmit}
          returnKeyType="next"
          autoCapitalize="words"
          autoCorrect
        />
      </View>
      
      <TouchableOpacity
        style={[styles.nextButton, !deliverableName.trim() && styles.nextButtonDisabled]}
        onPress={handleDeliverableNameSubmit}
        disabled={!deliverableName.trim()}>
        <Text style={[styles.nextButtonText, !deliverableName.trim() && styles.nextButtonTextDisabled]}>
          CONTINUE
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderDeliverableTypeStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>2 / 3</Text>
      <Text style={styles.stepLabel}>CONTENT TYPE</Text>
      <Text style={styles.stepQuestion}>What kind of{'\n'}content?</Text>
      
      <View style={styles.deliverableTypeGrid}>
        {DELIVERABLE_TYPES.map(type => (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.deliverableTypeCard,
              deliverableType === type.key && styles.deliverableTypeCardActive,
            ]}
            onPress={() => handleDeliverableTypeSelect(type.key)}
            activeOpacity={0.7}>
            <Text style={[
              styles.deliverableTypeLabel,
              deliverableType === type.key && styles.deliverableTypeLabelActive,
            ]}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderDeliverableDueDateStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>3 / 3</Text>
      <Text style={styles.stepLabel}>DUE DATE</Text>
      <Text style={styles.stepQuestion}>When is it{'\n'}due?</Text>
      
      <View style={styles.dateTimeColumn}>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker('deliverable')}>
          <Text style={styles.datePickerText}>{formatDate(deliverableDueDate)}</Text>
          <ChevronDown size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowTimePicker('deliverable')}>
          <Text style={styles.datePickerText}>{formatTime(deliverableDueTime)}</Text>
          <ChevronDown size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {showDatePicker === 'deliverable' && (
        <DateTimePicker
          value={deliverableDueDate}
          mode="date"
          display="spinner"
          onChange={(event, date) => {
            setShowDatePicker(null);
            if (date) setDeliverableDueDate(date);
          }}
          minimumDate={new Date()}
          themeVariant="dark"
        />
      )}

      {showTimePicker === 'deliverable' && (
        <DateTimePicker
          value={deliverableDueTime}
          mode="time"
          display="spinner"
          onChange={(event, date) => {
            setShowTimePicker(null);
            if (date) setDeliverableDueTime(date);
          }}
          minuteInterval={15}
          themeVariant="dark"
        />
      )}
      
      <TouchableOpacity style={styles.nextButton} onPress={handleDeliverableDueDateSubmit}>
        <Text style={styles.nextButtonText}>CONTINUE</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderDeliverableConfirmStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepLabel}>READY TO CREATE</Text>
      <Text style={styles.stepQuestion}>Does this{'\n'}look right?</Text>
      
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>PROJECT</Text>
          <Text style={styles.summaryValue}>{selectedProject?.name}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>NAME</Text>
          <Text style={styles.summaryValue} numberOfLines={2}>{deliverableName}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>TYPE</Text>
          <Text style={styles.summaryValue}>
            {DELIVERABLE_TYPES.find(t => t.key === deliverableType)?.label}
          </Text>
        </View>
        {deliverableType !== 'image_gallery' && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>DUE</Text>
              <Text style={styles.summaryValue}>
                {formatDate(deliverableDueDate)} at {formatTime(deliverableDueTime)}
              </Text>
            </View>
          </>
        )}
      </View>
      
      <TouchableOpacity
        style={[styles.createButton, isSubmitting && styles.createButtonDisabled]}
        onPress={handleCreateDeliverable}
        disabled={isSubmitting}>
        <Text style={styles.createButtonText}>
          {isSubmitting ? 'CREATING...' : 'CREATE DELIVERABLE'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ==================== TASK STEPS ====================
  const renderTitleStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepLabel}>NEW TASK</Text>
      <Text style={styles.stepQuestion}>What needs to{'\n'}be done?</Text>
      
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.stepInput}
          placeholder="Enter task title..."
          placeholderTextColor={theme.colors.textMuted}
          value={taskTitle}
          onChangeText={setTaskTitle}
          onSubmitEditing={handleTitleSubmit}
          returnKeyType="next"
          autoCapitalize="sentences"
          autoCorrect
        />
      </View>
      
      <TouchableOpacity
        style={[styles.nextButton, !taskTitle.trim() && styles.nextButtonDisabled]}
        onPress={handleTitleSubmit}
        disabled={!taskTitle.trim()}>
        <Text style={[styles.nextButtonText, !taskTitle.trim() && styles.nextButtonTextDisabled]}>
          CONTINUE
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderDescriptionStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>1 / 2</Text>
      <Text style={styles.stepLabel}>DESCRIPTION</Text>
      <Text style={styles.stepQuestion}>Any details{'\n'}to add?</Text>
      
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={[styles.stepInput, styles.stepInputMultiline]}
          placeholder="Add more details (optional)..."
          placeholderTextColor={theme.colors.textMuted}
          value={taskDescription}
          onChangeText={setTaskDescription}
          onSubmitEditing={handleDescriptionSubmit}
          returnKeyType="next"
          multiline
          numberOfLines={3}
          autoCapitalize="sentences"
          autoCorrect
        />
      </View>
      
      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkipDescription}>
          <Text style={styles.skipButtonText}>SKIP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleDescriptionSubmit}>
          <Text style={styles.nextButtonText}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderPriorityStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>2 / 2</Text>
      <Text style={styles.stepLabel}>PRIORITY</Text>
      <Text style={styles.stepQuestion}>How urgent{'\n'}is this?</Text>
      
      <View style={styles.priorityGrid}>
        {PRIORITIES.map(priority => (
          <TouchableOpacity
            key={priority.key}
            style={[
              styles.priorityCard,
              taskPriority === priority.key && styles.priorityCardActive,
            ]}
            onPress={() => handlePrioritySelect(priority.key)}
            activeOpacity={0.7}>
            <Text style={[
              styles.priorityLabel,
              taskPriority === priority.key && styles.priorityLabelActive,
            ]}>
              {priority.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderTaskConfirmStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepLabel}>READY TO CREATE</Text>
      <Text style={styles.stepQuestion}>Does this{'\n'}look right?</Text>
      
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>TITLE</Text>
          <Text style={styles.summaryValue} numberOfLines={2}>{taskTitle}</Text>
        </View>
        {taskDescription && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>DESCRIPTION</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>{taskDescription}</Text>
            </View>
          </>
        )}
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>PRIORITY</Text>
          <Text style={styles.summaryValue}>
            {PRIORITIES.find(p => p.key === taskPriority)?.label}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.createButton, isSubmitting && styles.createButtonDisabled]}
        onPress={handleCreateTask}
        disabled={isSubmitting}>
        <Text style={styles.createButtonText}>
          {isSubmitting ? 'CREATING...' : 'CREATE TASK'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ==================== EVENT STEPS ====================
  const renderEventTitleStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepLabel}>NEW EVENT</Text>
      <Text style={styles.stepQuestion}>What's the{'\n'}event?</Text>
      
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.stepInput}
          placeholder="Enter event title..."
          placeholderTextColor={theme.colors.textMuted}
          value={eventTitle}
          onChangeText={setEventTitle}
          onSubmitEditing={handleEventTitleSubmit}
          returnKeyType="next"
          autoCapitalize="words"
          autoCorrect
        />
      </View>
      
      <TouchableOpacity
        style={[styles.nextButton, !eventTitle.trim() && styles.nextButtonDisabled]}
        onPress={handleEventTitleSubmit}
        disabled={!eventTitle.trim()}>
        <Text style={[styles.nextButtonText, !eventTitle.trim() && styles.nextButtonTextDisabled]}>
          CONTINUE
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEventDateTimeStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>1 / 2</Text>
      <Text style={styles.stepLabel}>DATE & TIME</Text>
      <Text style={styles.stepQuestion}>When is{'\n'}the event?</Text>

      {/* All Day Toggle */}
      <TouchableOpacity
        style={styles.allDayToggle}
        onPress={() => setEventIsAllDay(!eventIsAllDay)}>
        <View style={[styles.checkbox, eventIsAllDay && styles.checkboxActive]}>
          {eventIsAllDay && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.allDayText}>All-day event</Text>
      </TouchableOpacity>
      
      {/* Start */}
      <Text style={styles.dateLabel}>START</Text>
      <View style={styles.dateTimeColumn}>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker('start')}>
          <Text style={styles.datePickerText}>{formatDate(eventStartTime)}</Text>
          <ChevronDown size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
        
        {!eventIsAllDay && (
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowTimePicker('start')}>
            <Text style={styles.datePickerText}>{formatTime(eventStartTime)}</Text>
            <ChevronDown size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* End */}
      <Text style={styles.dateLabel}>END</Text>
      <View style={styles.dateTimeColumn}>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker('end')}>
          <Text style={styles.datePickerText}>{formatDate(eventEndTime)}</Text>
          <ChevronDown size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
        
        {!eventIsAllDay && (
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowTimePicker('end')}>
            <Text style={styles.datePickerText}>{formatTime(eventEndTime)}</Text>
            <ChevronDown size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {showDatePicker === 'start' && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Start Date</Text>
            <TouchableOpacity 
              style={styles.pickerDoneButton}
              onPress={() => setShowDatePicker(null)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={eventStartTime}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              if (date) {
                setEventStartTime(date);
                if (date > eventEndTime) {
                  setEventEndTime(new Date(date.getTime() + 60 * 60 * 1000));
                }
              }
            }}
            themeVariant="dark"
            style={styles.picker}
          />
        </View>
      )}

      {showDatePicker === 'end' && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>End Date</Text>
            <TouchableOpacity 
              style={styles.pickerDoneButton}
              onPress={() => setShowDatePicker(null)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={eventEndTime}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              if (date) setEventEndTime(date);
            }}
            minimumDate={eventStartTime}
            themeVariant="dark"
            style={styles.picker}
          />
        </View>
      )}

      {showTimePicker === 'start' && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Start Time</Text>
            <TouchableOpacity 
              style={styles.pickerDoneButton}
              onPress={() => setShowTimePicker(null)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={eventStartTime}
            mode="time"
            display="spinner"
            onChange={(event, date) => {
              if (date) {
                setEventStartTime(date);
                if (date > eventEndTime) {
                  setEventEndTime(new Date(date.getTime() + 60 * 60 * 1000));
                }
              }
            }}
            minuteInterval={15}
            themeVariant="dark"
            style={styles.picker}
          />
        </View>
      )}

      {showTimePicker === 'end' && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>End Time</Text>
            <TouchableOpacity 
              style={styles.pickerDoneButton}
              onPress={() => setShowTimePicker(null)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={eventEndTime}
            mode="time"
            display="spinner"
            onChange={(event, date) => {
              if (date) setEventEndTime(date);
            }}
            minuteInterval={15}
            themeVariant="dark"
            style={styles.picker}
          />
        </View>
      )}
      
      <TouchableOpacity style={styles.nextButton} onPress={handleEventDateTimeSubmit}>
        <Text style={styles.nextButtonText}>CONTINUE</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEventLocationStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepCounter}>2 / 2</Text>
      <Text style={styles.stepLabel}>LOCATION</Text>
      <Text style={styles.stepQuestion}>Where is{'\n'}the event?</Text>
      
      <View style={styles.locationInputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.stepInput}
          placeholder="Location (optional)"
          placeholderTextColor={theme.colors.textMuted}
          value={eventLocation}
          onChangeText={setEventLocation}
          autoCapitalize="words"
          autoCorrect
        />
        
        <TextInput
          style={styles.stepInput}
          placeholder="Meeting link (optional)"
          placeholderTextColor={theme.colors.textMuted}
          value={eventMeetingLink}
          onChangeText={setEventMeetingLink}
          autoCapitalize="none"
          keyboardType="url"
          autoCorrect={false}
        />
      </View>
      
      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.skipButton} onPress={handleEventLocationSubmit}>
          <Text style={styles.skipButtonText}>SKIP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleEventLocationSubmit}>
          <Text style={styles.nextButtonText}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderEventConfirmStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: stepOpacity,
          transform: [{translateY: stepTranslateY}],
        },
      ]}>
      <Text style={styles.stepLabel}>READY TO CREATE</Text>
      <Text style={styles.stepQuestion}>Does this{'\n'}look right?</Text>
      
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>TITLE</Text>
          <Text style={styles.summaryValue} numberOfLines={2}>{eventTitle}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>START</Text>
          <Text style={styles.summaryValue}>
            {formatDate(eventStartTime)}{!eventIsAllDay && ` at ${formatTime(eventStartTime)}`}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>END</Text>
          <Text style={styles.summaryValue}>
            {formatDate(eventEndTime)}{!eventIsAllDay && ` at ${formatTime(eventEndTime)}`}
          </Text>
        </View>
        {eventLocation && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>LOCATION</Text>
              <Text style={styles.summaryValue}>{eventLocation}</Text>
            </View>
          </>
        )}
        {eventMeetingLink && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>LINK</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{eventMeetingLink}</Text>
            </View>
          </>
        )}
      </View>
      
      <TouchableOpacity
        style={[styles.createButton, isSubmitting && styles.createButtonDisabled]}
        onPress={handleCreateEvent}
        disabled={isSubmitting}>
        <Text style={styles.createButtonText}>
          {isSubmitting ? 'CREATING...' : 'CREATE EVENT'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ==================== INPUT PHASE ROUTER ====================
  const renderInputPhase = () => {
    if (selectedType === 'project') {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputPhase}>
          {projectStep === 'name' && renderProjectNameStep()}
          {projectStep === 'deadline' && renderProjectDeadlineStep()}
          {projectStep === 'client' && renderProjectClientStep()}
          {projectStep === 'type' && renderProjectTypeStep()}
          {projectStep === 'confirm' && renderProjectConfirmStep()}
        </KeyboardAvoidingView>
      );
    }

    if (selectedType === 'deliverable') {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputPhase}>
          {deliverableStep === 'project' && renderDeliverableProjectStep()}
          {deliverableStep === 'name' && renderDeliverableNameStep()}
          {deliverableStep === 'type' && renderDeliverableTypeStep()}
          {deliverableStep === 'due_date' && renderDeliverableDueDateStep()}
          {deliverableStep === 'confirm' && renderDeliverableConfirmStep()}
        </KeyboardAvoidingView>
      );
    }

    if (selectedType === 'task') {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputPhase}>
          {taskStep === 'title' && renderTitleStep()}
          {taskStep === 'description' && renderDescriptionStep()}
          {taskStep === 'priority' && renderPriorityStep()}
          {taskStep === 'confirm' && renderTaskConfirmStep()}
        </KeyboardAvoidingView>
      );
    }

    if (selectedType === 'event') {
      return (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputPhase}>
          {eventStep === 'title' && renderEventTitleStep()}
          {eventStep === 'datetime' && renderEventDateTimeStep()}
          {eventStep === 'location' && renderEventLocationStep()}
          {eventStep === 'confirm' && renderEventConfirmStep()}
        </KeyboardAvoidingView>
      );
    }

    return null;
  };

  // ==================== SUCCESS PHASE ====================
  const renderSuccessPhase = () => (
    <View style={styles.successContainer}>
      <Animated.View
        style={[
          styles.successContent,
          {opacity: successOpacity},
        ]}>
        <Text style={styles.successLabel}>{successMessage}</Text>
        <Text style={styles.successTitle}>Done.</Text>
      </Animated.View>
    </View>
  );

  return (
    <Animated.View style={[styles.container, {opacity: overlayOpacity}]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Close button */}
        {phase !== 'success' && (
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Content */}
        {phase === 'selection' && renderSelectionPhase()}
        {phase === 'input' && renderInputPhase()}
        {phase === 'success' && renderSuccessPhase()}

        {/* Decorative elements */}
        <View style={styles.decorativeBottom}>
          <View style={styles.decorativeLine} />
          <View style={[styles.decorativeLine, styles.decorativeLineShort]} />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Selection phase
  selectionContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: SCREEN_HEIGHT * 0.06,
  },
  titleContainer: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontFamily: theme.typography.fontFamily.bold,
    lineHeight: 38,
  },
  optionsList: {
    gap: theme.spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  aiInputWrapper: {
    marginBottom: theme.spacing.md,
  },
  aiGradientBorder: {
    padding: 2,
    borderRadius: 8,
  },
  aiInputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  aiIcon: {
    opacity: 0.8,
  },
  aiTextInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontFamily: theme.typography.fontFamily.regular,
    paddingVertical: 4,
  },
  aiSendButton: {
    padding: theme.spacing.xs,
  },
  orDivider: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 3,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  optionDescription: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  // Step-by-step input phase
  inputPhase: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepCounter: {
    color: theme.colors.textDisabled,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    letterSpacing: 2,
    marginBottom: theme.spacing.lg,
  },
  stepLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 4,
    marginBottom: theme.spacing.sm,
  },
  stepQuestion: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: theme.spacing.xl,
  },
  inputWrapper: {
    width: '100%',
  },
  stepInput: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    color: theme.colors.textPrimary,
    fontSize: 18,
    paddingVertical: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
  },
  stepInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    textAlign: 'left',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  nextButton: {
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.accentBackground,
  },
  nextButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  nextButtonText: {
    color: theme.colors.accentText,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 3,
  },
  nextButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  stepActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skipButtonText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
  },
  // Date/Time pickers
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    width: '100%',
  },
  datePickerText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.medium,
  },
  dateTimeColumn: {
    width: '100%',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  dateLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginBottom: theme.spacing.xs,
    alignSelf: 'flex-start',
  },
  // Picker overlay
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  pickerContainer: {
    width: '90%',
    maxHeight: '60%',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 3,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.surfaceHover,
  },
  pickerItemText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
  },
  pickerItemTextSelected: {
    color: theme.colors.textPrimary,
  },
  pickerItemSubtext: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  // Project list for deliverable
  projectList: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.35,
  },
  projectItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  projectItemSelected: {
    backgroundColor: theme.colors.surfaceHover,
  },
  projectItemName: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.medium,
  },
  projectItemClient: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyStateText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  emptyStateSubtext: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  // Type grids
  typeGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  typeCardActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.textPrimary,
  },
  typeLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  typeLabelActive: {
    color: theme.colors.textPrimary,
  },
  deliverableTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  deliverableTypeCard: {
    width: (SCREEN_WIDTH - theme.spacing.xl * 2 - theme.spacing.sm * 2) / 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  deliverableTypeCardActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.textPrimary,
  },
  deliverableTypeLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 1,
  },
  deliverableTypeLabelActive: {
    color: theme.colors.textPrimary,
  },
  // Priority
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  priorityCard: {
    width: (SCREEN_WIDTH - theme.spacing.xl * 2 - theme.spacing.sm) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  priorityCardActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.textPrimary,
  },
  priorityLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  priorityLabelActive: {
    color: theme.colors.textPrimary,
  },
  // All day toggle
  allDayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    alignSelf: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: theme.colors.textPrimary,
    borderColor: theme.colors.textPrimary,
  },
  checkmark: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  allDayText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
  },
  // Location inputs
  locationInputContainer: {
    width: '100%',
    gap: theme.spacing.md,
  },
  // Confirm step
  summaryCard: {
    width: '100%',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  summaryRow: {
    paddingVertical: theme.spacing.sm,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
  },
  createButton: {
    width: '100%',
    backgroundColor: theme.colors.accentBackground,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: theme.colors.accentText,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    letterSpacing: 3,
  },
  // Success phase
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  successContent: {
    alignItems: 'center',
  },
  successLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 4,
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    color: theme.colors.textPrimary,
    fontSize: 56,
    fontFamily: theme.typography.fontFamily.bold,
  },
  // Decorative
  decorativeBottom: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  decorativeLine: {
    width: 40,
    height: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 8,
  },
  decorativeLineShort: {
    width: 20,
  },
  // Picker container styles
  pickerContainer: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    marginTop: theme.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
