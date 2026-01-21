import {NativeModules, Platform, NativeEventEmitter} from 'react-native';

const {LiveActivityModule} = NativeModules;

// Event emitter for Live Activity button actions
const LiveActivityEmitter = Platform.OS === 'ios' && LiveActivityModule
  ? new NativeEventEmitter(LiveActivityModule)
  : null;

// Debug mode - set to false for production
const DEBUG_LIVE_ACTIVITY = false;

const logDebug = (...args: unknown[]) => {
  if (DEBUG_LIVE_ACTIVITY) {
    console.log('🟣 [LiveActivity]', ...args);
  }
};

const logError = (...args: unknown[]) => {
  console.error('🔴 [LiveActivity ERROR]', ...args);
};

const logWarn = (...args: unknown[]) => {
  console.warn('🟡 [LiveActivity WARN]', ...args);
};

// Verify module is available
if (!LiveActivityModule && Platform.OS === 'ios') {
  logWarn('LiveActivityModule native module not found. Make sure LiveActivityModule.swift is added to the Xcode project.');
} else if (Platform.OS === 'ios') {
  logDebug('Native module loaded successfully');
}

export interface LiveActivityTask {
  id: string;
  title: string;
  projectName?: string;
  estimatedMinutes: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startTime: string; // ISO timestamp
  endTime: string;   // ISO timestamp
}

export interface LiveActivityEvent {
  id: string;
  title: string;
  location?: string;
  calendarColor: string;  // Hex color
  startTime: string;      // ISO timestamp
  endTime: string;        // ISO timestamp
  isUpcoming: boolean;    // true = counting to start, false = event in progress
}

class LiveActivityModuleClass {
  private lastUpdateTime: number = 0;
  private updateCount: number = 0;

  /**
   * Check if Live Activities are available on this device
   */
  async isAvailable(): Promise<boolean> {
    logDebug('Checking availability...');
    
    if (Platform.OS !== 'ios') {
      logDebug('Not iOS - Live Activities unavailable');
      return false;
    }
    
    if (!LiveActivityModule) {
      logError('Native module not found!');
      return false;
    }
    
    try {
      const available = await LiveActivityModule.isAvailable();
      logDebug('Availability check result:', available);
      return available;
    } catch (error) {
      logError('Error checking availability:', error);
      return false;
    }
  }

  /**
   * Start a Live Activity for a task
   */
  async startActivity(task: LiveActivityTask): Promise<string> {
    logDebug('====== START ACTIVITY ======');
    logDebug('Task ID:', task.id);
    logDebug('Title:', task.title);
    logDebug('Project:', task.projectName || '(none)');
    logDebug('Estimated Minutes:', task.estimatedMinutes);
    logDebug('Priority:', task.priority);
    logDebug('Start Time:', task.startTime);
    logDebug('End Time:', task.endTime);
    
    if (Platform.OS !== 'ios') {
      logError('Cannot start - not iOS');
      throw new Error('Live Activities are only available on iOS');
    }
    
    if (!LiveActivityModule) {
      logError('Cannot start - native module not found');
      throw new Error('LiveActivityModule not available');
    }
    
    try {
      const result = await LiveActivityModule.startActivity(
        task.id,
        task.title,
        task.projectName || null,
        task.estimatedMinutes,
        task.priority,
        task.startTime,
        task.endTime,
      );
      logDebug('✅ Activity started successfully! Activity ID:', result);
      this.updateCount = 0;
      return result;
    } catch (error) {
      logError('Failed to start activity:', error);
      throw error;
    }
  }

  /**
   * Update a Live Activity with new remaining time
   */
  async updateActivity(taskId: string, remainingSeconds: number): Promise<string> {
    // Throttle update logs to once per 10 seconds
    const now = Date.now();
    const shouldLog = now - this.lastUpdateTime > 10000;
    
    if (shouldLog) {
      this.lastUpdateTime = now;
      logDebug('📝 Update #' + this.updateCount, '| Task:', taskId, '| Remaining:', remainingSeconds + 's', 
        '(' + Math.floor(remainingSeconds / 60) + 'm ' + (remainingSeconds % 60) + 's)');
    }
    this.updateCount++;
    
    if (Platform.OS !== 'ios') {
      return ''; // Silently fail on non-iOS
    }
    
    if (!LiveActivityModule) {
      return ''; // Silently fail if module not available
    }
    
    try {
      return await LiveActivityModule.updateActivity(taskId, remainingSeconds);
    } catch (error) {
      // Don't throw for update failures - they can happen if activity was dismissed
      // Only log occasionally to avoid spam
      if (shouldLog) {
        logWarn('Update failed (activity may have been dismissed):', error);
      }
      return '';
    }
  }

  /**
   * End a Live Activity
   */
  async endActivity(taskId: string): Promise<string> {
    logDebug('====== END ACTIVITY ======');
    logDebug('Task ID:', taskId);
    logDebug('Total updates sent:', this.updateCount);
    
    if (Platform.OS !== 'ios') {
      throw new Error('Live Activities are only available on iOS');
    }
    
    if (!LiveActivityModule) {
      throw new Error('LiveActivityModule not available');
    }
    
    try {
      const result = await LiveActivityModule.endActivity(taskId);
      logDebug('✅ Activity ended successfully');
      return result;
    } catch (error) {
      logError('Failed to end activity:', error);
      throw error;
    }
  }

