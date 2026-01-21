import {useEffect, useRef, useCallback} from 'react';
import {LiveActivity, LiveActivityTask} from '../lib/LiveActivityModule';
import {Todo} from '../lib/types';

// Debug mode - set to false for production
const DEBUG = false;
const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('🔵 [useLiveActivity]', ...args);
  }
};

interface UseLiveActivityOptions {
  task?: Todo | null;
  isActive?: boolean;
  /** Optional: The scheduled start time of the task (ISO string) */
  scheduledStart?: string | null;
  /** Optional: The scheduled end time of the task (ISO string) */
  scheduledEnd?: string | null;
  /** Callback when user presses "Complete" button on Dynamic Island */
  onComplete?: (taskId: string) => void;
  /** Callback when user presses "Pause" button on Dynamic Island */
  onPause?: (taskId: string) => void;
  /** Callback when user presses "+15m" button on Dynamic Island */
  onAddTime?: (taskId: string, minutes: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to manage Live Activity for the current active task
 * 
 * Automatically starts Live Activity when task becomes active,
 * updates it every second with remaining time, and ends it when task is completed.
 */
export function useLiveActivity({
  task,
  isActive = false,
  scheduledStart,
  scheduledEnd,
  onComplete,
  onPause,
  onAddTime,
  onError,
}: UseLiveActivityOptions) {
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAvailableRef = useRef<boolean | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);

  // Check availability on mount
  useEffect(() => {
    log('Hook mounted, checking availability...');
    LiveActivity.isAvailable().then(available => {
      isAvailableRef.current = available;
      log('Availability result:', available);
      if (!available) {
        log('⚠️ Live Activities not available on this device');
      }
    });
    
    // Debug: Log current state
    LiveActivity.debugState();
  }, []);

  // Set up event listeners for button presses from Dynamic Island
  useEffect(() => {
    log('Setting up Live Activity button event listeners');
    
    const unsubComplete = LiveActivity.onTaskComplete((event) => {
      log('🟢 Task complete button pressed:', event.taskId);
      onComplete?.(event.taskId);
    });
    
    const unsubPause = LiveActivity.onTaskPause((event) => {
      log('⏸️ Task pause button pressed:', event.taskId);
      onPause?.(event.taskId);
    });
    
    const unsubAddTime = LiveActivity.onTaskAddTime((event) => {
      log('⏱️ Add time button pressed:', event.taskId, '+', event.minutes, 'min');
      onAddTime?.(event.taskId, event.minutes);
    });
    
    return () => {
      log('Cleaning up Live Activity button event listeners');
      unsubComplete();
      unsubPause();
      unsubAddTime();
    };
  }, [onComplete, onPause, onAddTime]);

  // Get start time - prefer scheduledStart, fallback to now
  const getStartTime = useCallback((): string => {
    if (scheduledStart) {
      const date = new Date(scheduledStart);
      if (!isNaN(date.getTime())) {
        log('  Using scheduledStart:', scheduledStart);
        return date.toISOString();
      }
    }
    log('  Using current time as start');
    return new Date().toISOString();
  }, [scheduledStart]);

  // Calculate end time from task - prefer scheduledEnd
  const calculateEndTime = useCallback((todo: Todo): string => {
    log('Calculating end time for task:', todo.id);
    log('  scheduledEnd:', scheduledEnd);
    log('  due_date:', todo.due_date);
    log('  due_time:', todo.due_time);
    log('  estimated_minutes:', todo.estimated_minutes);
    
    try {
      // First priority: use scheduledEnd if provided
      if (scheduledEnd) {
        const date = new Date(scheduledEnd);
        if (!isNaN(date.getTime())) {
          log('  Using scheduledEnd:', scheduledEnd);
          return date.toISOString();
        }
      }
      
      // Second priority: use due date/time
      if (todo.due_date && todo.due_time) {
        const dateStr = `${todo.due_date}T${todo.due_time}:00`;
        const date = new Date(dateStr);
        log('  Parsed due date/time:', dateStr, '-> Valid:', !isNaN(date.getTime()));
        if (!isNaN(date.getTime())) {
          log('  Using due date/time:', date.toISOString());
          return date.toISOString();
        }
      }
      
      // Third priority: calculate from estimated minutes
      if (todo.estimated_minutes && todo.estimated_minutes > 0) {
        const endTime = new Date(Date.now() + todo.estimated_minutes * 60000);
        log('  Using estimated minutes, end time:', endTime.toISOString());
        return endTime.toISOString();
      }
      
      // Default to 1 hour if no estimate
      const endTime = new Date(Date.now() + 60 * 60000);
      log('  Using default 1 hour, end time:', endTime.toISOString());
      return endTime.toISOString();
    } catch (e) {
      log('  ⚠️ Error calculating end time, using fallback:', e);
      return new Date(Date.now() + 60 * 60000).toISOString();
    }
  }, [scheduledEnd]);

  // Start Live Activity
  const startActivity = useCallback(
    async (todo: Todo) => {
      log('startActivity called');
      log('  isAvailable:', isAvailableRef.current);
      log('  task:', todo?.id, todo?.title);
      log('  scheduledStart:', scheduledStart);
      log('  scheduledEnd:', scheduledEnd);
      
      if (!isAvailableRef.current) {
        log('  ⚠️ Skipping - Live Activities not available');
        return;
      }

      try {
        const startTime = getStartTime();
        const endTime = calculateEndTime(todo);

        const activityTask: LiveActivityTask = {
          id: todo.id,
          title: todo.title,
          projectName: todo.project_name,
          estimatedMinutes: todo.estimated_minutes || 60,
          priority: todo.priority,
          startTime,
          endTime,
        };

        log('  Creating activity with:', JSON.stringify(activityTask, null, 2));
        
        await LiveActivity.startActivity(activityTask);
        currentTaskIdRef.current = todo.id;
        log('  ✅ Activity started successfully');
      } catch (error) {
        log('  ❌ Failed to start:', error);
        onError?.(error as Error);
      }
    },
    [calculateEndTime, getStartTime, scheduledStart, scheduledEnd, onError],
  );

  // Update Live Activity with remaining time
  const updateActivity = useCallback(
    async (taskId: string, endTime: string) => {
      if (!isAvailableRef.current) {
        return;
      }

      try {
        const now = Date.now();
        const endDate = new Date(endTime);
        
        // Validate the end date
        if (isNaN(endDate.getTime())) {
          log('⚠️ Invalid end time for update:', endTime);
          return;
        }
        
        const end = endDate.getTime();
        const remainingSeconds = Math.max(0, Math.floor((end - now) / 1000));

        await LiveActivity.updateActivity(taskId, remainingSeconds);
      } catch (error) {
        // Don't spam logs for update failures
        // Don't call onError for update failures - they're less critical
      }
    },
    [],
  );

  // End Live Activity
  const endActivity = useCallback(
    async (taskId: string) => {
      log('endActivity called for:', taskId);
      
      if (!isAvailableRef.current) {
        log('  ⚠️ Skipping - not available');
        return;
      }

      try {
        await LiveActivity.endActivity(taskId);
        log('  ✅ Activity ended');
      } catch (error) {
        log('  ❌ Failed to end:', error);
        onError?.(error as Error);
      }
    },
    [onError],
  );

  // Main effect: manage Live Activity based on task status
  useEffect(() => {
    log('====== EFFECT TRIGGERED ======');
    log('  task:', task?.id, task?.title);
    log('  isActive:', isActive);
    log('  isAvailable:', isAvailableRef.current);
    log('  currentTaskId:', currentTaskIdRef.current);
    
    // Clear any existing interval
    if (updateIntervalRef.current) {
      log('  Clearing existing update interval');
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    // If task is active, start/update Live Activity
    if (task && isActive && isAvailableRef.current) {
      log('  ✅ Conditions met - starting activity');
      const endTime = calculateEndTime(task);

      // Start or update the activity
      startActivity(task).then(() => {
        log('  Setting up update interval (every 1s)');
        // Set up interval to update every second
        updateIntervalRef.current = setInterval(() => {
          updateActivity(task.id, endTime);
        }, 1000);
      });
    } else {
      log('  ⚠️ Conditions not met:');
      if (!task) log('    - No task');
      if (!isActive) log('    - Not active');
      if (!isAvailableRef.current) log('    - Live Activities not available');
    }

    // Cleanup: end activity when task becomes inactive
    return () => {
      log('  Cleanup running...');
      if (updateIntervalRef.current) {
        log('  Clearing update interval');
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      if (task && isActive && currentTaskIdRef.current) {
        log('  Ending activity for:', currentTaskIdRef.current);
        endActivity(currentTaskIdRef.current).catch((e) => {
          log('  Error ending activity:', e);
        });
        currentTaskIdRef.current = null;
      }
    };
  }, [task, isActive, startActivity, updateActivity, endActivity, calculateEndTime, scheduledStart, scheduledEnd]);

  // Debug helper - expose for external debugging
  const debugState = useCallback(async () => {
    log('====== HOOK DEBUG STATE ======');
    log('task:', task?.id, task?.title);
    log('isActive:', isActive);
    log('isAvailable:', isAvailableRef.current);
    log('currentTaskId:', currentTaskIdRef.current);
    log('hasUpdateInterval:', !!updateIntervalRef.current);
    await LiveActivity.debugState();
    log('==============================');
  }, [task, isActive]);

  return {
    startActivity,
    updateActivity,
    endActivity,
    debugState,
    isAvailable: isAvailableRef.current ?? false,
  };
}