  /**
   * Get all active Live Activities
   */
  async getActiveActivities(): Promise<Array<{taskId: string; title: string; remainingSeconds: number}>> {
    logDebug('Getting active activities...');
    
    if (Platform.OS !== 'ios') {
      return [];
    }
    
    if (!LiveActivityModule) {
      logWarn('Native module not found');
      return [];
    }
    
    try {
      const activities = await LiveActivityModule.getActiveActivities();
      logDebug('Active activities:', activities.length);
      activities.forEach((a: {taskId: string; title: string; remainingSeconds: number}, i: number) => {
        logDebug(`  ${i + 1}. ${a.title} (${a.taskId}) - ${a.remainingSeconds}s remaining`);
      });
      return activities;
    } catch (error) {
      logError('Error getting active activities:', error);
      return [];
    }
  }

  /**
   * Debug helper - log current state
   */
  async debugState(): Promise<void> {
    logDebug('====== DEBUG STATE ======');
    logDebug('Platform:', Platform.OS);
    logDebug('Native module exists:', !!LiveActivityModule);
    
    const available = await this.isAvailable();
    logDebug('Activities enabled:', available);
    
    if (available) {
      await this.getActiveActivities();
    }
    logDebug('=========================');
  }

  /**
   * Subscribe to task completion events from Live Activity buttons
   */
  onTaskComplete(callback: (event: {taskId: string}) => void): () => void {
    if (!LiveActivityEmitter) {
      logWarn('Event emitter not available');
      return () => {};
    }
    
    logDebug('Subscribing to onTaskComplete events');
    const subscription = LiveActivityEmitter.addListener('onTaskComplete', callback);
    return () => {
      logDebug('Unsubscribing from onTaskComplete events');
      subscription.remove();
    };
  }

  /**
   * Subscribe to task pause events from Live Activity buttons
   */
  onTaskPause(callback: (event: {taskId: string}) => void): () => void {
    if (!LiveActivityEmitter) {
      logWarn('Event emitter not available');
      return () => {};
    }
    
    logDebug('Subscribing to onTaskPause events');
    const subscription = LiveActivityEmitter.addListener('onTaskPause', callback);
    return () => {
      logDebug('Unsubscribing from onTaskPause events');
      subscription.remove();
    };
  }

  /**
   * Subscribe to add time events from Live Activity buttons
   */
  onTaskAddTime(callback: (event: {taskId: string; minutes: number}) => void): () => void {
    if (!LiveActivityEmitter) {
      logWarn('Event emitter not available');
      return () => {};
    }
    
    logDebug('Subscribing to onTaskAddTime events');
    const subscription = LiveActivityEmitter.addListener('onTaskAddTime', callback);
    return () => {
      logDebug('Unsubscribing from onTaskAddTime events');
      subscription.remove();
    };
  }

  // ===== EVENT LIVE ACTIVITY METHODS =====

  /**
   * Start a Live Activity for a calendar event
   */
  async startEventActivity(event: LiveActivityEvent): Promise<string> {
    logDebug('====== START EVENT ACTIVITY ======');
    logDebug('Event ID:', event.id);
    logDebug('Title:', event.title);
    logDebug('Location:', event.location || '(none)');
    logDebug('Color:', event.calendarColor);
    logDebug('Is Upcoming:', event.isUpcoming);
    
    if (Platform.OS !== 'ios') {
      throw new Error('Live Activities are only available on iOS');
    }
    
    if (!LiveActivityModule) {
      throw new Error('LiveActivityModule not available');
    }
    
    try {
      const result = await LiveActivityModule.startEventActivity(
        event.id,
        event.title,
        event.location || null,
        event.calendarColor,
        event.startTime,
        event.endTime,
        event.isUpcoming,
      );
      logDebug('✅ Event activity started successfully!');
      return result;
    } catch (error) {
      logError('Failed to start event activity:', error);
      throw error;
    }
  }

  /**
   * Update an Event Live Activity
   */
  async updateEventActivity(eventId: string, remainingSeconds: number, isUpcoming: boolean): Promise<string> {
    if (Platform.OS !== 'ios' || !LiveActivityModule) {
      return '';
    }
    
    try {
      return await LiveActivityModule.updateEventActivity(eventId, remainingSeconds, isUpcoming);
    } catch (error) {
      // Silent fail for updates
      return '';
    }
  }

  /**
   * End an Event Live Activity
   */
  async endEventActivity(eventId: string): Promise<string> {
    logDebug('====== END EVENT ACTIVITY ======');
    logDebug('Event ID:', eventId);
    
    if (Platform.OS !== 'ios') {
      throw new Error('Live Activities are only available on iOS');
    }
    
    if (!LiveActivityModule) {
      throw new Error('LiveActivityModule not available');
    }
    
    try {
      const result = await LiveActivityModule.endEventActivity(eventId);
      logDebug('✅ Event activity ended');
      return result;
    } catch (error) {
      logError('Failed to end event activity:', error);
      throw error;
    }
  }
}

export const LiveActivity = new LiveActivityModuleClass();

